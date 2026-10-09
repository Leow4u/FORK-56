"""App-owned payload launchers and relocation failure recovery."""

from __future__ import annotations

import importlib.util
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

import pytest

from work4you_cli.desktop_runtime import write_app_runtime_launchers


def _build_helper(filename):
    path = Path(__file__).resolve().parents[2] / "scripts/ci" / filename
    spec = importlib.util.spec_from_file_location(filename.replace("-", "_"), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.skipif(os.name == "nt", reason="POSIX launcher; Windows uses native installer smoke")
def test_app_cli_runs_after_relocation_preserving_home_and_arguments(tmp_path):
    original = tmp_path / "builder"
    interpreter = original / "python/bin/python3"
    interpreter.parent.mkdir(parents=True)
    interpreter.symlink_to(sys.executable)
    package = original / "work4you/work4you_cli"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    (package / "main.py").write_text(
        "import json,os,sys,subprocess\n"
        "print(json.dumps({'args':sys.argv[1:],'home':os.environ['WORK4YOU_HOME'],"
        "'bundle':os.environ['WORK4YOU_BUNDLED_RUNTIME'],'venv':os.environ.get('VIRTUAL_ENV'),"
        "'tools':{name:subprocess.check_output([name],text=True).strip() "
        "for name in ['bundle-tool','node-tool','python-tool','host-tool']}}))\n"
    )
    write_app_runtime_launchers(original, windows=False)
    host_tools = tmp_path / "host tools"
    for directory, name, output in (
        (host_tools, "bundle-tool", "wrong host version"),
        (host_tools, "node-tool", "wrong host version"),
        (host_tools, "python-tool", "wrong host version"),
        (host_tools, "host-tool", "preserved host tool"),
        (original / "bin", "bundle-tool", "bundled tool"),
        (original / "node/bin", "node-tool", "bundled node"),
        (original / "python/bin", "python-tool", "bundled python"),
    ):
        directory.mkdir(parents=True, exist_ok=True)
        tool = directory / name
        tool.write_text(f"#!/bin/sh\nprintf '%s\\n' '{output}'\n")
        tool.chmod(0o755)
    relocated = tmp_path / "Application with espaço"
    shutil.move(str(original), relocated)
    data_home = tmp_path / "Existing user data"
    data_home.mkdir()
    (data_home / "sessions.db").write_bytes(b"existing database")
    result = subprocess.run(
        [str(relocated / "bin/work4you"), "a b", "$(echo not-executed)", "--version"],
        cwd=tmp_path, env={**os.environ, "WORK4YOU_HOME": str(data_home), "VIRTUAL_ENV": "/missing/builder",
                          "PATH": str(host_tools) + os.pathsep + os.environ["PATH"]},
        capture_output=True, text=True, check=True,
    )
    value = json.loads(result.stdout)
    assert value["args"] == ["a b", "$(echo not-executed)", "--version"]
    assert value["bundle"] == str(relocated)
    assert value["home"] == str(data_home)
    assert value["venv"] is None
    assert value["tools"] == {"bundle-tool": "bundled tool", "node-tool": "bundled node",
                              "python-tool": "bundled python", "host-tool": "preserved host tool"}
    assert (data_home / "sessions.db").read_bytes() == b"existing database"
    assert not list(relocated.rglob("__pycache__"))


@pytest.mark.skipif(os.name == "nt", reason="POSIX permission restoration")
def test_failed_relocation_probe_restores_build_tree_and_permissions(tmp_path):
    helper = _build_helper("prepare_desktop_runtime.py")
    runtime = tmp_path / "runtime"
    interpreter = runtime / "python/bin/python3"
    interpreter.parent.mkdir(parents=True)
    interpreter.symlink_to(sys.executable)
    marker = runtime / "build-marker"
    marker.write_text("intact")
    before = marker.stat().st_mode
    # A host Python masquerading as the bundled interpreter must fail the
    # sys.base_prefix provenance check, not accidentally pass on builder deps.
    with pytest.raises(subprocess.CalledProcessError):
        helper.verify_relocation(runtime)
    assert marker.read_text() == "intact"
    assert marker.stat().st_mode == before
    assert interpreter.is_symlink()


def test_ffmpeg_extraction_keeps_binary_and_license_without_installing_python_package(tmp_path):
    helper = _build_helper("build-desktop-core-tools.py")
    wheel = tmp_path / "ffmpeg.whl"
    with zipfile.ZipFile(wheel, "w") as archive:
        archive.writestr("imageio_ffmpeg/binaries/ffmpeg-linux-v7", b"native binary")
        archive.writestr("imageio_ffmpeg/binaries/COPYING", "FFmpeg license")
        archive.writestr("imageio_ffmpeg/__init__.py", "not installed")
    runtime = tmp_path / "runtime"
    binary = helper.extract_ffmpeg(wheel, runtime, windows=False)
    assert binary.read_bytes() == b"native binary"
    assert (runtime / "licenses/ffmpeg/COPYING").read_text() == "FFmpeg license"
    assert not list(runtime.rglob("__init__.py"))


def test_core_tool_checksum_mismatch_removes_untrusted_download(tmp_path):
    helper = _build_helper("build-desktop-core-tools.py")
    source = tmp_path / "source.bin"
    source.write_bytes(b"unexpected upstream bytes")
    destination = tmp_path / "downloaded.exe"
    with pytest.raises(RuntimeError, match="Checksum mismatch"):
        helper.download(source.as_uri(), destination, "0" * 64)
    assert not destination.exists()


def _crt_fixture(installation, version, *, complete=True):
    directory = installation / "VC/Redist/MSVC" / version / "x64/Microsoft.VC143.CRT"
    directory.mkdir(parents=True)
    names = ["msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll", "concrt140.dll"]
    for name in names if complete else names[:1]:
        (directory / name).write_bytes(f"fixture CRT {version}: {name}".encode())
    return directory


def _verified_crt_fixture(files):
    # Native Authenticode trust is verified on Windows, not simulated here.
    # This adapter isolates the copy/inventory contract from that OS API.
    return [dict(path=str(path.resolve()), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                 fileVersion="14.44.1", signer="fixture", signerThumbprint="fixture") for path in files]


def test_vc_redist_selection_uses_one_complete_newest_architecture_set(tmp_path):
    helper = _build_helper("build-desktop-core-tools.py")
    installation = tmp_path / "Visual Studio"
    _crt_fixture(installation, "14.9.1")
    expected = _crt_fixture(installation, "14.44.1")
    _crt_fixture(installation, "14.99.0", complete=False)
    assert helper.find_visual_cpp_redist([installation], "x64") == expected
    with pytest.raises(RuntimeError, match="complete arm64"):
        helper.find_visual_cpp_redist([installation], "arm64")


def test_vc_redist_copies_entire_verified_set_with_relocatable_provenance(tmp_path, monkeypatch):
    helper = _build_helper("build-desktop-core-tools.py")
    source = _crt_fixture(tmp_path / "VS", "14.44.1")
    monkeypatch.setattr(helper, "verified_microsoft_dlls", _verified_crt_fixture)
    runtime = tmp_path / "app/runtime"
    result = helper.copy_visual_cpp_redist(source, runtime)
    assert result["version"] == "14.44.1"
    assert result["architecture"] == "x64"
    assert result["msvcp"] == "python/msvcp140.dll"
    assert {Path(record["path"]).name for record in result["files"]} == {path.name for path in source.glob("*.dll")}
    for record in result["files"]:
        assert not Path(record["path"]).is_absolute()
        assert hashlib.sha256((runtime / record["path"]).read_bytes()).hexdigest() == record["sha256"]


def test_unverified_vc_redist_does_not_replace_existing_python_runtime(tmp_path, monkeypatch):
    helper = _build_helper("build-desktop-core-tools.py")
    source = _crt_fixture(tmp_path / "VS", "14.44.1")
    runtime = tmp_path / "app/runtime"
    target = runtime / "python/vcruntime140.dll"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"original Python runtime")

    def reject(_files):
        raise RuntimeError("invalid Microsoft signature")

    monkeypatch.setattr(helper, "verified_microsoft_dlls", reject)
    with pytest.raises(RuntimeError, match="invalid Microsoft signature"):
        helper.copy_visual_cpp_redist(source, runtime)
    assert target.read_bytes() == b"original Python runtime"
    assert not (runtime / "python/msvcp140.dll").exists()


def test_vc_redist_changed_after_verification_cannot_be_copied(tmp_path, monkeypatch):
    helper = _build_helper("build-desktop-core-tools.py")
    source = _crt_fixture(tmp_path / "VS", "14.44.1")

    def tampered(files):
        records = _verified_crt_fixture(files)
        files[-1].write_bytes(b"changed after trust check")
        return records

    monkeypatch.setattr(helper, "verified_microsoft_dlls", tampered)
    runtime = tmp_path / "app/runtime"
    with pytest.raises(RuntimeError, match="changed after signature"):
        helper.copy_visual_cpp_redist(source, runtime)
    assert not (runtime / "python").exists()
