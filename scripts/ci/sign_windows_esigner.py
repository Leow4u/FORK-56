#!/usr/bin/env python3
"""Authenticode-sign a Windows PE binary with SSL.com eSigner.

The public Windows installer is ``Work4You-Setup.exe`` from
``apps/bootstrap-installer``. The private key stays at SSL.com; this
script sends only the file hash via CodeSignTool.

Used by ``.github/workflows/release-desktop.yml``. Do not embed a .pfx
inside the installer — that would ship the private key.

GitHub Actions secrets (repo Settings → Secrets and variables → Actions):

* ``ESIGNER_USERNAME`` — SSL.com account email
* ``ESIGNER_PASSWORD`` — SSL.com account password
* ``ESIGNER_CREDENTIAL_ID`` — eSigner credential UUID from the order
* ``ESIGNER_TOTP_SECRET`` — secret shown under the eSigner QR code
  (not the 6-digit code from Authy)

One-time SSL.com setup: on the validated code-signing order, click
**activate eSigner cloud signing**, enroll the TOTP secret, and copy the
credential id from Signing Credentials. Enable the signing credential
before the first CI run.

Usage::

    python scripts/ci/sign_windows_esigner.py dist/Work4You-Setup.exe
    python scripts/ci/sign_windows_esigner.py --print-argv dist/Work4You-Setup.exe
"""

from __future__ import annotations

import argparse
import errno
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

CODESIGNTOOL_VERSION = "v1.3.2"
CODESIGNTOOL_URL = (
    "https://github.com/SSLcom/CodeSignTool/releases/download/"
    f"{CODESIGNTOOL_VERSION}/CodeSignTool-{CODESIGNTOOL_VERSION}.zip"
)
CODESIGNTOOL_SHA256 = (
    "f14b1e1ef14bfa1fd00279c363aab0debbf5dcfba0e4bcdce5d22bb771de0e3a"
)
CODESIGNTOOL_JAR_NAME = "code_sign_tool-1.3.2.jar"
PROGRAM_NAME = "Work4You"

REQUIRED_ENV = (
    "ESIGNER_USERNAME",
    "ESIGNER_PASSWORD",
    "ESIGNER_CREDENTIAL_ID",
    "ESIGNER_TOTP_SECRET",
)

SETUP_HELP = """\
Windows installer signing needs SSL.com eSigner credentials.

1. In the SSL.com portal, open the validated WORK4YOU code-signing order
   and click "activate eSigner cloud signing" if it is not already active.
2. Enroll TOTP. Save the secret shown under the QR code (not the 6-digit
   rotating code). Copy the credential id from Signing Credentials.
3. Add GitHub Actions secrets: ESIGNER_USERNAME, ESIGNER_PASSWORD,
   ESIGNER_CREDENTIAL_ID, ESIGNER_TOTP_SECRET.
4. Re-run the "Release Desktop Installer" workflow.

The private key never leaves SSL.com. Do not put a .pfx inside the installer.
"""


class SignError(RuntimeError):
    """Signing failed in a way the caller should surface as a job error."""


def _strip(value: str | None) -> str:
    return (value or "").strip()


def load_credentials(env: dict[str, str] | None = None) -> dict[str, str]:
    """Read and validate eSigner secrets. Raises SignError if any are missing."""
    src = os.environ if env is None else env
    creds = {name: _strip(src.get(name)) for name in REQUIRED_ENV}
    missing = [name for name, value in creds.items() if not value]
    if missing:
        raise SignError(
            "missing eSigner secret(s): "
            + ", ".join(missing)
            + "\n"
            + SETUP_HELP
        )
    return creds


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_sha256(path: Path, expected: str) -> None:
    actual = sha256_file(path)
    if actual.lower() != expected.lower():
        raise SignError(
            f"SHA-256 mismatch for {path.name}: expected {expected}, got {actual}"
        )


def is_safe_zip_member(name: str) -> bool:
    """Reject AppleDouble junk, directory traversal, and absolute paths."""
    raw = name.replace("\\", "/")
    if raw.startswith("/") or (len(raw) >= 2 and raw[1] == ":"):
        return False
    normalized = raw.lstrip("/")
    if not normalized or normalized.endswith("/"):
        # Directories are created as a side effect of extracting files.
        return False
    if normalized.startswith("__MACOSX/") or normalized.startswith("../"):
        return False
    parts = Path(normalized).parts
    if any(part in ("..", "") or part.startswith("._") for part in parts):
        return False
    if Path(normalized).name in {".DS_Store"}:
        return False
    return True


def extract_codesigntool_zip(zip_path: Path, dest: Path) -> Path:
    """Extract CodeSignTool, skip junk, and return the unpacked root."""
    dest.mkdir(parents=True, exist_ok=True)
    dest_resolved = dest.resolve()
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            if not is_safe_zip_member(info.filename):
                continue
            relative = info.filename.replace("\\", "/").lstrip("/")
            target = (dest / relative).resolve()
            try:
                target.relative_to(dest_resolved)
            except ValueError as exc:
                raise SignError(f"unsafe path in zip: {info.filename}") from exc
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, target.open("wb") as out:
                shutil.copyfileobj(src, out)
    jar = dest / "jar" / CODESIGNTOOL_JAR_NAME
    if not jar.is_file():
        raise SignError(f"CodeSignTool jar missing after extract: {jar}")
    return dest


def download_file(url: str, dest: Path, *, timeout: int = 120) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Work4You-release-desktop"})
    with urllib.request.urlopen(req, timeout=timeout) as resp, dest.open("wb") as out:
        shutil.copyfileobj(resp, out)


def fetch_codesigntool(
    cache_dir: Path,
    *,
    url: str = CODESIGNTOOL_URL,
    sha256: str = CODESIGNTOOL_SHA256,
    downloader=download_file,
) -> Path:
    """Download (if needed), hash-check, and unpack CodeSignTool. Return tool dir."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    zip_path = cache_dir / f"CodeSignTool-{CODESIGNTOOL_VERSION}.zip"
    if not zip_path.is_file() or sha256_file(zip_path).lower() != sha256.lower():
        downloader(url, zip_path)
        verify_sha256(zip_path, sha256)
    unpacked = cache_dir / "unpacked"
    if unpacked.exists():
        shutil.rmtree(unpacked)
    return extract_codesigntool_zip(zip_path, unpacked)


def find_java() -> str:
    home = _strip(os.environ.get("JAVA_HOME"))
    if home:
        for name in ("java.exe", "java"):
            candidate = Path(home) / "bin" / name
            if candidate.is_file():
                return str(candidate)
    found = shutil.which("java")
    if found:
        return found
    raise SignError("java not found; install a JRE 11+ or set JAVA_HOME")


def codesigntool_child_env(
    creds: dict[str, str],
    *,
    base: dict[str, str] | None = None,
    tool_dir: Path | None = None,
) -> dict[str, str]:
    """Env for the CodeSignTool JVM.

    SSL.com's Docker wrapper maps these names; the JAR still requires the
    matching ``-username=`` / ``-password=`` flags (their entrypoint injects
    the same flags). We set both so a future JAR that reads env does not need
    argv, while today's v1.3.2 keeps working. Logs must use :func:`redact_argv`.
    """
    env = dict(os.environ if base is None else base)
    env["USERNAME"] = creds["ESIGNER_USERNAME"]
    env["PASSWORD"] = creds["ESIGNER_PASSWORD"]
    env["CREDENTIAL_ID"] = creds["ESIGNER_CREDENTIAL_ID"]
    env["TOTP_SECRET"] = creds["ESIGNER_TOTP_SECRET"]
    env["ENVIRONMENT_NAME"] = _strip(env.get("ESIGNER_ENVIRONMENT")) or "PROD"
    if tool_dir is not None:
        env["CODE_SIGN_TOOL_PATH"] = str(tool_dir)
    return env


def codesigntool_argv(
    *,
    java: str,
    jar: Path,
    creds: dict[str, str],
    input_path: Path,
    output_dir: Path,
    program_name: str = PROGRAM_NAME,
) -> list[str]:
    # v1.3.2's ``sign`` command requires these flags (Picocli). Do not print
    # this argv unredacted — Windows process lists still see the values.
    return [
        java,
        "-jar",
        str(jar),
        "sign",
        f"-username={creds['ESIGNER_USERNAME']}",
        f"-password={creds['ESIGNER_PASSWORD']}",
        f"-credential_id={creds['ESIGNER_CREDENTIAL_ID']}",
        f"-totp_secret={creds['ESIGNER_TOTP_SECRET']}",
        f"-input_file_path={input_path}",
        f"-output_dir_path={output_dir}",
        f"-program_name={program_name}",
    ]


def redact_argv(argv: list[str]) -> list[str]:
    redacted: list[str] = []
    secret_prefixes = (
        "-username=",
        "-password=",
        "-credential_id=",
        "-totp_secret=",
    )
    for arg in argv:
        if arg.startswith(secret_prefixes):
            key, _, _ = arg.partition("=")
            redacted.append(f"{key}=***")
        else:
            redacted.append(arg)
    return redacted


def _run(argv: list[str], *, cwd: Path, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        cwd=str(cwd),
        env=env,
        check=False,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )


def _is_cross_device_replace_error(exc: OSError) -> bool:
    """True for Windows WinError 17 and POSIX EXDEV (not the same volume)."""
    if getattr(exc, "winerror", None) == 17:
        return True
    return exc.errno == errno.EXDEV


def replace_file(src: Path, dst: Path) -> None:
    """Replace ``dst`` with ``src``, including Windows cross-drive moves.

    ``os.replace`` cannot move a file across volumes on Windows
    (``WinError 17`` / ``ERROR_NOT_SAME_DEVICE``). GitHub-hosted Windows
    runners keep ``%TEMP%`` on ``C:`` and the workspace on ``D:``, which is
    the layout that failed after CodeSignTool had already signed the
    installer (``Code signed successfully`` then ``os.replace``).
    """
    src = Path(src)
    dst = Path(dst)
    try:
        os.replace(src, dst)
        return
    except OSError as exc:
        if not _is_cross_device_replace_error(exc):
            raise
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{dst.name}.",
        suffix=".tmp",
        dir=str(dst.parent),
    )
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        shutil.copyfile(src, tmp_path)
        os.replace(tmp_path, dst)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise
    src.unlink(missing_ok=True)


def sign_file(
    input_path: Path,
    *,
    creds: dict[str, str],
    java: str,
    tool_dir: Path,
    runner=_run,
) -> None:
    """Sign ``input_path`` in place via CodeSignTool (hash only goes to SSL.com)."""
    input_path = input_path.resolve()
    if not input_path.is_file():
        raise SignError(f"installer not found: {input_path}")
    jar = tool_dir / "jar" / CODESIGNTOOL_JAR_NAME
    if not jar.is_file():
        raise SignError(f"CodeSignTool jar not found: {jar}")

    # Stage next to the installer so the common path is a same-volume
    # replace. Windows GHA still needs replace_file() if TEMP stays on C:.
    out_dir = Path(
        tempfile.mkdtemp(prefix=".work4you-esigner-", dir=str(input_path.parent))
    )
    try:
        argv = codesigntool_argv(
            java=java,
            jar=jar,
            creds=creds,
            input_path=input_path,
            output_dir=out_dir,
        )
        print("[esigner] " + " ".join(redact_argv(argv)), flush=True)
        env = codesigntool_child_env(creds, tool_dir=tool_dir)
        result = runner(argv, cwd=tool_dir, env=env)
        if result.stdout:
            print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "").strip()
            raise SignError(
                f"CodeSignTool exited {result.returncode}"
                + (f": {err}" if err else "")
            )
        signed = out_dir / input_path.name
        if not signed.is_file():
            matches = list(out_dir.rglob(input_path.name))
            if len(matches) == 1:
                signed = matches[0]
            else:
                listing = ", ".join(p.name for p in out_dir.iterdir()) or "(empty)"
                raise SignError(
                    f"signed file missing in {out_dir}; contents: {listing}"
                )
        replace_file(signed, input_path)
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


def windows_powershell_exe() -> str:
    """Windows PowerShell 5.1 — pwsh 7 on GHA cannot load Authenticode."""
    root = os.environ.get("SystemRoot") or r"C:\Windows"
    system_ps = (
        Path(root) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
    )
    if system_ps.is_file():
        return str(system_ps)
    found = shutil.which("powershell")
    if found:
        return found
    raise SignError("powershell not found; cannot probe Authenticode")


def authenticode_probe_argv(powershell: str) -> list[str]:
    return [
        powershell,
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Import-Module Microsoft.PowerShell.Security -ErrorAction Stop; "
        "(Get-AuthenticodeSignature -LiteralPath $env:SIGN_TARGET).Status",
    ]


def is_authenticode_probe_infra_error(err: str) -> bool:
    """True when PowerShell cannot load Microsoft.PowerShell.Security.

    Generic ``could not be loaded`` (wrong file, missing path) is a probe
    failure, not infra. Require the Security module FQID or name plus an
    autoload/load failure.
    """
    text = err.casefold()
    has_security_module = (
        "microsoft.powershell.security" in text
        or "couldnotautoloadmatchingmodule" in text
    )
    has_load_failure = (
        "module could not be loaded" in text
        or "couldnotautoloadmatchingmodule" in text
    )
    return has_security_module and has_load_failure


def require_authenticode_valid(status: str, *, path: Path) -> str:
    """Accept only Valid (Windows) or skipped-non-windows (unit tests / Linux)."""
    normalized = (status or "").strip().casefold()
    if normalized == "skipped-non-windows":
        return status
    if normalized != "valid":
        raise SignError(
            f"{path.name} Authenticode status is {status!r}; required Valid"
        )
    return status


def verify_authenticode(path: Path, *, runner=_run) -> str:
    """Return Authenticode Status on Windows. Raises unless the file is Valid.

    A missing Security module on the runner is a job failure — CodeSignTool
    reporting success is not enough to publish. Non-Windows hosts skip the
    probe (``skipped-non-windows``); production signing runs on windows-latest.
    """
    if sys.platform != "win32":
        return "skipped-non-windows"
    env = os.environ.copy()
    env["SIGN_TARGET"] = str(path.resolve())
    argv = authenticode_probe_argv(windows_powershell_exe())
    result = runner(argv, cwd=path.parent, env=env)
    status = (result.stdout or "").strip()
    if result.returncode != 0 or not status:
        err = (result.stderr or result.stdout or "").strip()
        if is_authenticode_probe_infra_error(err):
            raise SignError(
                "Authenticode probe unavailable "
                f"(PowerShell Security module): {err.splitlines()[0] if err else 'empty'}"
            )
        raise SignError(f"Authenticode probe failed: {err or 'empty status'}")
    return require_authenticode_valid(status, path=path)


def cache_dir_default() -> Path:
    root = os.environ.get("RUNNER_TEMP") or tempfile.gettempdir()
    return Path(root) / "work4you-codesigntool"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument("exe", type=Path, help="Path to Work4You-Setup.exe")
    parser.add_argument(
        "--print-argv",
        action="store_true",
        help="Print the redacted CodeSignTool command and exit (no network).",
    )
    parser.add_argument(
        "--tool-dir",
        type=Path,
        default=None,
        help="Existing unpacked CodeSignTool directory (skip download).",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=None,
        help="Where to download/unpack CodeSignTool (default: RUNNER_TEMP).",
    )
    parser.add_argument(
        "--skip-verify",
        action="store_true",
        help="Do not probe Authenticode after signing (non-Windows CI).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        creds = load_credentials()
        exe = args.exe.expanduser()
        if args.print_argv:
            jar = (
                (args.tool_dir / "jar" / CODESIGNTOOL_JAR_NAME)
                if args.tool_dir
                else Path("jar") / CODESIGNTOOL_JAR_NAME
            )
            printed = redact_argv(
                codesigntool_argv(
                    java="java",
                    jar=jar,
                    creds=creds,
                    input_path=exe,
                    output_dir=Path("signed-out"),
                )
            )
            print(" ".join(printed))
            return 0
        if not exe.is_file():
            raise SignError(f"installer not found: {exe}")
        java = find_java()
        tool_dir = args.tool_dir
        if tool_dir is None:
            tool_dir = fetch_codesigntool(args.cache_dir or cache_dir_default())
        sign_file(exe, creds=creds, java=java, tool_dir=tool_dir)
        if not args.skip_verify:
            status = require_authenticode_valid(
                verify_authenticode(exe), path=exe
            )
            print(f"[esigner] Authenticode status: {status}", flush=True)
        print(f"[esigner] signed {exe}", flush=True)
        return 0
    except SignError as exc:
        message = str(exc)
        print(f"::error::{message.splitlines()[0]}", file=sys.stderr)
        print(message, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
