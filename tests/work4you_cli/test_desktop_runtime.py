"""Prebuilt desktop runtime: relocate + apply contracts."""

from __future__ import annotations

import json
import os
import zipfile
from pathlib import Path

import pytest

from work4you_cli.desktop_runtime import (
    apply_prebuilt_runtime_bundle,
    detect_prebuilt_runtime_target,
    extract_prebuilt_runtime_zip,
    github_prebuilt_runtime_zip_url,
    is_prebuilt_runtime_root,
    is_prebuilt_runtime_zip,
    is_present_runtime_manifest,
    parse_runtime_manifest,
    rewrite_pyvenv_cfg,
    rewrite_runtime_symlinks,
    runtime_zip_name,
    seed_home_templates,
    stub_runtime_manifest,
    write_bootstrap_marker,
)
from work4you_cli.runtime_fingerprint import (
    FINGERPRINT_FILENAME,
    installed_runtime_is_current,
    parse_runtime_fingerprint,
    runtime_payload_fingerprint,
)
from work4you_cli.runtime_payload import read_runtime_ref


def test_rewrite_pyvenv_cfg_rewrites_windows_home_and_executable():
    original = (
        "home = C:\\Users\\runner\\AppData\\Local\\work4you\\python\n"
        "include-system-site-packages = false\n"
        "version = 3.11.13\n"
        "executable = C:\\Users\\runner\\AppData\\Local\\work4you\\python\\python.exe\n"
        "command = uv venv\n"
    )
    rewritten = rewrite_pyvenv_cfg(original, r"C:\Users\Ada\AppData\Local\work4you\python")
    assert "home = C:\\Users\\Ada\\AppData\\Local\\work4you\\python" in rewritten
    assert "executable = C:\\Users\\Ada\\AppData\\Local\\work4you\\python\\python.exe" in rewritten
    assert "include-system-site-packages = false" in rewritten
    assert "C:\\Users\\runner" not in rewritten


def test_rewrite_pyvenv_cfg_inserts_home_when_missing():
    rewritten = rewrite_pyvenv_cfg("version = 3.11.13\n", r"D:\work4you\python")
    assert rewritten.splitlines()[0] == "home = D:\\work4you\\python"
    assert "executable = D:\\work4you\\python\\python.exe" in rewritten


def test_present_manifest_requires_schema_and_flag():
    assert is_present_runtime_manifest(parse_runtime_manifest(stub_runtime_manifest())) is False
    assert (
        is_present_runtime_manifest(
            parse_runtime_manifest({"schemaVersion": 1, "present": True, "commit": "a" * 40})
        )
        is True
    )
    assert parse_runtime_manifest({"schemaVersion": 2, "present": True}) is None
    assert parse_runtime_manifest("nope") is None


def test_runtime_zip_url_and_name_are_arch_stable():
    assert runtime_zip_name("x64", platform="win32") == "runtime-win-x64.zip"
    assert runtime_zip_name("arm64", platform="win32") == "runtime-win-arm64.zip"
    assert runtime_zip_name("arm64", platform="darwin") == "runtime-darwin-arm64.zip"
    assert runtime_zip_name("x64", platform="darwin") == "runtime-darwin-x64.zip"
    assert github_prebuilt_runtime_zip_url(platform="win32").endswith(
        "/releases/latest/download/runtime-win-x64.zip"
    )
    assert github_prebuilt_runtime_zip_url(platform="darwin", arch="arm64").endswith(
        "/releases/latest/download/runtime-darwin-arm64.zip"
    )
    assert "/releases/download/desktop-v1.2.3/" in github_prebuilt_runtime_zip_url(
        tag="desktop-v1.2.3", arch="arm64", platform="win32"
    )


def test_rewrite_pyvenv_cfg_uses_posix_bin_python(tmp_path):
    python_home = tmp_path / "python"
    (python_home / "bin").mkdir(parents=True)
    (python_home / "bin" / "python3").write_text("", encoding="utf-8")
    rewritten = rewrite_pyvenv_cfg(
        "home = /builder/python\nexecutable = /builder/python/bin/python3\n",
        str(python_home),
    )
    assert f"home = {python_home}" in rewritten
    assert f"executable = {python_home / 'bin' / 'python3'}" in rewritten
    assert "/builder/" not in rewritten


def test_detect_prebuilt_runtime_target_skips_linux(monkeypatch):
    monkeypatch.setattr("work4you_cli.desktop_runtime.sys.platform", "linux")
    assert detect_prebuilt_runtime_target() is None
    monkeypatch.setattr("work4you_cli.desktop_runtime.sys.platform", "darwin")
    monkeypatch.setattr(
        "work4you_cli.desktop_runtime.os.uname",
        lambda: type("U", (), {"machine": "arm64"})(),
    )
    assert detect_prebuilt_runtime_target() == ("darwin", "arm64")


def _write_bundle(root: Path, *, commit: str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") -> Path:
    work4you = root / "work4you"
    (work4you / "work4you_cli").mkdir(parents=True)
    (work4you / "work4you_cli" / "__init__.py").write_text("__version__ = '0.0.0'\n", encoding="utf-8")
    (work4you / "cli-config.yaml.example").write_text("model: {}\n", encoding="utf-8")
    (work4you / "venv").mkdir()
    (work4you / "venv" / "pyvenv.cfg").write_text(
        "home = C:\\Users\\runner\\python\nexecutable = C:\\Users\\runner\\python\\python.exe\n",
        encoding="utf-8",
    )
    scripts = work4you / "venv" / "Scripts"
    scripts.mkdir()
    (scripts / "work4you.exe").write_bytes(b"launcher")
    (scripts / "python.exe").write_bytes(b"py")
    (root / "python").mkdir()
    (root / "python" / "python.exe").write_bytes(b"py")
    (root / "node").mkdir()
    (root / "node" / "node.exe").write_bytes(b"node")
    (root / "bin").mkdir()
    (root / "bin" / "uv.exe").write_bytes(b"uv")
    (root / "manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "present": True,
                "commit": commit,
                "branch": "main",
                "arch": "x64",
            }
        ),
        encoding="utf-8",
    )
    return root


def test_apply_prebuilt_runtime_relocates_and_preserves_home_secrets(tmp_path):
    bundle = _write_bundle(tmp_path / "bundle")
    home = tmp_path / "home"
    home.mkdir()
    (home / ".env").write_text("TELEGRAM_BOT_TOKEN=keep-me\n", encoding="utf-8")
    (home / "config.yaml").write_text("keep: true\n", encoding="utf-8")

    install = apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="b" * 40)
    assert install == home / "work4you"
    assert (install / "work4you_cli" / "__init__.py").is_file()
    cfg = (install / "venv" / "pyvenv.cfg").read_text(encoding="utf-8")
    assert str(home / "python") in cfg
    assert r"C:\Users\runner" not in cfg
    assert (home / ".env").read_text(encoding="utf-8") == "TELEGRAM_BOT_TOKEN=keep-me\n"
    assert (home / "config.yaml").read_text(encoding="utf-8") == "keep: true\n"
    assert (home / "SOUL.md").is_file()
    assert (install / ".install_method").read_text(encoding="utf-8").strip() == "desktop"
    assert read_runtime_ref(install)["commit"] == "b" * 40
    marker = json.loads((install / ".work4you-bootstrap-complete").read_text(encoding="utf-8"))
    assert marker["schemaVersion"] == 1
    assert marker["pinnedCommit"] == "b" * 40
    assert (home / "work4you" / "bin" / "work4you.exe").is_file()
    assert (home / "node" / "node.exe").is_file()
    assert (home / "bin" / "uv.exe").is_file()


def test_seed_home_templates_does_not_clobber(tmp_path):
    home = tmp_path / "home"
    install = tmp_path / "install"
    install.mkdir()
    home.mkdir()
    (home / ".env").write_text("EXISTING=1\n", encoding="utf-8")
    seed_home_templates(home, install)
    assert (home / ".env").read_text(encoding="utf-8") == "EXISTING=1\n"
    assert (home / "sessions").is_dir()
    assert (home / "SOUL.md").is_file()


def test_is_prebuilt_runtime_zip_rejects_source_archive(tmp_path):
    source = tmp_path / "source.zip"
    with zipfile.ZipFile(source, "w") as zf:
        zf.writestr("FORK-56-main/work4you_cli/__init__.py", "x")
        zf.writestr("FORK-56-main/pyproject.toml", "[project]\n")
    assert is_prebuilt_runtime_zip(source) is False


def test_is_prebuilt_runtime_zip_and_extract(tmp_path):
    bundle = _write_bundle(tmp_path / "bundle")
    zip_path = tmp_path / "runtime-win-x64.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for path in bundle.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(bundle).as_posix())
    assert is_prebuilt_runtime_zip(zip_path) is True
    extracted = extract_prebuilt_runtime_zip(zip_path, tmp_path / "out")
    assert is_prebuilt_runtime_root(extracted)


def test_write_bootstrap_marker_rejects_short_commit_via_apply(tmp_path):
    bundle = _write_bundle(tmp_path / "bundle", commit="abc")
    home = tmp_path / "home"
    apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="abc")
    assert not (home / "work4you" / ".work4you-bootstrap-complete").exists()
    write_bootstrap_marker(home / "work4you", pinned_commit="abcdefg")
    assert (home / "work4you" / ".work4you-bootstrap-complete").is_file()


def test_apply_posix_bundle_writes_install_bin_launcher(tmp_path):
    bundle = tmp_path / "bundle"
    work4you = bundle / "work4you"
    (work4you / "work4you_cli").mkdir(parents=True)
    (work4you / "work4you_cli" / "__init__.py").write_text("__version__ = '0.0.0'\n", encoding="utf-8")
    (work4you / "venv" / "bin").mkdir(parents=True)
    (work4you / "venv" / "pyvenv.cfg").write_text(
        "home = /builder/python\nexecutable = /builder/python/bin/python3\n",
        encoding="utf-8",
    )
    (work4you / "venv" / "bin" / "work4you").write_text("#!/bin/sh\n", encoding="utf-8")
    python_home = bundle / "python" / "bin"
    python_home.mkdir(parents=True)
    (python_home / "python3").write_text("", encoding="utf-8")
    (bundle / "manifest.json").write_text(
        json.dumps({"schemaVersion": 1, "present": True, "commit": "c" * 40, "branch": "main"}),
        encoding="utf-8",
    )
    home = tmp_path / "home"
    install = apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="c" * 40)
    assert (install / "bin" / "work4you").is_file()
    cfg = (install / "venv" / "pyvenv.cfg").read_text(encoding="utf-8")
    assert str(home / "python") in cfg
    assert "bin/python3" in cfg
    assert "/builder/" not in cfg


def test_parse_runtime_fingerprint_accepts_64_hex_only():
    assert parse_runtime_fingerprint("A" * 64) == "a" * 64
    assert parse_runtime_fingerprint("  " + "b" * 64 + "\n") == "b" * 64
    assert parse_runtime_fingerprint(None) is None
    assert parse_runtime_fingerprint("not-a-fingerprint") is None
    assert parse_runtime_fingerprint("c" * 63) is None


def test_runtime_fingerprint_ignores_markers_and_venv(tmp_path):
    bundle = _write_bundle(tmp_path / "bundle")
    home = tmp_path / "home"
    apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="b" * 40)
    left = runtime_payload_fingerprint(bundle / "work4you", bundle / "python", bundle / "node")
    right = runtime_payload_fingerprint(home / "work4you", home / "python", home / "node")
    assert left == right
    assert installed_runtime_is_current(bundle, home) is True
    marker = home / "work4you" / FINGERPRINT_FILENAME
    assert marker.is_file()
    assert parse_runtime_fingerprint(marker.read_text(encoding="utf-8")) == left
    (home / "work4you" / ".runtime-ref").write_text("changed\n", encoding="utf-8")
    (home / "work4you" / FINGERPRINT_FILENAME).write_text("changed\n", encoding="utf-8")
    (home / "work4you" / "venv" / "junk.bin").write_bytes(b"venv-only")
    assert installed_runtime_is_current(bundle, home) is True


def test_apply_prebuilt_skips_copy_when_payload_matches(tmp_path):
    bundle = _write_bundle(tmp_path / "bundle")
    home = tmp_path / "home"
    apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="b" * 40)
    (home / "python" / "CANARY.txt").write_text("keep\n", encoding="utf-8")
    apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="c" * 40)
    assert (home / "python" / "CANARY.txt").read_text(encoding="utf-8") == "keep\n"
    assert read_runtime_ref(home / "work4you")["commit"] == "c" * 40
    assert parse_runtime_fingerprint(
        (home / "work4you" / FINGERPRINT_FILENAME).read_text(encoding="utf-8")
    )


def test_apply_prebuilt_copies_when_source_changes(tmp_path):
    bundle = _write_bundle(tmp_path / "bundle")
    home = tmp_path / "home"
    apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="b" * 40)
    (home / "python" / "CANARY.txt").write_text("keep\n", encoding="utf-8")
    (bundle / "work4you" / "work4you_cli" / "__init__.py").write_text(
        "__version__ = '0.0.1'\n", encoding="utf-8"
    )
    apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="b" * 40)
    assert not (home / "python" / "CANARY.txt").exists()
    assert "__version__ = '0.0.1'" in (home / "work4you" / "work4you_cli" / "__init__.py").read_text(
        encoding="utf-8"
    )


def test_apply_prebuilt_force_replaces_matching_payload(tmp_path):
    bundle = _write_bundle(tmp_path / "bundle")
    home = tmp_path / "home"
    apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="b" * 40)
    (home / "python" / "CANARY.txt").write_text("keep\n", encoding="utf-8")
    apply_prebuilt_runtime_bundle(bundle, home, pinned_commit="b" * 40, force=True)
    assert not (home / "python" / "CANARY.txt").exists()


def test_installed_runtime_is_current_false_when_home_empty(tmp_path):
    bundle = _write_bundle(tmp_path / "bundle")
    assert installed_runtime_is_current(bundle, tmp_path / "missing") is False


@pytest.mark.linux_only
def test_rewrite_runtime_symlinks_converts_absolute_inside_link(tmp_path):
    root = tmp_path / "runtime"
    target = root / "python" / "bin" / "python3"
    target.parent.mkdir(parents=True)
    target.write_text("#!/bin/sh\n", encoding="utf-8")
    target.chmod(0o755)
    link = root / "work4you" / "venv" / "bin" / "python"
    link.parent.mkdir(parents=True)
    link.symlink_to(target)
    assert os.path.isabs(os.readlink(link))

    changed = rewrite_runtime_symlinks(root)
    assert "work4you/venv/bin/python" in changed
    raw = os.readlink(link)
    assert not os.path.isabs(raw)
    assert (link.parent / raw).resolve() == target.resolve()


@pytest.mark.linux_only
def test_rewrite_runtime_symlinks_copies_outside_file(tmp_path):
    root = tmp_path / "runtime"
    root.mkdir()
    outside = tmp_path / "builder" / "uv"
    outside.parent.mkdir()
    outside.write_text("#!/bin/sh\n", encoding="utf-8")
    outside.chmod(0o755)
    link = root / "bin" / "uv"
    link.parent.mkdir()
    link.symlink_to(outside)

    changed = rewrite_runtime_symlinks(root)
    assert "bin/uv" in changed
    assert not link.is_symlink()
    assert link.is_file()
    assert link.read_text(encoding="utf-8") == "#!/bin/sh\n"


@pytest.mark.linux_only
def test_rewrite_runtime_symlinks_materializes_outside_dir(tmp_path):
    """uv's CPython prefix is often a symlink; cp -a would copy the link."""
    real = tmp_path / "cpython-3.11.16"
    (real / "bin").mkdir(parents=True)
    (real / "bin" / "python3").write_text("#!/bin/sh\n", encoding="utf-8")
    (real / "bin" / "python3").chmod(0o755)
    alias = tmp_path / "cpython-3.11"
    alias.symlink_to(real)
    root = tmp_path / "runtime"
    root.mkdir()
    python = root / "python"
    python.symlink_to(alias)

    changed = rewrite_runtime_symlinks(root)
    assert "python" in changed
    assert python.is_dir()
    assert not python.is_symlink()
    assert (python / "bin" / "python3").is_file()


@pytest.mark.linux_only
def test_rewrite_runtime_symlinks_rejects_broken_link(tmp_path):
    root = tmp_path / "runtime"
    link = root / "bin" / "missing"
    link.parent.mkdir(parents=True)
    link.symlink_to(root / "no-such-file")
    with pytest.raises(ValueError, match="broken symlink"):
        rewrite_runtime_symlinks(root)


def test_is_prebuilt_runtime_root_requires_python_and_work4you(tmp_path):
    root = tmp_path / "partial"
    root.mkdir()
    (root / "manifest.json").write_text(
        json.dumps({"schemaVersion": 1, "present": True}), encoding="utf-8"
    )
    (root / "work4you").mkdir()
    assert is_prebuilt_runtime_root(root) is False
