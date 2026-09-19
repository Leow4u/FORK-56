"""Tests for scripts/ci/pack_desktop_chrome_zip.py.

Pack talks only to the filesystem. The chrome zip is win-unpacked minus
``resources/runtime``; site Setup.exe stays fat.
"""

from __future__ import annotations

import importlib.util
import zipfile
from pathlib import Path

import pytest

_PATH = Path(__file__).resolve().parents[2] / "scripts" / "ci" / "pack_desktop_chrome_zip.py"
_spec = importlib.util.spec_from_file_location("pack_desktop_chrome_zip", _PATH)
if _spec is None or _spec.loader is None:
    raise ImportError("Failed to load pack_desktop_chrome_zip.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def _write_unpacked(root: Path) -> Path:
    unpacked = root / "win-unpacked"
    (unpacked / "locales").mkdir(parents=True)
    (unpacked / "resources" / "runtime" / "work4you").mkdir(parents=True)
    (unpacked / "Work4You.exe").write_bytes(b"electron-exe")
    (unpacked / "resources" / "app.asar").write_bytes(b"asar")
    (unpacked / "resources" / "install-stamp.json").write_text('{"commit":"a"}\n', encoding="utf-8")
    (unpacked / "resources" / "runtime" / "work4you" / "marker.py").write_text("payload\n", encoding="utf-8")
    (unpacked / "locales" / "en-US.pak").write_bytes(b"pak")
    return unpacked


def test_is_runtime_extra_resource_matches_prefix_only():
    assert mod.is_runtime_extra_resource("resources/runtime") is True
    assert mod.is_runtime_extra_resource("resources/runtime/work4you/cli.py") is True
    assert mod.is_runtime_extra_resource("resources/app.asar") is False
    assert mod.is_runtime_extra_resource("resources/runtime-notes.txt") is False


def test_pack_omits_embedded_runtime_and_keeps_chrome(tmp_path):
    unpacked = _write_unpacked(tmp_path)
    dest = tmp_path / "Work4You-win-x64.zip"
    packed = mod.pack_desktop_chrome_zip(unpacked, dest)
    assert packed == dest
    names = set(mod.chrome_zip_members(dest))
    assert "Work4You.exe" in names
    assert "resources/app.asar" in names
    assert "resources/install-stamp.json" in names
    assert "locales/en-US.pak" in names
    assert not any(name == "resources/runtime" or name.startswith("resources/runtime/") for name in names)
    with zipfile.ZipFile(dest) as zf:
        assert zf.read("Work4You.exe") == b"electron-exe"


def test_pack_fails_when_unpacked_missing_exe(tmp_path):
    unpacked = tmp_path / "empty"
    unpacked.mkdir()
    with pytest.raises(ValueError, match="Work4You.exe"):
        mod.pack_desktop_chrome_zip(unpacked, tmp_path / "out.zip")


def test_pack_fails_when_unpacked_missing(tmp_path):
    with pytest.raises(ValueError, match="missing"):
        mod.pack_desktop_chrome_zip(tmp_path / "nope", tmp_path / "out.zip")


def test_write_runtime_fingerprint_asset_is_64_hex(tmp_path):
    runtime = tmp_path / "runtime"
    (runtime / "work4you" / "work4you_cli").mkdir(parents=True)
    (runtime / "work4you" / "work4you_cli" / "__init__.py").write_text("__version__='0'\n", encoding="utf-8")
    (runtime / "python").mkdir()
    (runtime / "python" / "python.exe").write_bytes(b"py")
    (runtime / "node").mkdir()
    (runtime / "node" / "node.exe").write_bytes(b"node")
    dest = tmp_path / "runtime-win-x64.fingerprint"
    written = mod.write_runtime_fingerprint_asset(runtime, dest)
    assert written == dest
    text = dest.read_text(encoding="utf-8").strip()
    assert len(text) == 64
    assert all(char in "0123456789abcdef" for char in text)


def test_main_packs_zip_and_fingerprint(tmp_path):
    unpacked = _write_unpacked(tmp_path)
    runtime = tmp_path / "runtime"
    (runtime / "work4you" / "work4you_cli").mkdir(parents=True)
    (runtime / "work4you" / "work4you_cli" / "__init__.py").write_text("x\n", encoding="utf-8")
    (runtime / "python").mkdir()
    (runtime / "python" / "python.exe").write_bytes(b"py")
    zip_out = tmp_path / "Work4You-win-x64.zip"
    fp_out = tmp_path / "runtime-win-x64.fingerprint"
    assert (
        mod.main(
            [
                "--unpacked",
                str(unpacked),
                "--out",
                str(zip_out),
                "--runtime-dir",
                str(runtime),
                "--fingerprint-out",
                str(fp_out),
            ]
        )
        == 0
    )
    assert zip_out.is_file()
    assert fp_out.is_file()


def test_main_fingerprint_out_requires_runtime_dir(tmp_path):
    unpacked = _write_unpacked(tmp_path)
    assert (
        mod.main(
            [
                "--unpacked",
                str(unpacked),
                "--out",
                str(tmp_path / "out.zip"),
                "--fingerprint-out",
                str(tmp_path / "fp"),
            ]
        )
        == 1
    )
