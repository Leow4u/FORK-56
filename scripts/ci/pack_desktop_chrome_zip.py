#!/usr/bin/env python3
"""Pack the slim Windows Electron chrome zip for in-app updates.

``win-unpacked`` includes ``resources/runtime`` (~160 MB) because first-install
Setup embeds the prebuilt payload. The Update button overlays this chrome zip
onto ``%LOCALAPPDATA%\\Programs\\Work4You`` and leaves leftover
``resources/runtime`` alone.

Site / Repair / first install stay on fat ``Work4You-Setup.exe``. This zip is
an optional Latest asset — missing it is not fatal for publish.

Used by ``.github/workflows/release-desktop.yml``. Stdlib only except the
optional fingerprint write, which imports ``work4you_cli.runtime_fingerprint``.
"""

from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

CHROME_ZIP_NAME = "Work4You-win-x64.zip"
FINGERPRINT_ASSET_NAME = "runtime-win-x64.fingerprint"
WINDOWS_EXE_NAME = "Work4You.exe"
RUNTIME_RESOURCE_PREFIX = "resources/runtime"


def is_runtime_extra_resource(relative_posix: str) -> bool:
    rel = relative_posix.replace("\\", "/").lstrip("/")
    return rel == RUNTIME_RESOURCE_PREFIX or rel.startswith(f"{RUNTIME_RESOURCE_PREFIX}/")


def iter_chrome_files(unpacked: Path) -> list[Path]:
    root = Path(unpacked)
    files: list[Path] = []
    if not root.is_dir():
        return files
    for path in root.rglob("*"):
        try:
            if path.is_symlink() or not path.is_file():
                continue
        except OSError:
            continue
        if is_runtime_extra_resource(path.relative_to(root).as_posix()):
            continue
        files.append(path)
    files.sort(key=lambda item: item.relative_to(root).as_posix())
    return files


def pack_desktop_chrome_zip(unpacked: Path, dest: Path) -> Path:
    """Zip ``unpacked`` minus ``resources/runtime``. Files sit at the zip root."""
    source = Path(unpacked)
    if not source.is_dir():
        raise ValueError(f"win-unpacked directory missing: {source}")
    exe = source / WINDOWS_EXE_NAME
    if not exe.is_file():
        raise ValueError(f"win-unpacked is missing {WINDOWS_EXE_NAME}: {source}")

    files = iter_chrome_files(source)
    if not files:
        raise ValueError(f"win-unpacked has no chrome files: {source}")

    out = Path(dest)
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            zf.write(path, path.relative_to(source).as_posix())
    return out


def write_runtime_fingerprint_asset(runtime_dir: Path, dest: Path) -> Path:
    """Write the 64-hex payload id published as ``runtime-win-x64.fingerprint``."""
    bundle = Path(runtime_dir)
    if not bundle.is_dir():
        raise ValueError(f"runtime directory missing: {bundle}")

    repo_root = Path(__file__).resolve().parents[2]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    from work4you_cli.runtime_fingerprint import (
        runtime_payload_fingerprint,
        write_runtime_fingerprint_file,
    )

    fingerprint = runtime_payload_fingerprint(
        bundle / "work4you",
        bundle / "python",
        bundle / "node",
    )
    return write_runtime_fingerprint_file(Path(dest).parent, fingerprint, filename=Path(dest).name)


def chrome_zip_members(zip_path: Path) -> list[str]:
    with zipfile.ZipFile(zip_path, "r") as zf:
        return zf.namelist()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--unpacked",
        type=Path,
        required=True,
        help="electron-builder win-unpacked directory",
    )
    parser.add_argument(
        "--out",
        type=Path,
        required=True,
        help=f"destination zip (stable name {CHROME_ZIP_NAME})",
    )
    parser.add_argument(
        "--runtime-dir",
        type=Path,
        default=None,
        help="prebuilt runtime tree used for the optional fingerprint asset",
    )
    parser.add_argument(
        "--fingerprint-out",
        type=Path,
        default=None,
        help=f"destination for {FINGERPRINT_ASSET_NAME}",
    )
    args = parser.parse_args(argv)

    try:
        packed = pack_desktop_chrome_zip(args.unpacked, args.out)
        print(f"Packed chrome zip {packed} ({packed.stat().st_size} bytes)")
        if args.fingerprint_out is not None:
            if args.runtime_dir is None:
                print("::error::--fingerprint-out requires --runtime-dir", file=sys.stderr)
                return 1
            fingerprint = write_runtime_fingerprint_asset(args.runtime_dir, args.fingerprint_out)
            print(f"Wrote runtime fingerprint {fingerprint}")
    except (OSError, ValueError) as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
