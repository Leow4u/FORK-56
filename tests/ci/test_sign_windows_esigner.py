"""Tests for scripts/ci/sign_windows_esigner.py.

These cover credential gating, argv construction, zip safety, and the
in-place replace after a fake CodeSignTool run. They never talk to SSL.com.
"""

from __future__ import annotations

import hashlib
import importlib.util
import os
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest

_PATH = Path(__file__).resolve().parents[2] / "scripts" / "ci" / "sign_windows_esigner.py"
_spec = importlib.util.spec_from_file_location("sign_windows_esigner", _PATH)
if _spec is None or _spec.loader is None:
    raise ImportError("Failed to load sign_windows_esigner.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


VALID_ENV = {
    "ESIGNER_USERNAME": "owner@work4you.ai",
    "ESIGNER_PASSWORD": "s3cret",
    "ESIGNER_CREDENTIAL_ID": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "ESIGNER_TOTP_SECRET": "KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD",
}


def test_load_credentials_requires_all_four():
    with pytest.raises(mod.SignError, match="missing eSigner secret"):
        mod.load_credentials({})
    with pytest.raises(mod.SignError, match="ESIGNER_TOTP_SECRET"):
        mod.load_credentials({**VALID_ENV, "ESIGNER_TOTP_SECRET": "  "})
    creds = mod.load_credentials({**VALID_ENV, "ESIGNER_USERNAME": "  owner@work4you.ai\n"})
    assert creds["ESIGNER_USERNAME"] == "owner@work4you.ai"


def test_missing_secrets_message_points_at_esigner_activation():
    with pytest.raises(mod.SignError) as exc:
        mod.load_credentials({"ESIGNER_USERNAME": "x"})
    text = str(exc.value)
    assert "activate eSigner cloud signing" in text
    assert "ESIGNER_CREDENTIAL_ID" in text
    assert ".pfx" in text


def test_codesigntool_argv_uses_equals_flags_and_output_dir(tmp_path):
    exe = tmp_path / "Work4You-Setup.exe"
    out = tmp_path / "signed"
    argv = mod.codesigntool_argv(
        java="java",
        jar=tmp_path / "jar" / "code_sign_tool-1.3.2.jar",
        creds=VALID_ENV,
        input_path=exe,
        output_dir=out,
    )
    joined = " ".join(argv)
    assert argv[0] == "java"
    assert argv[1:3] == ["-jar", str(tmp_path / "jar" / "code_sign_tool-1.3.2.jar")]
    assert "sign" in argv
    assert f"-username={VALID_ENV['ESIGNER_USERNAME']}" in argv
    assert f"-input_file_path={exe}" in argv
    assert f"-output_dir_path={out}" in argv
    assert "-program_name=Work4You" in argv
    assert "-override" not in argv
    assert "s3cret" in joined


def test_redact_argv_hides_secrets_keeps_paths(tmp_path):
    argv = mod.codesigntool_argv(
        java="java",
        jar=tmp_path / "tool.jar",
        creds=VALID_ENV,
        input_path=tmp_path / "Work4You-Setup.exe",
        output_dir=tmp_path / "out",
    )
    redacted = " ".join(mod.redact_argv(argv))
    assert "s3cret" not in redacted
    assert VALID_ENV["ESIGNER_TOTP_SECRET"] not in redacted
    assert VALID_ENV["ESIGNER_CREDENTIAL_ID"] not in redacted
    assert "owner@work4you.ai" not in redacted
    assert "-password=***" in redacted
    assert "-totp_secret=***" in redacted
    assert "Work4You-Setup.exe" in redacted


def test_verify_sha256_accepts_match_rejects_mismatch(tmp_path):
    blob = tmp_path / "tool.zip"
    blob.write_bytes(b"codesigntool")
    expected = hashlib.sha256(b"codesigntool").hexdigest()
    mod.verify_sha256(blob, expected)
    with pytest.raises(mod.SignError, match="SHA-256 mismatch"):
        mod.verify_sha256(blob, "0" * 64)


@pytest.mark.parametrize(
    "name,safe",
    [
        ("jar/code_sign_tool-1.3.2.jar", True),
        ("conf/code_sign_tool.properties", True),
        ("__MACOSX/._CodeSignTool.bat", False),
        ("jar/._code_sign_tool-1.3.2.jar", False),
        ("../evil.exe", False),
        ("/abs/evil.exe", False),
        (".DS_Store", False),
        ("logs/", False),
    ],
)
def test_zip_member_safety(name, safe):
    assert mod.is_safe_zip_member(name) is safe


def _tool_zip(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("jar/code_sign_tool-1.3.2.jar", b"fake-jar")
        zf.writestr("conf/code_sign_tool.properties", b"TSA_URL=http://ts.ssl.com\n")
        zf.writestr("__MACOSX/._CodeSignTool.bat", b"junk")
        zf.writestr("logs/", b"")


def test_extract_skips_junk_and_finds_jar(tmp_path):
    zpath = tmp_path / "CodeSignTool-v1.3.2.zip"
    _tool_zip(zpath)
    dest = tmp_path / "unpacked"
    root = mod.extract_codesigntool_zip(zpath, dest)
    assert (root / "jar" / "code_sign_tool-1.3.2.jar").read_bytes() == b"fake-jar"
    assert (root / "conf" / "code_sign_tool.properties").is_file()
    assert not (root / "__MACOSX").exists()


def test_extract_rejects_zip_slip(tmp_path):
    zpath = tmp_path / "evil.zip"
    with zipfile.ZipFile(zpath, "w") as zf:
        info = zipfile.ZipInfo("../outside.exe")
        zf.writestr(info, b"nope")
    with pytest.raises(mod.SignError, match="jar missing"):
        # Traversal members are skipped; without a real jar the extract fails closed.
        mod.extract_codesigntool_zip(zpath, tmp_path / "out")


def test_fetch_codesigntool_downloads_when_cache_empty(tmp_path):
    source = tmp_path / "source.zip"
    _tool_zip(source)
    expected = hashlib.sha256(source.read_bytes()).hexdigest()

    def downloader(url, dest, *, timeout=120):
        assert url == mod.CODESIGNTOOL_URL
        dest.write_bytes(source.read_bytes())

    tool_dir = mod.fetch_codesigntool(
        tmp_path / "cache",
        sha256=expected,
        downloader=downloader,
    )
    assert (tool_dir / "jar" / "code_sign_tool-1.3.2.jar").is_file()


def test_fetch_rejects_corrupt_download(tmp_path):
    def downloader(url, dest, *, timeout=120):
        dest.write_bytes(b"not-the-zip")

    with pytest.raises(mod.SignError, match="SHA-256 mismatch"):
        mod.fetch_codesigntool(tmp_path / "cache", downloader=downloader)


def test_sign_file_replaces_input_from_output_dir(tmp_path):
    tool_dir = tmp_path / "tool"
    (tool_dir / "jar").mkdir(parents=True)
    (tool_dir / "jar" / "code_sign_tool-1.3.2.jar").write_bytes(b"jar")
    exe = tmp_path / "Work4You-Setup.exe"
    exe.write_bytes(b"unsigned-bytes")

    def fake_runner(argv, *, cwd, env=None):
        assert Path(cwd) == tool_dir
        assert env is not None
        assert env["CODE_SIGN_TOOL_PATH"] == str(tool_dir)
        out_flag = next(a for a in argv if a.startswith("-output_dir_path="))
        out_dir = Path(out_flag.split("=", 1)[1])
        assert out_dir.parent == exe.parent
        (out_dir / "Work4You-Setup.exe").write_bytes(b"signed-bytes")
        return SimpleNamespace(returncode=0, stdout="Code signed successfully\n", stderr="")

    mod.sign_file(
        exe,
        creds=VALID_ENV,
        java="java",
        tool_dir=tool_dir,
        runner=fake_runner,
    )
    assert exe.read_bytes() == b"signed-bytes"


def test_is_cross_device_replace_error_winerror_17_and_exdev():
    win = OSError(17, "The system cannot move the file to a different disk drive")
    win.winerror = 17
    assert mod._is_cross_device_replace_error(win) is True
    posix = OSError(mod.errno.EXDEV, "Invalid cross-device link")
    assert mod._is_cross_device_replace_error(posix) is True
    other = OSError(13, "Permission denied")
    assert mod._is_cross_device_replace_error(other) is False


def test_replace_file_falls_back_when_os_replace_is_cross_device(tmp_path, monkeypatch):
    src = tmp_path / "signed.exe"
    dst = tmp_path / "Work4You-Setup.exe"
    src.write_bytes(b"signed-bytes")
    dst.write_bytes(b"unsigned-bytes")

    calls = {"n": 0}
    real_replace = os.replace

    def flaky_replace(a, b):
        calls["n"] += 1
        if calls["n"] == 1:
            err = OSError(17, "The system cannot move the file to a different disk drive")
            err.winerror = 17
            err.errno = 17
            raise err
        return real_replace(a, b)

    monkeypatch.setattr(mod.os, "replace", flaky_replace)
    mod.replace_file(src, dst)
    assert dst.read_bytes() == b"signed-bytes"
    assert not src.exists()
    assert calls["n"] >= 2


def test_sign_file_survives_cross_device_replace(tmp_path, monkeypatch):
    tool_dir = tmp_path / "tool"
    (tool_dir / "jar").mkdir(parents=True)
    (tool_dir / "jar" / "code_sign_tool-1.3.2.jar").write_bytes(b"jar")
    exe = tmp_path / "Work4You-Setup.exe"
    exe.write_bytes(b"unsigned-bytes")

    real_replace = os.replace

    def flaky_replace(a, b):
        src = Path(a)
        dst = Path(b)
        if src.name == "Work4You-Setup.exe" and dst.name == "Work4You-Setup.exe":
            err = OSError(17, "The system cannot move the file to a different disk drive")
            err.winerror = 17
            raise err
        return real_replace(a, b)

    def fake_runner(argv, *, cwd, env=None):
        out_flag = next(a for a in argv if a.startswith("-output_dir_path="))
        out_dir = Path(out_flag.split("=", 1)[1])
        (out_dir / "Work4You-Setup.exe").write_bytes(b"signed-bytes")
        return SimpleNamespace(returncode=0, stdout="Code signed successfully\n", stderr="")

    monkeypatch.setattr(mod.os, "replace", flaky_replace)
    mod.sign_file(
        exe,
        creds=VALID_ENV,
        java="java",
        tool_dir=tool_dir,
        runner=fake_runner,
    )
    assert exe.read_bytes() == b"signed-bytes"


def test_sign_file_surfaces_codesigntool_failure(tmp_path):
    tool_dir = tmp_path / "tool"
    (tool_dir / "jar").mkdir(parents=True)
    (tool_dir / "jar" / "code_sign_tool-1.3.2.jar").write_bytes(b"jar")
    exe = tmp_path / "Work4You-Setup.exe"
    exe.write_bytes(b"unsigned")

    def fake_runner(argv, *, cwd, env=None):
        return SimpleNamespace(returncode=1, stdout="", stderr="invalid otp\n")

    with pytest.raises(mod.SignError, match="invalid otp"):
        mod.sign_file(
            exe,
            creds=VALID_ENV,
            java="java",
            tool_dir=tool_dir,
            runner=fake_runner,
        )
    assert exe.read_bytes() == b"unsigned"


def test_windows_powershell_prefers_system32(tmp_path, monkeypatch):
    ps = tmp_path / "Windows" / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
    ps.parent.mkdir(parents=True)
    ps.write_bytes(b"ps")
    monkeypatch.setenv("SystemRoot", str(tmp_path / "Windows"))
    assert Path(mod.windows_powershell_exe()) == ps


def test_authenticode_probe_argv_imports_security_module():
    argv = mod.authenticode_probe_argv(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe")
    assert argv[0].endswith("powershell.exe")
    assert "-ExecutionPolicy" in argv
    joined = " ".join(argv)
    assert "Import-Module Microsoft.PowerShell.Security" in joined
    assert "Get-AuthenticodeSignature" in joined


def test_verify_authenticode_rejects_notsigned(tmp_path, monkeypatch):
    monkeypatch.setattr(mod.sys, "platform", "win32")
    monkeypatch.setattr(mod, "windows_powershell_exe", lambda: "powershell")
    exe = tmp_path / "Work4You-Setup.exe"
    exe.write_bytes(b"x")

    def fake_runner(argv, *, cwd, env=None):
        assert env["SIGN_TARGET"] == str(exe.resolve())
        assert argv[0] == "powershell"
        return SimpleNamespace(returncode=0, stdout="NotSigned\n", stderr="")

    with pytest.raises(mod.SignError, match="still unsigned"):
        mod.verify_authenticode(exe, runner=fake_runner)


def test_verify_authenticode_accepts_valid(tmp_path, monkeypatch):
    monkeypatch.setattr(mod.sys, "platform", "win32")
    monkeypatch.setattr(mod, "windows_powershell_exe", lambda: "powershell")
    exe = tmp_path / "Work4You-Setup.exe"
    exe.write_bytes(b"x")

    def fake_runner(argv, *, cwd, env=None):
        return SimpleNamespace(returncode=0, stdout="Valid\n", stderr="")

    assert mod.verify_authenticode(exe, runner=fake_runner) == "Valid"


def test_verify_authenticode_soft_skips_gha_module_autoload(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(mod.sys, "platform", "win32")
    monkeypatch.setattr(mod, "windows_powershell_exe", lambda: "powershell")
    exe = tmp_path / "Work4You-Setup.exe"
    exe.write_bytes(b"x")
    err = (
        "Get-AuthenticodeSignature : The 'Get-AuthenticodeSignature' command "
        "was found in the module 'Microsoft.PowerShell.Security', but the "
        "module could not be loaded. FullyQualifiedErrorId : "
        "CouldNotAutoloadMatchingModule\n"
    )

    def fake_runner(argv, *, cwd, env=None):
        return SimpleNamespace(returncode=1, stdout="", stderr=err)

    assert mod.verify_authenticode(exe, runner=fake_runner) == "unverified"
    assert "Authenticode probe unavailable" in capsys.readouterr().out


def test_print_argv_main_does_not_need_java(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("ESIGNER_USERNAME", VALID_ENV["ESIGNER_USERNAME"])
    monkeypatch.setenv("ESIGNER_PASSWORD", VALID_ENV["ESIGNER_PASSWORD"])
    monkeypatch.setenv("ESIGNER_CREDENTIAL_ID", VALID_ENV["ESIGNER_CREDENTIAL_ID"])
    monkeypatch.setenv("ESIGNER_TOTP_SECRET", VALID_ENV["ESIGNER_TOTP_SECRET"])
    exe = tmp_path / "Work4You-Setup.exe"
    tool = tmp_path / "tool"
    (tool / "jar").mkdir(parents=True)
    rc = mod.main(["--print-argv", "--tool-dir", str(tool), str(exe)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "-password=***" in out
    assert "s3cret" not in out
    assert "sign" in out


def test_main_missing_secrets_exits_2(tmp_path, monkeypatch):
    for name in mod.REQUIRED_ENV:
        monkeypatch.delenv(name, raising=False)
    exe = tmp_path / "Work4You-Setup.exe"
    exe.write_bytes(b"x")
    assert mod.main([str(exe)]) == 2


def test_pinned_url_is_sslcom_release_https():
    assert mod.CODESIGNTOOL_URL.startswith("https://github.com/SSLcom/CodeSignTool/releases/download/")
    assert mod.CODESIGNTOOL_VERSION in mod.CODESIGNTOOL_URL
    assert len(mod.CODESIGNTOOL_SHA256) == 64
    int(mod.CODESIGNTOOL_SHA256, 16)
