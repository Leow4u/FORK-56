"""Desktop runtime payload allowlist + ZIP extract contract."""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path
from unittest.mock import patch

from work4you_cli import runtime_payload as rp


def _write_github_zip(path: Path, files: dict[str, bytes], root: str = "FORK-56-main") -> None:
    with zipfile.ZipFile(path, "w") as zf:
        for name, data in files.items():
            zf.writestr(f"{root}/{name}", data)


def test_spec_json_matches_module_lists():
    spec = json.loads(rp.spec_path().read_text(encoding="utf-8"))
    assert set(spec["directories"]) == set(rp.runtime_directories())
    assert set(spec["files"]) == set(rp.runtime_files())
    assert spec["include_root_python_modules"] is True


def test_is_runtime_payload_path_keeps_runtime_and_drops_monorepo_noise():
    assert rp.is_runtime_payload_path("agent/loop.py")
    assert rp.is_runtime_payload_path("work4you_cli/main.py")
    assert rp.is_runtime_payload_path("run_agent.py")
    assert rp.is_runtime_payload_path("pyproject.toml")
    assert rp.is_runtime_payload_path("README.md")
    assert not rp.is_runtime_payload_path("web/src/index.tsx")
    assert not rp.is_runtime_payload_path("website/docs/index.md")
    assert not rp.is_runtime_payload_path("tests/conftest.py")
    assert not rp.is_runtime_payload_path("apps/desktop/package.json")
    assert not rp.is_runtime_payload_path("package.json")
    assert not rp.is_runtime_payload_path("../agent/x.py")


def test_strip_archive_root_drops_github_prefix():
    assert rp.strip_archive_root("FORK-56-main/agent/x.py") == "agent/x.py"
    assert rp.strip_archive_root("FORK-56-main/") is None
    assert rp.strip_archive_root("FORK-56-main/../etc/passwd") is None


def test_extract_runtime_zip_filters_and_preserves_nothing_from_excluded_trees(tmp_path):
    zip_path = tmp_path / "src.zip"
    _write_github_zip(
        zip_path,
        {
            "agent/loop.py": b"print('agent')\n",
            "run_agent.py": b"ROOT = True\n",
            "pyproject.toml": b"[project]\nname='work4you'\n",
            "web/src/app.tsx": b"export default 1\n",
            "website/docs/x.md": b"# docs\n",
            "tests/test_x.py": b"def test_x(): pass\n",
            "apps/desktop/package.json": b"{}\n",
            "package.json": b"{}\n",
        },
    )
    dest = tmp_path / "payload"
    written = rp.extract_runtime_zip(zip_path, dest)
    assert (dest / "agent" / "loop.py").read_text() == "print('agent')\n"
    assert (dest / "run_agent.py").read_text() == "ROOT = True\n"
    assert (dest / "pyproject.toml").exists()
    assert not (dest / "web").exists()
    assert not (dest / "website").exists()
    assert not (dest / "tests").exists()
    assert not (dest / "apps").exists()
    assert not (dest / "package.json").exists()
    assert "agent/loop.py" in written
    assert all(not path.startswith("web/") for path in written)


def test_extract_runtime_zip_rejects_zip_slip(tmp_path):
    zip_path = tmp_path / "slip.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        # GitHub-style root + traversal after the first component.
        info = zipfile.ZipInfo("FORK-56-main/../evil.py")
        zf.writestr(info, b"nope")
    dest = tmp_path / "payload"
    written = rp.extract_runtime_zip(zip_path, dest)
    assert written == []
    assert not (tmp_path / "evil.py").exists()


def test_extract_runtime_zip_rejects_symlink_member(tmp_path):
    zip_path = tmp_path / "link.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        info = zipfile.ZipInfo("FORK-56-main/run_agent.py")
        info.external_attr = (0o120777 & 0o170000) << 16
        zf.writestr(info, b"/tmp/target")
    dest = tmp_path / "payload"
    try:
        rp.extract_runtime_zip(zip_path, dest)
        raise AssertionError("expected symlink member to be refused")
    except ValueError as exc:
        assert "symlink" in str(exc)


def test_write_and_compare_runtime_ref(tmp_path):
    rp.write_runtime_ref(tmp_path, commit="a" * 40, branch="main")
    recorded = rp.read_runtime_ref(tmp_path)
    assert recorded is not None
    assert recorded["commit"] == "a" * 40
    assert rp.compare_runtime_ref(tmp_path, fetch_sha=lambda _ref: "a" * 40) == 0
    assert rp.compare_runtime_ref(tmp_path, fetch_sha=lambda _ref: "b" * 40) == -1
    assert rp.compare_runtime_ref(tmp_path, fetch_sha=lambda _ref: None) is None


def test_list_payload_top_level_and_preserve_names(tmp_path):
    (tmp_path / "agent").mkdir()
    (tmp_path / "run_agent.py").write_text("x\n", encoding="utf-8")
    (tmp_path / "web").mkdir()
    (tmp_path / "venv").mkdir()
    assert rp.list_payload_top_level(tmp_path) == ["agent", "run_agent.py"]
    assert "venv" in rp.preserve_names()
    assert ".runtime-ref" in rp.preserve_names()


def test_github_archive_url_precedence():
    assert rp.github_archive_url(commit="abc123").endswith("/archive/abc123.zip")
    assert "/refs/tags/v1.0.0.zip" in rp.github_archive_url(tag="v1.0.0")
    assert "/refs/heads/main.zip" in rp.github_archive_url(branch="main")


def test_detect_install_method_honours_desktop_stamp(tmp_path):
    (tmp_path / ".install_method").write_text("desktop\n", encoding="utf-8")
    with patch("work4you_cli.config.get_managed_system", return_value=None), patch(
        "work4you_cli.config.get_work4you_home", return_value=tmp_path
    ):
        from work4you_cli.config import detect_install_method

        assert detect_install_method(project_root=tmp_path) == "desktop"


def test_detect_install_method_does_not_convert_git_checkout(tmp_path):
    (tmp_path / ".git").mkdir()
    with patch("work4you_cli.config.get_managed_system", return_value=None), patch(
        "work4you_cli.config.get_work4you_home", return_value=tmp_path
    ):
        from work4you_cli.config import detect_install_method

        assert detect_install_method(project_root=tmp_path) == "git"


def test_fetch_github_commit_sha_uses_injected_opener():
    payload = json.dumps({"sha": "c" * 40}).encode("utf-8")

    def opener(_url: str):
        return io.BytesIO(payload)

    assert rp.fetch_github_commit_sha("Leow4u/FORK-56", "main", opener=opener) == "c" * 40
