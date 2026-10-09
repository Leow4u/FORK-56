#!/usr/bin/env python3
"""Prepare the standard browser and computer-use tools before app packaging.

This runs on the build host only. All recorded paths are relative to the
runtime, so installing or moving the application never needs a package manager.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import urlopen
import zipfile


AGENT_BROWSER_VERSION = "0.26.0"
AGENT_BROWSER_SHA512 = (
    "pdqSfjwbFSp+qnwlb2g23e9wXveIOfMi19xpPA9xZUbzEAUp6W4YBZj6Ybj8z4M7WkcbGDDYc+oDIHDt9R3EDQ=="
)
CUA_VERSION = "0.34.0"
CUA_ARCHIVES = {
    ("darwin", "arm64"): ("darwin-universal.tar.gz", "2d0ade531c07b4d16e8078844fe1b63a0dfa0ee19677c9dcc079b4d3460ab387"),
    ("darwin", "x64"): ("darwin-universal.tar.gz", "2d0ade531c07b4d16e8078844fe1b63a0dfa0ee19677c9dcc079b4d3460ab387"),
    ("win32", "x64"): ("windows-x86_64.zip", "f96cc1632bc88e6f268eab745277c1fc302bb0f7d123e04373e35afecad6439f"),
    ("win32", "arm64"): ("windows-arm64.zip", "bc07c7569456fb50a8c976209ceb09586f399af4391feb668b807a11abbd20e6"),
    ("linux", "x64"): ("linux-x86_64-binary.tar.gz", "629ac96eff829d4dfd5cf221f3f2165c2d813aed91e5efb7b20777a741cd70a7"),
    ("linux", "arm64"): ("linux-arm64-binary.tar.gz", "9db8b9084add57eb97be8164367b24b6be54ed4f3dc01213e64b72d7fc09fddb"),
}


def checked_download(url: str, destination: Path, expected: str, algorithm: str = "sha256") -> None:
    """Verify the pinned artifact before any of its files can be executed."""
    digest = hashlib.new(algorithm)
    partial = destination.with_suffix(destination.suffix + ".partial")
    try:
        with urlopen(url, timeout=120) as source, partial.open("wb") as output:
            while chunk := source.read(1024 * 1024):
                digest.update(chunk)
                output.write(chunk)
        actual = base64.b64encode(digest.digest()).decode() if algorithm == "sha512" else digest.hexdigest()
        if actual != expected:
            raise RuntimeError(f"Checksum mismatch for {url}")
        partial.replace(destination)
    finally:
        partial.unlink(missing_ok=True)


def extract_archive(archive: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    if archive.suffix == ".zip":
        with zipfile.ZipFile(archive) as source:
            for member in source.infolist():
                path = destination / member.filename.replace("\\", "/")
                if not path.resolve().is_relative_to(destination.resolve()):
                    raise ValueError(f"Archive entry escapes destination: {member.filename}")
                if stat.S_ISLNK(member.external_attr >> 16):
                    raise ValueError(f"Unexpected symlink in Windows archive: {member.filename}")
            source.extractall(destination)
    else:
        with tarfile.open(archive) as source:
            source.extractall(destination, filter="data")


def run(command: list[str | Path], *, env: dict[str, str], capture: bool = False) -> str:
    result = subprocess.run(
        [str(part) for part in command], env=env, check=True,
        stdout=subprocess.PIPE if capture else None, text=True, timeout=900,
    )
    return result.stdout.strip() if capture else ""


def bundle_agent_browser(runtime: Path, build_temp: Path, target_platform: str, arch: str) -> Path:
    archive = build_temp / "agent-browser.tgz"
    checked_download(
        f"https://registry.npmjs.org/agent-browser/-/agent-browser-{AGENT_BROWSER_VERSION}.tgz",
        archive, AGENT_BROWSER_SHA512, "sha512",
    )
    suffix = ".exe" if target_platform == "win32" else ""
    member_name = f"package/bin/agent-browser-{target_platform}-{arch}{suffix}"
    destination = runtime / "browsers" / "agent-browser"
    destination.mkdir(parents=True, exist_ok=True)
    executable = destination / f"agent-browser{suffix}"
    with tarfile.open(archive) as source:
        member = source.getmember(member_name)
        if not member.isfile():
            raise ValueError(f"Agent browser binary missing: {member_name}")
        with source.extractfile(member) as incoming, executable.open("wb") as output:
            shutil.copyfileobj(incoming, output)
        for name in ("package/LICENSE", "package/README.md", "package/package.json"):
            try:
                member = source.getmember(name)
            except KeyError:
                continue
            with source.extractfile(member) as incoming, (destination / Path(name).name).open("wb") as output:
                shutil.copyfileobj(incoming, output)
    executable.chmod(0o755)
    return executable


def bundle_computer_use(runtime: Path, build_temp: Path, target_platform: str, arch: str) -> Path:
    asset_suffix, digest = CUA_ARCHIVES[(target_platform, arch)]
    name = f"cua-driver-rs-{CUA_VERSION}-{asset_suffix}"
    archive = build_temp / name
    checked_download(
        f"https://github.com/trycua/cua/releases/download/cua-driver-rs-v{CUA_VERSION}/{name}",
        archive, digest,
    )
    destination = runtime / "computer-use"
    extract_archive(archive, destination)
    if target_platform == "darwin":
        # Keep the signed app bundle and its helpers together for macOS TCC.
        candidates = list(destination.glob("**/CuaDriver.app/Contents/MacOS/cua-driver"))
    else:
        candidates = list(destination.rglob("cua-driver.exe" if target_platform == "win32" else "cua-driver"))
    candidates = [path for path in candidates if path.is_file()]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one computer-use executable, found {candidates}")
    return candidates[0]


def build_capabilities(runtime: Path, repo_root: Path, uv: Path) -> dict:
    target_platform = sys.platform
    arch = "arm64" if platform.machine().lower() in {"arm64", "aarch64"} else "x64"
    if (target_platform, arch) not in CUA_ARCHIVES:
        raise RuntimeError(f"Unsupported desktop runtime target: {target_platform}/{arch}")
    python = runtime / ("python/python.exe" if target_platform == "win32" else "python/bin/python3")
    node = runtime / ("node/node.exe" if target_platform == "win32" else "node/bin/node")
    env = dict(os.environ)
    for key in ("PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV", "UV_PROJECT_ENVIRONMENT"):
        env.pop(key, None)
    env.update(PYTHONNOUSERSITE="1", PYTHONDONTWRITEBYTECODE="1", ANONYMIZED_TELEMETRY="false")
    # Every shared dependency is installed from the core uv.lock already.
    # --no-deps prevents this supplementary tooling from replacing core pins.
    run([uv, "pip", "install", "--python", python, "--break-system-packages", "--no-deps", "--require-hashes", "--only-binary=:all:",
         "-r", repo_root / "scripts/ci/desktop-browser-requirements.txt"], env=env)
    run([uv, "pip", "check", "--python", python], env=env)
    with tempfile.TemporaryDirectory(prefix="work4you-harness-probe-") as probe_home:
        run([python, "-m", "browser_harness.run", "--help"], env={**env, "BH_HOME": probe_home})

    # Playwright is pinned by the application lockfile; its revision lookup
    # and downloader are build tools, never invoked on the user's machine.
    playwright = repo_root / "node_modules/playwright"
    env["PLAYWRIGHT_BROWSERS_PATH"] = str(runtime / "browsers" / "chromium")
    run([node, playwright / "cli.js", "install", "chromium", "--no-shell"], env=env)
    chrome = Path(run([node, "-e", "console.log(require(process.argv[1]).chromium.executablePath())", playwright], env=env, capture=True))
    if not chrome.is_file() or not chrome.resolve().is_relative_to(runtime.resolve()):
        raise RuntimeError(f"Chromium was not installed inside the runtime: {chrome}")
    with tempfile.TemporaryDirectory(prefix="work4you-capabilities-") as temp:
        agent_browser = bundle_agent_browser(runtime, Path(temp), target_platform, arch)
        computer_use = bundle_computer_use(runtime, Path(temp), target_platform, arch)
    run([agent_browser, "--version"], env=env)
    run([computer_use, "--version"], env=env)
    relative = lambda path: path.relative_to(runtime).as_posix()
    capabilities = {
        "browser": {"command": relative(agent_browser), "executable": relative(chrome), "version": AGENT_BROWSER_VERSION},
        "browserUse": {"module": "browser_harness.run", "version": "0.1.13"},
        "computerUse": {"command": relative(computer_use), "version": CUA_VERSION},
    }
    (runtime / "capabilities.json").write_text(json.dumps(capabilities, indent=2) + "\n", encoding="utf-8")
    return capabilities


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-dir", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--uv", type=Path, required=True)
    args = parser.parse_args()
    build_capabilities(args.runtime_dir.resolve(), args.repo_root.resolve(), args.uv.resolve())


if __name__ == "__main__":
    main()
