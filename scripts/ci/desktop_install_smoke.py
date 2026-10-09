#!/usr/bin/env python3
"""Measure a packaged install and exercise its real Electron/backend data path.

Runs only on native Windows/macOS hosts. The independent ``next`` artifact is
optional; without it the second pass is explicitly a reinstall, not an upgrade.
No model calls, downloads, or destructive cleanup of an existing user home.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
PROBE = ROOT / "scripts/ci/desktop-runtime-smoke.mjs"


def artifact_identity(path: Path) -> dict:
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    return {"name": path.name, "bytes": path.stat().st_size, "sha256": digest}


def check_digest(identity: dict, expected: str | None) -> None:
    if expected and identity["sha256"] != expected.removeprefix("sha256:"):
        raise ValueError("Installer SHA256 differs from the pinned release asset")


def run(args: list[str], *, timeout: int = 600, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        args, check=True, timeout=timeout, env=env, capture_output=True,
        text=True, encoding="utf-8", errors="replace",
    )


def install(artifact: Path, app_dir: Path, *, signed: bool, env: dict) -> tuple[Path, dict]:
    timings = {}
    if sys.platform == "win32":
        if signed:
            # Reuse the release verifier: PowerShell 7's inherited module path
            # otherwise breaks the PowerShell 5.1 Authenticode command on CI.
            from sign_windows_esigner import verify_authenticode
            verify_authenticode(artifact)
        started = time.monotonic()
        # NSIS /D must be last, unquoted even with spaces. subprocess.list2cmdline
        # quotes the entire /D= argument, which NSIS parses differently.
        command = subprocess.list2cmdline([str(artifact), "/S"]) + " /D=" + str(app_dir)
        subprocess.run(command, check=True, timeout=1200, env=env, capture_output=True)
        timings["install"] = round((time.monotonic() - started) * 1000)
        executable = app_dir / "Work4You.exe"
    elif sys.platform == "darwin":
        started = time.monotonic()
        mounted = subprocess.run(["hdiutil", "attach", "-nobrowse", "-readonly", "-plist", str(artifact)],
                                 check=True, capture_output=True, timeout=180)
        timings["mountDmg"] = round((time.monotonic() - started) * 1000)
        entities = plistlib.loads(mounted.stdout)["system-entities"]
        mount = next(Path(item["mount-point"]) for item in entities if "mount-point" in item)
        try:
            source = next(mount.glob("*.app"))
            if signed:
                run(["codesign", "--verify", "--deep", "--strict", str(source)])
                run(["spctl", "--assess", "--type", "execute", str(source)])
            started = time.monotonic()
            # Match replacement of the app, not a merge leaving removed files.
            if app_dir.exists():
                import shutil
                shutil.rmtree(app_dir)
            run(["ditto", str(source), str(app_dir)], env=env)
            timings["copyApp"] = round((time.monotonic() - started) * 1000)
            timings["install"] = timings["mountDmg"] + timings["copyApp"]
        finally:
            run(["hdiutil", "detach", str(mount), "-quiet"], timeout=180)
        executable = app_dir / "Contents/MacOS/Work4You"
    else:
        raise RuntimeError("Installer smoke requires a native Windows or macOS runner")
    if not executable.is_file():
        raise RuntimeError("Installed executable was not found")
    return executable, timings


def smoke(args: argparse.Namespace) -> dict:
    if sys.platform not in {"win32", "darwin"}:
        raise RuntimeError("Installer smoke requires a native Windows or macOS runner")
    # All mutable state belongs to a new sandbox. Never remove an existing home.
    sandbox = Path(tempfile.mkdtemp(prefix="work4you-install-smoke-"))
    home = sandbox / "user-data"
    user_data = sandbox / "electron-user-data"
    app_dir = sandbox / ("Work4You.app" if sys.platform == "darwin" else "Installed App")
    env = {**os.environ, "WORK4YOU_HOME": str(home), "WORK4YOU_DESKTOP_USER_DATA_DIR": str(user_data)}
    result = {"schemaVersion": 2, "platform": sys.platform, "success": False,
              "sandbox": str(sandbox), "work4youHome": str(home), "installDir": str(app_dir),
              "machine": {"system": platform.platform(), "architecture": platform.machine()},
              "scope": "packaged install, actual Electron/HTTP/WebSocket readiness and persistent data; no model call",
              "passes": [], "timingsMs": {}}
    run(["node", str(PROBE), "seed", "--home", str(home)])
    try:
        passes = [("fresh-install", args.installer, args.commit, args.sha256)]
        passes.append(("next-release" if args.next_installer else "same-release-reinstall",
                       args.next_installer or args.installer, args.next_commit or args.commit,
                       args.next_sha256 if args.next_installer else args.sha256))
        for index, (label, artifact, commit, digest) in enumerate(passes):
            artifact = artifact.resolve()
            identity = artifact_identity(artifact)
            check_digest(identity, digest)
            entry = {"name": label, "artifact": identity, "expectedCommit": commit, "success": False}
            result["passes"].append(entry)
            executable, timings = install(artifact, app_dir, signed=args.require_signed, env=env)
            entry["timingsMs"] = timings
            entry["signatureVerified"] = args.require_signed
            probe_out = sandbox / f"probe-{index}.json"
            command = ["node", str(PROBE), "probe", "--exe", str(executable), "--home", str(home),
                       "--user-data", str(user_data), "--out", str(probe_out),
                       "--seed-session", "true" if index == 0 else "false"]
            if commit:
                command += ["--commit", commit]
            try:
                run(command, timeout=360, env=env)
            finally:
                if probe_out.exists():
                    entry["probe"] = json.loads(probe_out.read_text(encoding="utf-8"))
            probe = entry.get("probe", {})
            if not probe.get("success"):
                raise RuntimeError(probe.get("error", "Packaged runtime probe failed"))
            timings.update(probe["timingsMs"])
            # Explicit sum: hash/signature/fixtures/instrumentation are excluded.
            timings["installToBackendUsable"] = timings["install"] + timings["backendUsable"]
            entry.update(success=True, timingsMs=timings)
            if index == 0:
                result["timingsMs"] = timings
            elif args.next_installer and probe["commit"] == result["passes"][0]["probe"]["commit"]:
                raise RuntimeError("Next-release validation requires a different packaged commit")
        result["success"] = True
    except Exception as error:
        # Do not dump child environments, stdout, tokens, or credentials.
        result["error"] = str(error)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installer", required=True, type=Path)
    parser.add_argument("--next-installer", type=Path)
    parser.add_argument("--commit", default="")
    parser.add_argument("--next-commit", default="")
    parser.add_argument("--sha256", default="")
    parser.add_argument("--next-sha256", default="")
    parser.add_argument("--require-signed", action="store_true")
    parser.add_argument("--json-out", required=True, type=Path)
    parser.add_argument("--log-out", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = smoke(args)
    except Exception as error:
        result = {"schemaVersion": 2, "platform": sys.platform, "success": False, "error": str(error)}
    serialized = json.dumps(result, indent=2) + "\n"
    args.json_out.write_text(serialized, encoding="utf-8")
    args.log_out.write_text(serialized, encoding="utf-8")
    print(serialized)
    return 0 if result["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
