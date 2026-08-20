"""Tests for credential file passthrough and skills directory mounting."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from tools.credential_files import (
    clear_credential_files,
    get_credential_file_mounts,
    get_cache_directory_mounts,
    get_skills_directory_mount,
    iter_cache_files,
    iter_skills_files,
    map_cache_path_to_container,
    register_credential_file,
    register_credential_files,
)


@pytest.fixture(autouse=True)
def _clean_state():
    """Reset module state between tests."""
    import tools.credential_files as _cred_mod
    clear_credential_files()
    _cred_mod._config_files = None
    yield
    clear_credential_files()
    _cred_mod._config_files = None


class TestRegisterCredentialFiles:
    def test_dict_with_path_key(self, tmp_path):
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        (work4you_home / "token.json").write_text("{}")

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(work4you_home)}):
            missing = register_credential_files([{"path": "token.json"}])

        assert missing == []
        mounts = get_credential_file_mounts()
        assert len(mounts) == 1
        assert mounts[0]["host_path"] == str(work4you_home / "token.json")
        assert mounts[0]["container_path"] == "/root/.work4you/token.json"


    def test_path_takes_precedence_over_name(self, tmp_path):
        """When both path and name are present, path wins."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        (work4you_home / "real.json").write_text("{}")

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(work4you_home)}):
            missing = register_credential_files([
                {"path": "real.json", "name": "wrong.json"},
            ])

        assert missing == []
        mounts = get_credential_file_mounts()
        assert "real.json" in mounts[0]["container_path"]


class TestSkillsDirectoryMount:
    def test_returns_mount_when_skills_dir_exists(self, tmp_path):
        work4you_home = tmp_path / ".work4you"
        skills_dir = work4you_home / "skills"
        skills_dir.mkdir(parents=True)
        (skills_dir / "test-skill").mkdir()
        (skills_dir / "test-skill" / "SKILL.md").write_text("# test")

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(work4you_home)}):
            mounts = get_skills_directory_mount()

        assert len(mounts) >= 1
        assert mounts[0]["host_path"] == str(skills_dir)
        assert mounts[0]["container_path"] == "/root/.work4you/skills"


    def test_custom_container_base(self, tmp_path):
        work4you_home = tmp_path / ".work4you"
        (work4you_home / "skills").mkdir(parents=True)

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(work4you_home)}):
            mounts = get_skills_directory_mount(container_base="/home/user/.work4you")

        assert mounts[0]["container_path"] == "/home/user/.work4you/skills"

    def test_symlinks_are_sanitized(self, tmp_path):
        """Symlinks in skills dir should be excluded from the mount."""
        work4you_home = tmp_path / ".work4you"
        skills_dir = work4you_home / "skills"
        skills_dir.mkdir(parents=True)
        (skills_dir / "legit.md").write_text("# real skill")
        # Create a symlink pointing outside the skills tree
        secret = tmp_path / "secret.txt"
        secret.write_text("TOP SECRET")
        (skills_dir / "evil_link").symlink_to(secret)

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(work4you_home)}):
            mounts = get_skills_directory_mount()

        assert len(mounts) >= 1
        mount = mounts[0]
        # The mount path should be a sanitized copy, not the original
        safe_path = Path(mount["host_path"])
        assert safe_path != skills_dir
        # Legitimate file should be present
        assert (safe_path / "legit.md").exists()
        assert (safe_path / "legit.md").read_text() == "# real skill"
        # Symlink should NOT be present
        assert not (safe_path / "evil_link").exists()

    def test_no_symlinks_returns_original_dir(self, tmp_path):
        """When no symlinks exist, the original dir is returned (no copy)."""
        work4you_home = tmp_path / ".work4you"
        skills_dir = work4you_home / "skills"
        skills_dir.mkdir(parents=True)
        (skills_dir / "skill.md").write_text("ok")

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(work4you_home)}):
            mounts = get_skills_directory_mount()

        assert mounts[0]["host_path"] == str(skills_dir)


class TestIterSkillsFiles:
    def test_returns_files_skipping_symlinks(self, tmp_path):
        work4you_home = tmp_path / ".work4you"
        skills_dir = work4you_home / "skills"
        (skills_dir / "cat" / "myskill").mkdir(parents=True)
        (skills_dir / "cat" / "myskill" / "SKILL.md").write_text("# skill")
        (skills_dir / "cat" / "myskill" / "scripts").mkdir()
        (skills_dir / "cat" / "myskill" / "scripts" / "run.sh").write_text("#!/bin/bash")
        # Add a symlink that should be filtered
        secret = tmp_path / "secret"
        secret.write_text("nope")
        (skills_dir / "cat" / "myskill" / "evil").symlink_to(secret)

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(work4you_home)}):
            files = iter_skills_files()

        paths = {f["container_path"] for f in files}
        assert "/root/.work4you/skills/cat/myskill/SKILL.md" in paths
        assert "/root/.work4you/skills/cat/myskill/scripts/run.sh" in paths
        # Symlink should be excluded
        assert not any("evil" in f["container_path"] for f in files)

    def test_empty_when_no_skills_dir(self, tmp_path):
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(work4you_home)}):
            assert iter_skills_files() == []

class TestPathTraversalSecurity:
    """Path traversal and absolute path rejection.

    A malicious skill could declare::

        required_credential_files:
          - path: '../../.ssh/id_rsa'

    Without containment checks, this would mount the host's SSH private key
    into the container sandbox, leaking it to the skill's execution environment.
    """

    def test_dotdot_traversal_rejected(self, tmp_path, monkeypatch):
        """'../sensitive' must not escape WORK4YOU_HOME."""
        monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path / ".work4you"))
        (tmp_path / ".work4you").mkdir()

        # Create a sensitive file one level above work4you_home
        sensitive = tmp_path / "sensitive.json"
        sensitive.write_text('{"secret": "value"}')

        result = register_credential_file("../sensitive.json")

        assert result is False
        assert get_credential_file_mounts() == []

    def test_deep_traversal_rejected(self, tmp_path, monkeypatch):
        """'../../etc/passwd' style traversal must be rejected."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        # Create a fake sensitive file outside work4you_home
        ssh_dir = tmp_path / ".ssh"
        ssh_dir.mkdir()
        (ssh_dir / "id_rsa").write_text("PRIVATE KEY")

        result = register_credential_file("../../.ssh/id_rsa")

        assert result is False
        assert get_credential_file_mounts() == []

    def test_absolute_path_rejected(self, tmp_path, monkeypatch):
        """Absolute paths must be rejected regardless of whether they exist."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        # Create a file at an absolute path
        sensitive = tmp_path / "absolute.json"
        sensitive.write_text("{}")

        result = register_credential_file(str(sensitive))

        assert result is False
        assert get_credential_file_mounts() == []


    def test_nested_subdir_inside_work4you_home_allowed(self, tmp_path, monkeypatch):
        """Files in subdirectories of WORK4YOU_HOME must be allowed."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        subdir = work4you_home / "creds"
        subdir.mkdir()
        (subdir / "oauth.json").write_text("{}")
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        result = register_credential_file("creds/oauth.json")

        assert result is True

    def test_symlink_traversal_rejected(self, tmp_path, monkeypatch):
        """A symlink inside WORK4YOU_HOME pointing outside must be rejected."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        # Create a sensitive file outside work4you_home
        sensitive = tmp_path / "sensitive.json"
        sensitive.write_text('{"secret": "value"}')

        # Create a symlink inside work4you_home pointing outside
        symlink = work4you_home / "evil_link.json"
        try:
            symlink.symlink_to(sensitive)
        except (OSError, NotImplementedError):
            pytest.skip("Symlinks not supported on this platform")

        result = register_credential_file("evil_link.json")

        # The resolved path escapes WORK4YOU_HOME — must be rejected
        assert result is False
        assert get_credential_file_mounts() == []


# ---------------------------------------------------------------------------
# Config-based credential files — same containment checks
# ---------------------------------------------------------------------------

class TestConfigPathTraversal:
    """terminal.credential_files in config.yaml must also reject traversal."""

    def _write_config(self, work4you_home: Path, cred_files: list):
        import yaml
        config_path = work4you_home / "config.yaml"
        config_path.write_text(yaml.dump({"terminal": {"credential_files": cred_files}}))

    def test_config_traversal_rejected(self, tmp_path, monkeypatch):
        """'../secret' in config.yaml must not escape WORK4YOU_HOME."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        sensitive = tmp_path / "secret.json"
        sensitive.write_text("{}")
        self._write_config(work4you_home, ["../secret.json"])

        mounts = get_credential_file_mounts()
        host_paths = [m["host_path"] for m in mounts]
        assert str(sensitive) not in host_paths
        assert str(sensitive.resolve()) not in host_paths

    def test_config_absolute_path_rejected(self, tmp_path, monkeypatch):
        """Absolute paths in config.yaml must be rejected."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        sensitive = tmp_path / "abs.json"
        sensitive.write_text("{}")
        self._write_config(work4you_home, [str(sensitive)])

        mounts = get_credential_file_mounts()
        assert mounts == []

    def test_config_legitimate_file_works(self, tmp_path, monkeypatch):
        """Normal files inside WORK4YOU_HOME via config must still mount."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        (work4you_home / "oauth.json").write_text("{}")
        self._write_config(work4you_home, ["oauth.json"])

        mounts = get_credential_file_mounts()
        assert len(mounts) == 1
        assert "oauth.json" in mounts[0]["container_path"]


# ---------------------------------------------------------------------------
# Cache directory mounts
# ---------------------------------------------------------------------------

class TestCacheDirectoryMounts:
    """Tests for get_cache_directory_mounts() and iter_cache_files()."""

    def test_returns_existing_cache_dirs(self, tmp_path, monkeypatch):
        """Existing cache dirs are returned with correct container paths."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        (work4you_home / "cache" / "documents").mkdir(parents=True)
        (work4you_home / "cache" / "audio").mkdir(parents=True)
        (work4you_home / "cache" / "videos").mkdir(parents=True)
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        mounts = get_cache_directory_mounts()
        paths = {m["container_path"] for m in mounts}
        assert "/root/.work4you/cache/documents" in paths
        assert "/root/.work4you/cache/audio" in paths
        assert "/root/.work4you/cache/videos" in paths


    def test_legacy_dir_names_resolved(self, tmp_path, monkeypatch):
        """Old-style dir names (e.g. document_cache) are resolved correctly.

        Populates the legacy dirs with a sentinel file so they count as
        ``has content`` for ``get_work4you_dir``'s populated-legacy check
        (see #27602 — empty legacy stubs are no longer honoured).
        """
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        # Use legacy dir name with content — get_work4you_dir prefers
        # populated old over new.
        legacy_doc = work4you_home / "document_cache"
        legacy_img = work4you_home / "image_cache"
        legacy_doc.mkdir()
        legacy_img.mkdir()
        (legacy_doc / "cached.txt").write_bytes(b"x")
        (legacy_img / "cached.png").write_bytes(b"x")
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        mounts = get_cache_directory_mounts()
        host_paths = {m["host_path"] for m in mounts}
        assert str(work4you_home / "document_cache") in host_paths
        assert str(work4you_home / "image_cache") in host_paths
        # Container paths always use the new layout
        container_paths = {m["container_path"] for m in mounts}
        assert "/root/.work4you/cache/documents" in container_paths
        assert "/root/.work4you/cache/images" in container_paths

    def test_empty_work4you_home(self, tmp_path, monkeypatch):
        """Empty home → every staging dir is created and mounted (#76577).

        Docker snapshots the mount list at container creation; skipping
        not-yet-existing dirs meant the first attachment/clipboard file after
        container start dangled forever. All _CACHE_DIRS entries mount."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        mounts = get_cache_directory_mounts()
        container_paths = {m["container_path"] for m in mounts}
        assert "/root/.work4you/attachments" in container_paths
        assert "/root/.work4you/images" in container_paths
        assert "/root/.work4you/cache/images" in container_paths
        for mount in mounts:
            assert Path(mount["host_path"]).is_dir()

    def test_images_upload_dir_is_mounted(self, tmp_path, monkeypatch):
        """The flat top-level ``images/`` upload dir is mounted (#69575).

        Desktop / clipboard / PDF uploads land in ``WORK4YOU_HOME/images``, not
        under ``cache/``. Without this entry vision_analyze on a desktop upload
        fails because the file is not reachable inside the sandbox.
        """
        work4you_home = tmp_path / ".work4you"
        (work4you_home / "images").mkdir(parents=True)
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        mounts = get_cache_directory_mounts()
        by_container = {m["container_path"]: m["host_path"] for m in mounts}
        assert "/root/.work4you/images" in by_container
        assert by_container["/root/.work4you/images"] == str(work4you_home / "images")

    def test_images_upload_file_maps_into_container(self, tmp_path, monkeypatch):
        """A concrete upload under ``images/`` maps to its container path.

        This is the reverse mapping vision uses to translate a container-visible
        path back to the host mount; it must recognise the ``images/`` dir.
        """
        work4you_home = tmp_path / ".work4you"
        (work4you_home / "images").mkdir(parents=True)
        upload = work4you_home / "images" / "upload_20260722_181019_1.png"
        upload.write_bytes(bytes.fromhex("89504e470d0a1a0a"))
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        assert (
            map_cache_path_to_container(str(upload))
            == "/root/.work4you/images/upload_20260722_181019_1.png"
        )


class TestMapCachePathToContainer:
    """Tests for map_cache_path_to_container() — the backend-agnostic mapper."""

    def test_maps_path_under_cache_dir(self, tmp_path, monkeypatch):
        work4you_home = tmp_path / ".work4you"
        img_dir = work4you_home / "cache" / "images"
        img_dir.mkdir(parents=True)
        host_path = str(img_dir / "generated.png")
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        assert (
            map_cache_path_to_container(host_path)
            == "/root/.work4you/cache/images/generated.png"
        )


    def test_maps_path_even_when_cache_dir_missing(self, tmp_path, monkeypatch):
        """Missing staging dirs are auto-created at mount-list time (#76577):
        Docker snapshots mounts at container creation, so a dir that appears
        later would dangle for the container's whole life. The map must
        therefore succeed (and the dir exist) even before first use."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        mapped = map_cache_path_to_container(str(work4you_home / "cache" / "images" / "x.png"))
        assert mapped == "/root/.work4you/cache/images/x.png"
        assert (work4you_home / "cache" / "images").is_dir()


class TestToAgentVisiblePathPerBackend:
    """#76577 follow-up: translation covers every backend that relocates the
    Work4You cache — not just docker — and skips the ones where the host path
    stays correct (local; singularity auto-binds the host home)."""

    def _staged(self, tmp_path, monkeypatch):
        work4you_home = tmp_path / ".work4you"
        (work4you_home / "attachments").mkdir(parents=True)
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))
        return str(work4you_home / "attachments" / "drop.zip")

    def test_docker_maps_to_root_work4you(self, tmp_path, monkeypatch):
        staged = self._staged(tmp_path, monkeypatch)
        monkeypatch.setenv("TERMINAL_ENV", "docker")
        from tools.credential_files import to_agent_visible_cache_path
        assert to_agent_visible_cache_path(staged) == "/root/.work4you/attachments/drop.zip"

    def test_ssh_maps_to_tilde_work4you(self, tmp_path, monkeypatch):
        staged = self._staged(tmp_path, monkeypatch)
        monkeypatch.setenv("TERMINAL_ENV", "ssh")
        from tools.credential_files import to_agent_visible_cache_path
        assert to_agent_visible_cache_path(staged) == "~/.work4you/attachments/drop.zip"

    @pytest.mark.parametrize("backend", ["local", "singularity", ""])
    def test_untranslated_backends_keep_host_path(self, tmp_path, monkeypatch, backend):
        staged = self._staged(tmp_path, monkeypatch)
        monkeypatch.setenv("TERMINAL_ENV", backend)
        from tools.credential_files import to_agent_visible_cache_path
        assert to_agent_visible_cache_path(staged) == staged

    def test_non_cache_path_passes_through(self, tmp_path, monkeypatch):
        self._staged(tmp_path, monkeypatch)
        monkeypatch.setenv("TERMINAL_ENV", "docker")
        from tools.credential_files import to_agent_visible_cache_path
        assert to_agent_visible_cache_path("/etc/hosts") == "/etc/hosts"


class TestIterCacheFiles:
    """Tests for iter_cache_files()."""

    def test_enumerates_files(self, tmp_path, monkeypatch):
        """Regular files in cache dirs are returned."""
        work4you_home = tmp_path / ".work4you"
        doc_dir = work4you_home / "cache" / "documents"
        doc_dir.mkdir(parents=True)
        (doc_dir / "upload.zip").write_bytes(b"PK\x03\x04")
        (doc_dir / "report.pdf").write_bytes(b"%PDF-1.4")
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        entries = iter_cache_files()
        names = {Path(e["container_path"]).name for e in entries}
        assert "upload.zip" in names
        assert "report.pdf" in names

    def test_skips_symlinks(self, tmp_path, monkeypatch):
        """Symlinks inside cache dirs are skipped."""
        work4you_home = tmp_path / ".work4you"
        doc_dir = work4you_home / "cache" / "documents"
        doc_dir.mkdir(parents=True)
        real_file = doc_dir / "real.txt"
        real_file.write_text("content")
        (doc_dir / "link.txt").symlink_to(real_file)
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        entries = iter_cache_files()
        names = [Path(e["container_path"]).name for e in entries]
        assert "real.txt" in names
        assert "link.txt" not in names


    def test_empty_cache(self, tmp_path, monkeypatch):
        """No cache dirs → empty list."""
        work4you_home = tmp_path / ".work4you"
        work4you_home.mkdir()
        monkeypatch.setenv("WORK4YOU_HOME", str(work4you_home))

        assert iter_cache_files() == []


class TestMasterCredentialStoresAreNeverMountable:
    """Containment is not enough — WORK4YOU_HOME *is* where the keys live.

    ``required_credential_files`` is skill-declared frontmatter, and skills are
    installed from the hub. The traversal guard already stops
    ``../../.ssh/id_rsa`` from escaping WORK4YOU_HOME, but every master
    credential store sits *inside* it: a one-line declaration would otherwise
    bind-mount ``.env`` (every provider key) or ``auth.json`` (all provider
    tokens and OAuth grants) read-only into the sandbox the skill's own code
    runs in.

    The bar is the canonical read deny-list: whatever the agent is forbidden to
    ``read_file`` must not be mountable either, so the mount surface can't
    grant what the read surface denies.
    """

    @staticmethod
    def _home(tmp_path):
        home = tmp_path / ".work4you"
        home.mkdir()
        (home / ".env").write_text("OPENAI_API_KEY=sk-proj-REAL\n")
        (home / "auth.json").write_text('{"providers":{}}')
        (home / ".anthropic_oauth.json").write_text('{"refresh_token":"rt"}')
        (home / "webhook_subscriptions.json").write_text("{}")
        (home / "cache").mkdir()
        (home / "cache" / "bws_cache.json").write_text("{}")
        (home / "mcp-tokens").mkdir()
        (home / "mcp-tokens" / "srv.json").write_text('{"access_token":"t"}')
        (home / "google_token.json").write_text("{}")
        return home

    @pytest.mark.parametrize(
        "rel_path",
        [
            ".env",
            "auth.json",
            ".anthropic_oauth.json",
            "webhook_subscriptions.json",
            "cache/bws_cache.json",
            "mcp-tokens/srv.json",
        ],
    )
    def test_master_credential_store_is_refused(self, tmp_path, rel_path):
        home = self._home(tmp_path)
        with patch.dict(os.environ, {"WORK4YOU_HOME": str(home)}):
            assert register_credential_file(rel_path) is False, (
                f"{rel_path} would be bind-mounted into the sandbox"
            )
            assert get_credential_file_mounts() == []

    def test_per_service_token_still_mounts(self, tmp_path):
        """The module's legitimate purpose must keep working."""
        home = self._home(tmp_path)
        with patch.dict(os.environ, {"WORK4YOU_HOME": str(home)}):
            assert register_credential_file("google_token.json") is True
            mounts = get_credential_file_mounts()
        assert [m["container_path"] for m in mounts] == [
            "/root/.work4you/google_token.json"
        ]

    def test_refused_entry_does_not_block_the_rest_of_the_batch(self, tmp_path):
        home = self._home(tmp_path)
        with patch.dict(os.environ, {"WORK4YOU_HOME": str(home)}):
            missing = register_credential_files([".env", "google_token.json"])
            mounts = get_credential_file_mounts()

        paths = [m["container_path"] for m in mounts]
        assert "/root/.work4you/google_token.json" in paths
        assert "/root/.work4you/.env" not in paths
        assert ".env" in missing, "a refused store is reported back to the skill"

    def test_traversal_guard_still_applies(self, tmp_path):
        """The pre-existing containment check is untouched."""
        home = self._home(tmp_path)
        with patch.dict(os.environ, {"WORK4YOU_HOME": str(home)}):
            assert register_credential_file("../../.ssh/id_rsa") is False
            assert register_credential_file("/etc/passwd") is False

    def test_missing_guard_fails_closed_with_error_log(self, tmp_path, caplog):
        """If agent.file_safety can't be imported the mount is refused loudly.

        The fail-closed path must be observable (#67665): a silent deny with
        no diagnostic reproduces the trust gap the deny-list was added to fix.
        """
        import tools.credential_files as cf

        home = self._home(tmp_path)
        with patch.dict(os.environ, {"WORK4YOU_HOME": str(home)}), \
                patch.object(cf, "get_read_block_error", None):
            with caplog.at_level("ERROR", logger="tools.credential_files"):
                assert cf.register_credential_file("google_token.json") is False
            assert cf.get_credential_file_mounts() == []
        assert any("deny-list cannot be consulted" in r.message for r in caplog.records)

    def test_guard_exception_fails_closed_with_traceback(self, tmp_path, caplog):
        """A raising guard refuses the mount and logs the stack trace."""
        import tools.credential_files as cf

        home = self._home(tmp_path)

        def _boom(path):
            raise RuntimeError("guard exploded")

        with patch.dict(os.environ, {"WORK4YOU_HOME": str(home)}), \
                patch.object(cf, "get_read_block_error", _boom):
            with caplog.at_level("ERROR", logger="tools.credential_files"):
                assert cf.register_credential_file("google_token.json") is False
            assert cf.get_credential_file_mounts() == []
        rec = next(r for r in caplog.records if "read guard raised" in r.message)
        assert rec.exc_info is not None, "traceback must be attached (logger.exception)"
