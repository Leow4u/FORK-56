#!/usr/bin/env python3
"""Stage portable standard command-line tools during the desktop build."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.request import urlopen
import zipfile


# imageio-ffmpeg wheels contain a standalone executable and its license.
# Only those files are shipped; this is not another runtime Python package.
FFMPEG_WHEELS = {
    ("linux", "x64"): ("a0/2d/43c8522a2038e9d0e7dbdf3a61195ecc31ca576fb1527a528c877e87d973/imageio_ffmpeg-0.6.0-py3-none-manylinux2014_x86_64.whl", "c7e46fcec401dd990405049d2e2f475e2b397779df2519b544b8aab515195282"),
    ("linux", "arm64"): ("33/e7/1925bfbc563c39c1d2e82501d8372734a5c725e53ac3b31b4c2d081e895b/imageio_ffmpeg-0.6.0-py3-none-manylinux2014_aarch64.whl", "1d47bebd83d2c5fc770720d211855f208af8a596c82d17730aa51e815cdee6dc"),
    ("darwin", "x64"): ("da/58/87ef68ac83f4c7690961bce288fd8e382bc5f1513860fc7f90a9c1c1c6bf/imageio_ffmpeg-0.6.0-py3-none-macosx_10_9_intel.macosx_10_9_x86_64.whl", "9d2baaf867088508d4a3458e61eeb30e945c4ad8016025545f66c4b5aaef0a61"),
    ("darwin", "arm64"): ("40/5c/f3d8a657d362cc93b81aab8feda487317da5b5d31c0e1fdfd5e986e55d17/imageio_ffmpeg-0.6.0-py3-none-macosx_11_0_arm64.whl", "b1ae3173414b5fc5f538a726c4e48ea97edc0d2cdc11f103afee655c463fa742"),
    ("win32", "x64"): ("2c/c6/fa760e12a2483469e2bf5058c5faff664acf66cadb4df2ad6205b016a73d/imageio_ffmpeg-0.6.0-py3-none-win_amd64.whl", "02fa47c83703c37df6bfe4896aab339013f62bf02c5ebf2dce6da56af04ffc0a"),
}
GIT_VERSION = "2.54.0"
# Verified against the SHA-256 table on the upstream versioned release.
GIT_ARCHIVES = {
    "x64": ("64-bit", "bea006a6cc69673f27b1647e84ab3a68e912fbc175ab6320c5987e012897f311"),
    "arm64": ("arm64", "f8e92cd3359fcbb96998cfd606a536ccc6dbfb23c04e12b29042f9ba45b6b0c7"),
}


def find_visual_cpp_redist(installation_roots: list[Path], arch: str) -> Path:
    """Choose one complete release CRT set from an official VS installation."""
    candidates = []
    for installation in installation_roots:
        for directory in (installation / "VC/Redist/MSVC").glob(f"*/{arch}/Microsoft.VC143.CRT"):
            version = directory.parent.parent.name
            if not re.fullmatch(r"\d+(?:\.\d+)+", version):
                continue
            required = ("msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll")
            if all((directory / name).is_file() for name in required):
                candidates.append((tuple(int(part) for part in version.split(".")), directory))
    if not candidates:
        raise RuntimeError(f"Visual Studio's complete {arch} Microsoft.VC143.CRT redistributable is required on the build host")
    return max(candidates, key=lambda item: item[0])[1]


def verified_microsoft_dlls(files: list[Path]) -> list[dict]:
    """Use native Windows trust verification before copying any CRT DLL."""
    script = r'''
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$files = Get-Content -LiteralPath $env:WORK4YOU_VC_INPUT_FILE -Raw -Encoding UTF8 | ConvertFrom-Json
$verified = @()
foreach ($file in $files) {
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate -or
        $signature.SignerCertificate.Subject -notmatch '(?:^|,\s*)O=Microsoft Corporation(?:,|$)') {
        throw "CRT DLL does not have a valid Microsoft signature: $file"
    }
    $verified += [ordered]@{
        path = [string]$file
        sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
        fileVersion = (Get-Item -LiteralPath $file).VersionInfo.FileVersion
        signer = $signature.SignerCertificate.Subject
        signerThumbprint = $signature.SignerCertificate.Thumbprint
    }
}
ConvertTo-Json -InputObject @($verified) -Depth 4 -Compress
'''
    with tempfile.TemporaryDirectory(prefix="work4you-crt-signatures-") as temporary:
        input_file = Path(temporary) / "dlls.json"
        input_file.write_text(json.dumps([str(path.resolve()) for path in files]), encoding="utf-8")
        verification_env = {**os.environ, "WORK4YOU_VC_INPUT_FILE": str(input_file)}
        # A PowerShell 7 CI parent exports incompatible module paths to 5.1.
        # Let the native Windows PowerShell process construct its own defaults.
        for name in list(verification_env):
            if name.lower() == "psmodulepath":
                del verification_env[name]
        output = subprocess.check_output(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
            env=verification_env,
            text=True, encoding="utf-8", timeout=180,
        )
    records = json.loads(output)
    if not isinstance(records, list) or len(records) != len(files):
        raise RuntimeError("Windows did not verify the complete CRT DLL set")
    return records


def copy_visual_cpp_redist(source: Path, runtime: Path) -> dict:
    """Copy a single verified CRT set beside python.exe, never into Windows."""
    files = sorted(path for path in source.glob("*.dll") if path.is_file())
    if not files:
        raise RuntimeError("Visual C++ redistributable contains no DLLs")
    verified = verified_microsoft_dlls(files)
    records = {str(Path(record["path"]).resolve()): record for record in verified}
    expected = {str(path.resolve()) for path in files}
    if set(records) != expected:
        raise RuntimeError("Microsoft signature results do not cover the selected CRT files")
    # Validate every source hash before replacing Python's existing vcruntime.
    for path in files:
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != records[str(path.resolve())]["sha256"]:
            raise RuntimeError(f"CRT DLL changed after signature verification: {path.name}")
    destination = runtime / "python"
    destination.mkdir(parents=True, exist_ok=True)
    inventory = []
    for path in files:
        output = destination / path.name
        shutil.copy2(path, output)
        record = dict(records[str(path.resolve())])
        record["path"] = output.relative_to(runtime).as_posix()
        inventory.append(record)
    return {
        "msvcp": "python/msvcp140.dll",
        "version": source.parent.parent.name,
        "architecture": source.parent.name,
        "source": "Microsoft Visual Studio VC/Redist/MSVC/Microsoft.VC143.CRT",
        "files": inventory,
    }


def bundle_visual_cpp_runtime(runtime: Path, arch: str) -> dict:
    program_files = os.environ.get("ProgramFiles(x86)") or os.environ.get("ProgramFiles")
    if not program_files:
        raise RuntimeError("Cannot locate Visual Studio Installer on this Windows build host")
    vswhere = Path(program_files) / "Microsoft Visual Studio/Installer/vswhere.exe"
    if not vswhere.is_file():
        raise RuntimeError("vswhere.exe is required to locate Microsoft's redistributable CRT")
    installations = json.loads(subprocess.check_output(
        [str(vswhere), "-all", "-products", "*", "-format", "json", "-utf8"],
        text=True, encoding="utf-8", timeout=30,
    ))
    roots = [Path(item["installationPath"]) for item in installations
             if item.get("isComplete") and item.get("installationPath")]
    return copy_visual_cpp_redist(find_visual_cpp_redist(roots, arch), runtime)


def download(url: str, destination: Path, expected_sha256: str) -> None:
    digest = hashlib.sha256()
    with urlopen(url, timeout=120) as source, destination.open("wb") as output:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
            output.write(chunk)
    if digest.hexdigest() != expected_sha256:
        destination.unlink()
        raise RuntimeError(f"Checksum mismatch for {url}")


def extract_ffmpeg(wheel: Path, runtime: Path, *, windows: bool) -> Path:
    destination = runtime / "bin" / ("ffmpeg.exe" if windows else "ffmpeg")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(wheel) as archive:
        executables = [name for name in archive.namelist()
                       if name.startswith("imageio_ffmpeg/binaries/ffmpeg-") and not name.endswith("/")]
        if len(executables) != 1:
            raise ValueError("FFmpeg wheel must contain exactly one native executable")
        with archive.open(executables[0]) as source, destination.open("wb") as output:
            shutil.copyfileobj(source, output)
        licenses = runtime / "licenses/ffmpeg"
        licenses.mkdir(parents=True, exist_ok=True)
        for name in archive.namelist():
            if any(word in Path(name).name.lower() for word in ("license", "copying", "readme")) and not name.endswith("/"):
                (licenses / Path(name).name).write_bytes(archive.read(name))
    destination.chmod(0o755)
    return destination


def build_tools(runtime: Path) -> dict:
    arch = "arm64" if platform.machine().lower() in {"aarch64", "arm64"} else "x64"
    target = (sys.platform, arch)
    if target not in FFMPEG_WHEELS:
        raise RuntimeError(f"No pinned FFmpeg build for {target}; do not publish an incomplete runtime")
    result = {}
    if os.name == "nt":
        result["cppRuntime"] = bundle_visual_cpp_runtime(runtime, arch)
    with tempfile.TemporaryDirectory(prefix="work4you-core-tools-") as temporary:
        scratch = Path(temporary)
        wheel_path, checksum = FFMPEG_WHEELS[target]
        wheel = scratch / "ffmpeg.whl"
        download("https://files.pythonhosted.org/packages/" + wheel_path, wheel, checksum)
        ffmpeg = extract_ffmpeg(wheel, runtime, windows=os.name == "nt")
        version = subprocess.check_output([str(ffmpeg), "-version"], text=True, timeout=30).splitlines()[0]
        result["ffmpeg"] = {"command": ffmpeg.relative_to(runtime).as_posix(), "version": version}
        if os.name == "nt":
            suffix, git_checksum = GIT_ARCHIVES[arch]
            name = f"PortableGit-{GIT_VERSION}-{suffix}.7z.exe"
            archive = scratch / name
            download(f"https://github.com/git-for-windows/git/releases/download/v{GIT_VERSION}.windows.1/{name}", archive, git_checksum)
            git_root = runtime / "git"
            subprocess.run([str(archive), f"-o{git_root}", "-y"], check=True, timeout=600)
            git, bash = git_root / "cmd/git.exe", git_root / "bin/bash.exe"
            subprocess.run([str(git), "--version"], check=True, timeout=30)
            # No login shell: first-run scripts can write into the Git prefix.
            subprocess.run([str(bash), "--noprofile", "--norc", "-c", "printf ready"], check=True, timeout=30)
            result.update(git={"command": git.relative_to(runtime).as_posix(), "version": GIT_VERSION},
                          shell={"command": bash.relative_to(runtime).as_posix()})
    manifest_path = runtime / "capabilities.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.update(result)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-dir", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    args = parser.parse_args()
    build_tools(args.runtime_dir.resolve())


if __name__ == "__main__":
    main()
