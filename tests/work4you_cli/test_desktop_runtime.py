"""Prebuilt desktop runtime: relocate + apply contracts."""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

from work4you_cli.desktop_runtime import (
    apply_prebuilt_runtime_bundle,
    extract_prebuilt_runtime_zip,
    github_prebuilt_runtime_zip_url,
    is_prebuilt_runtime_root,
    is_prebuilt_runtime_zip,
    is_present_runtime_manifest,
    parse_runtime_manifest,
    rewrite_pyvenv_cfg,
    runtime_zip_name,
    seed_home_templates,
    stub_runtime_manifest,
    write_bootstrap_marker,
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
    assert runtime_zip_name("x64") == "runtime-win-x64.zip"
    assert runtime_zip_name("arm64") == "runtime-win-arm64.zip"
    assert github_prebuilt_runtime_zip_url().endswith("/releases/latest/download/runtime-win-x64.zip")
    assert "/releases/download/desktop-v1.2.3/" in github_prebuilt_runtime_zip_url(
        tag="desktop-v1.2.3", arch="arm64"
    )


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
    assert "runner" not in cfg
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


def test_is_prebuilt_runtime_root_requires_python_and_work4you(tmp_path):
    root = tmp_path / "partial"
    root.mkdir()
    (root / "manifest.json").write_text(
        json.dumps({"schemaVersion": 1, "present": True}), encoding="utf-8"
    )
    (root / "work4you").mkdir()
    assert is_prebuilt_runtime_root(root) is False
