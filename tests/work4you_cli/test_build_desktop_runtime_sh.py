"""POSIX runtime builder: uv path contract + zip output path."""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import zipfile
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "build-desktop-runtime.sh"
BASH = shutil.which("bash") or "/bin/bash"


def _isolated_path(*leading: Path) -> str:
    """Keep bash/sh on PATH without leaking a host `uv` into command -v."""
    parts = [str(path) for path in leading]
    parts.extend(["/usr/bin", "/bin"])
    return os.pathsep.join(parts)


def _write_exec(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return path


def _resolve_uv(tmp_path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [BASH, str(SCRIPT), "--resolve-uv", str(tmp_path)],
        check=False,
        capture_output=True,
        text=True,
    )


@pytest.mark.linux_only
def test_resolve_uv_finds_bin_uv(tmp_path):
    expected = _write_exec(tmp_path / "bin" / "uv")
    result = _resolve_uv(tmp_path)
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [str(expected)]


@pytest.mark.linux_only
def test_resolve_uv_finds_root_uv(tmp_path):
    expected = _write_exec(tmp_path / "uv")
    result = _resolve_uv(tmp_path)
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [str(expected)]


@pytest.mark.linux_only
def test_resolve_uv_prefers_root_over_bin(tmp_path):
    root = _write_exec(tmp_path / "uv")
    _write_exec(tmp_path / "bin" / "uv")
    result = _resolve_uv(tmp_path)
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [str(root)]


@pytest.mark.linux_only
def test_resolve_uv_ignores_non_executable_and_uses_bin(tmp_path):
    inert = tmp_path / "uv"
    inert.write_text("not executable\n", encoding="utf-8")
    expected = _write_exec(tmp_path / "bin" / "uv")
    result = _resolve_uv(tmp_path)
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [str(expected)]


@pytest.mark.linux_only
def test_resolve_uv_missing_binary_fails(tmp_path):
    result = _resolve_uv(tmp_path)
    assert result.returncode == 1
    assert result.stdout.strip() == ""
    assert "not found" in result.stderr


@pytest.mark.linux_only
def test_print_uv_stdout_is_only_the_path_binary(tmp_path):
    """install_uv must not leak installer chatter into UV_CMD."""
    fake_bin = tmp_path / "bin"
    uv = _write_exec(fake_bin / "uv")
    result = subprocess.run(
        [BASH, str(SCRIPT), "--print-uv"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "PATH": _isolated_path(fake_bin), "TMPDIR": str(tmp_path / "tmp")},
    )
    assert result.returncode == 0, result.stderr
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    assert lines == [str(uv)]
    assert "installing to" not in result.stdout
    resolved = Path(lines[0])
    assert resolved.is_file()
    assert os.access(resolved, os.X_OK)


@pytest.mark.linux_only
def test_print_uv_ignores_installer_stdout_and_finds_bin_uv(tmp_path):
    """Reproduce the macOS CI failure: installer chatter must stay off UV_CMD."""
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    curl = fake_bin / "curl"
    curl.write_text(
        "#!/bin/sh\n"
        "cat <<'EOS'\n"
        "#!/bin/sh\n"
        "echo \"installing to $UV_INSTALL_DIR\"\n"
        "echo \"downloading uv 0.12.16 aarch64-apple-darwin\"\n"
        "mkdir -p \"$UV_INSTALL_DIR/bin\"\n"
        "printf '%s\\n' '#!/bin/sh' 'exit 0' > \"$UV_INSTALL_DIR/bin/uv\"\n"
        "chmod +x \"$UV_INSTALL_DIR/bin/uv\"\n"
        "echo \"everything's installed!\"\n"
        "EOS\n",
        encoding="utf-8",
    )
    curl.chmod(curl.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    tmpdir = tmp_path / "tmp"
    result = subprocess.run(
        [BASH, str(SCRIPT), "--print-uv"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "PATH": _isolated_path(fake_bin), "TMPDIR": str(tmpdir)},
    )
    expected = tmpdir / "work4you-ci-uv" / "bin" / "uv"
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [str(expected)]
    assert "installing to" not in result.stdout
    assert "installing to" in result.stderr
    assert expected.is_file()
    assert os.access(expected, os.X_OK)


@pytest.mark.linux_only
def test_zip_only_writes_relative_zip_from_cwd_not_out_dir(tmp_path):
    """CI failed after `cd $OUT_DIR` because --zip-out was dist/foo.zip."""
    out = tmp_path / "runtime"
    out.mkdir()
    (out / "marker.txt").write_text("ok\n", encoding="utf-8")
    cwd = tmp_path / "cwd"
    cwd.mkdir()
    result = subprocess.run(
        [
            BASH,
            str(SCRIPT),
            "--out-dir",
            str(out),
            "--zip-out",
            "dist/runtime-darwin-arm64.zip",
            "--zip-only",
        ],
        check=False,
        capture_output=True,
        text=True,
        cwd=cwd,
    )
    dest = cwd / "dist" / "runtime-darwin-arm64.zip"
    assert result.returncode == 0, result.stderr + result.stdout
    assert dest.is_file()
    assert not (out / "dist" / "runtime-darwin-arm64.zip").exists()
    with zipfile.ZipFile(dest) as archive:
        assert "marker.txt" in archive.namelist()
        assert archive.read("marker.txt") == b"ok\n"


@pytest.mark.linux_only
def test_zip_only_missing_out_dir_fails(tmp_path):
    result = subprocess.run(
        [
            BASH,
            str(SCRIPT),
            "--out-dir",
            str(tmp_path / "missing-runtime"),
            "--zip-out",
            str(tmp_path / "out.zip"),
            "--zip-only",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "out-dir missing" in result.stderr
