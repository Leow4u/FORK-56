#!/usr/bin/env python3
"""Prepare a Developer ID .p12 for electron-builder on the macOS desktop job.

GitHub injects missing secrets as empty strings. Passing ``CSC_LINK=""`` makes
electron-builder treat the working directory as a cert path and fail with
"apps/desktop not a file" (desktop-v0.0.5 run 33462742230). This script writes
``CSC_LINK`` to ``GITHUB_ENV`` only when ``CSC_P12_BASE64`` decodes to a real
``.p12``. The private key never goes to stdout.

Used by ``.github/workflows/release-desktop.yml``. Decode-only — signing still
happens inside electron-builder (``@electron/osx-sign``).

GitHub Actions secrets (repo Settings → Secrets and variables → Actions):

* ``CSC_P12_BASE64`` — Developer ID Application ``.p12``, standard Base64
* ``CSC_KEY_PASSWORD`` — export password for that ``.p12`` (read by the
  builder step, not by this script)
* ``APPLE_API_KEY`` / ``APPLE_API_KEY_ID`` / ``APPLE_API_ISSUER`` — notary
  (``apps/desktop/scripts/notarize.mjs``)

Usage::

    python scripts/ci/prepare_macos_signing.py
    python scripts/ci/prepare_macos_signing.py --require
    python scripts/ci/prepare_macos_signing.py --print-app apps/desktop/release
    python scripts/ci/prepare_macos_signing.py --check-codesign-dv < codesign-dv.txt
"""

from __future__ import annotations

import argparse
import base64
import os
import sys
from pathlib import Path


P12_FILENAME = "work4you-developer-id.p12"
APP_BUNDLE_NAME = "Work4You.app"


class PrepareError(RuntimeError):
    """Prepare failed in a way the caller should surface as a job error."""


SETUP_HELP = """\
macOS desktop signing needs a Developer ID Application certificate as Base64.

1. Export the Developer ID Application cert + private key as a .p12.
2. Base64-encode it (do not commit the file).
3. Add GitHub Actions secrets: CSC_P12_BASE64, CSC_KEY_PASSWORD,
   APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER.
4. Re-run the "Release Desktop Installer" workflow.

Never pass CSC_LINK as an empty string. Missing secrets must omit the
variable so electron-builder does not treat "" as a cert path.
"""


def decode_p12_base64(raw: str) -> bytes:
    """Return PKCS#12 bytes. Raises PrepareError on empty or invalid input."""
    compact = "".join(str(raw or "").split())
    if not compact:
        raise PrepareError("CSC_P12_BASE64 is empty")
    try:
        data = base64.b64decode(compact, validate=True)
    except Exception as exc:
        raise PrepareError("CSC_P12_BASE64 is not valid Base64") from exc
    if len(data) < 64 or data[0] != 0x30:
        raise PrepareError("CSC_P12_BASE64 did not decode to a PKCS#12 blob")
    return data


def write_p12(data: bytes, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    dest.chmod(0o600)
    return dest


def append_github_file(path: Path | None, text: str) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(text)


def write_signing_outputs(
    *,
    enabled: bool,
    p12_path: Path | None,
    github_env: Path | None,
    github_output: Path | None,
) -> None:
    """Write GITHUB_ENV / GITHUB_OUTPUT. Never writes CSC_LINK when disabled."""
    if enabled:
        if p12_path is None:
            raise PrepareError("signed prepare is missing the .p12 path")
        # electron-builder needs an absolute path; a relative one can resolve
        # to apps/desktop when the builder cwd changes.
        append_github_file(github_env, f"CSC_LINK={p12_path.resolve()}\n")
        append_github_file(github_output, "signing=true\n")
        return
    append_github_file(github_output, "signing=false\n")


def find_work4you_app(release_root: Path) -> Path:
    """Return the packaged Work4You.app under an electron-builder release dir."""
    if not release_root.is_dir():
        raise PrepareError(f"release directory not found: {release_root}")
    apps = sorted(
        path
        for path in release_root.rglob(APP_BUNDLE_NAME)
        if path.is_dir() and path.name == APP_BUNDLE_NAME
    )
    if not apps:
        raise PrepareError(f"{APP_BUNDLE_NAME} not found under {release_root}")
    return apps[0]


def team_identifier_from_codesign_dv(text: str) -> str | None:
    """Parse ``codesign -dv`` output. None when ad-hoc or missing Team ID."""
    for line in str(text or "").splitlines():
        stripped = line.strip()
        if not stripped.startswith("TeamIdentifier="):
            continue
        value = stripped.split("=", 1)[1].strip()
        if value and value != "not set":
            return value
        return None
    return None


def default_p12_path() -> Path:
    root = os.environ.get("RUNNER_TEMP") or os.environ.get("TMPDIR") or "/tmp"
    return Path(root) / "work4you-macos-signing" / P12_FILENAME


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument(
        "--require",
        action="store_true",
        help="Fail when CSC_P12_BASE64 is missing (signed CI path).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Where to write the .p12 (default: RUNNER_TEMP/work4you-macos-signing/).",
    )
    parser.add_argument(
        "--github-env",
        type=Path,
        default=None,
        help="GITHUB_ENV path (default: $GITHUB_ENV).",
    )
    parser.add_argument(
        "--github-output",
        type=Path,
        default=None,
        help="GITHUB_OUTPUT path (default: $GITHUB_OUTPUT).",
    )
    parser.add_argument(
        "--print-app",
        type=Path,
        metavar="RELEASE_DIR",
        default=None,
        help="Print the Work4You.app path under RELEASE_DIR and exit.",
    )
    parser.add_argument(
        "--check-codesign-dv",
        action="store_true",
        help="Read codesign -dv output from stdin; fail without a Team ID.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        if args.print_app is not None:
            print(find_work4you_app(args.print_app), flush=True)
            return 0
        if args.check_codesign_dv:
            team = team_identifier_from_codesign_dv(sys.stdin.read())
            if not team:
                raise PrepareError(
                    "Work4You.app is not Developer ID signed "
                    "(codesign TeamIdentifier missing or ad-hoc)"
                )
            print(f"[macos-signing] TeamIdentifier={team}", flush=True)
            return 0

        raw = os.environ.get("CSC_P12_BASE64", "")
        github_env = args.github_env
        if github_env is None and os.environ.get("GITHUB_ENV"):
            github_env = Path(os.environ["GITHUB_ENV"])
        github_output = args.github_output
        if github_output is None and os.environ.get("GITHUB_OUTPUT"):
            github_output = Path(os.environ["GITHUB_OUTPUT"])

        compact = "".join(raw.split())
        if not compact:
            if args.require:
                raise PrepareError(SETUP_HELP.strip())
            write_signing_outputs(
                enabled=False,
                p12_path=None,
                github_env=github_env,
                github_output=github_output,
            )
            print("[macos-signing] CSC_P12_BASE64 empty; omitting CSC_LINK", flush=True)
            return 0

        dest = args.output or default_p12_path()
        p12_path = write_p12(decode_p12_base64(raw), dest)
        write_signing_outputs(
            enabled=True,
            p12_path=p12_path,
            github_env=github_env,
            github_output=github_output,
        )
        print(f"[macos-signing] wrote Developer ID .p12 ({p12_path.stat().st_size} bytes)", flush=True)
        return 0
    except PrepareError as exc:
        message = str(exc)
        print(f"::error::{message.splitlines()[0]}", file=sys.stderr)
        print(message, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
