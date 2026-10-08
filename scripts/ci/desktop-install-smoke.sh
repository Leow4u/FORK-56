#!/usr/bin/env bash
# End-to-end desktop install smoke (macOS DMG + bundled runtime deploy).
set -euo pipefail

DMG_PATH=""
JSON_OUT="install-smoke.json"
LOG_OUT="install-smoke.log"
WORK4YOU_HOME="${HOME}/.work4you"
APP_DEST="${HOME}/Applications/Work4You.app"

usage() {
  echo "Usage: desktop-install-smoke.sh --dmg PATH [--json-out FILE] [--log-out FILE] [--work4you-home DIR] [--app-dest DIR]" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dmg) DMG_PATH="${2:-}"; shift 2 ;;
    --json-out) JSON_OUT="${2:-}"; shift 2 ;;
    --log-out) LOG_OUT="${2:-}"; shift 2 ;;
    --work4you-home) WORK4YOU_HOME="${2:-}"; shift 2 ;;
    --app-dest) APP_DEST="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$DMG_PATH" ] || [ ! -f "$DMG_PATH" ]; then
  echo "DMG not found: $DMG_PATH" >&2
  exit 1
fi

export DMG_PATH JSON_OUT LOG_OUT WORK4YOU_HOME APP_DEST
python3 <<'PY'
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

dmg = Path(os.environ["DMG_PATH"]).resolve()
json_out = Path(os.environ["JSON_OUT"])
log_out = Path(os.environ["LOG_OUT"])
work4you_home = Path(os.environ["WORK4YOU_HOME"]).expanduser()
app_dest = Path(os.environ["APP_DEST"]).expanduser()

lines: list[str] = []


def log(msg: str) -> None:
    line = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) + "  " + msg
    lines.append(line)
    print(line, flush=True)


def now_ms() -> int:
    return int(time.time() * 1000)


def dir_size(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                pass
    return total


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def add_phase(phases: list, name: str, t0: int, t1: int, **extra) -> None:
    phase = {"name": name, "startMs": t0, "endMs": t1, "ms": t1 - t0}
    phase.update(extra)
    phases.append(phase)


def write_outputs(obj: dict) -> None:
    log_out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    json_out.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(obj, indent=2))


def fail(obj: dict, msg: str, start: int, phases: list) -> None:
    log(f"FAILED: {msg}")
    obj["error"] = msg
    obj["phases"] = phases
    obj["timingsMs"]["total"] = now_ms() - start
    write_outputs(obj)
    sys.exit(1)


start = now_ms()
phases: list = []
result = {
    "platform": "darwin",
    "mode": "dmg-deploy",
    "dmg": {"path": str(dmg), "bytes": dmg.stat().st_size, "sha256": ""},
    "work4youHome": str(work4you_home),
    "appDest": str(app_dest),
    "runtimeBundle": None,
    "success": False,
    "timingsMs": {},
    "phases": phases,
    "error": "",
}

log("=== Work4You desktop install smoke (macOS) ===")
log(f"DMG: {dmg} ({dmg.stat().st_size} bytes)")
t0 = now_ms()
result["dmg"]["sha256"] = sha256_file(dmg)
t1 = now_ms()
log(f"SHA256: {result['dmg']['sha256']}")
add_phase(phases, "hashDmg", t0, t1)

if work4you_home.exists():
    log(f"Removing prior WORK4YOU_HOME: {work4you_home}")
    subprocess.run(["rm", "-rf", str(work4you_home)], check=True)
if app_dest.exists():
    log(f"Removing prior app: {app_dest}")
    subprocess.run(["rm", "-rf", str(app_dest)], check=True)

mount_dir = ""
try:
    t0 = now_ms()
    attach = subprocess.run(
        ["hdiutil", "attach", "-nobrowse", "-readonly", str(dmg)],
        check=True,
        capture_output=True,
        text=True,
    )
    for line in attach.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) >= 3 and parts[2].startswith("/Volumes/"):
            mount_dir = parts[2].strip()
            break
    if not mount_dir:
        for token in attach.stdout.split():
            if token.startswith("/Volumes/"):
                mount_dir = token
                break
    t1 = now_ms()
    result["timingsMs"]["mountDmg"] = t1 - t0
    add_phase(phases, "mountDmg", t0, t1, mountDir=mount_dir)
    log(f"Mounted at: {mount_dir or '<none>'}")
    if not mount_dir or not Path(mount_dir).is_dir():
        fail(result, f"failed to mount DMG: {attach.stdout!r}", start, phases)

    src_candidates = list(Path(mount_dir).rglob("Work4You.app"))
    if not src_candidates:
        fail(result, "Work4You.app not found inside DMG", start, phases)
    src_app = src_candidates[0]
    log(f"Source app: {src_app}")

    t0 = now_ms()
    app_dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ditto", str(src_app), str(app_dest)], check=True)
    t1 = now_ms()
    result["timingsMs"]["copyApp"] = t1 - t0
    add_phase(phases, "copyApp", t0, t1, appBytes=dir_size(app_dest))
    log(f"Copied app to {app_dest} ({dir_size(app_dest)} bytes)")

    bundle_dir = app_dest / "Contents" / "Resources" / "runtime"
    stamp = app_dest / "Contents" / "Resources" / "install-stamp.json"
    manifest_path = bundle_dir / "manifest.json"
    manifest = None
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    stamp_data = None
    if stamp.is_file():
        stamp_data = json.loads(stamp.read_text(encoding="utf-8"))
    bundle_bytes = dir_size(bundle_dir)
    result["runtimeBundle"] = {
        "path": str(bundle_dir),
        "bytes": bundle_bytes,
        "present": manifest.get("present") if manifest else None,
        "commit": manifest.get("commit") if manifest else None,
        "branch": manifest.get("branch") if manifest else None,
    }
    log(
        f"Bundled runtime: {bundle_dir} ({bundle_bytes} bytes) "
        f"present={result['runtimeBundle']['present']}"
    )
    if stamp_data:
        log(f"install-stamp.json commit={stamp_data.get('commit')} branch={stamp_data.get('branch')}")

    deploy = bundle_dir / "deploy-desktop-runtime.sh"
    if not deploy.is_file():
        fail(result, f"missing deploy script: {deploy}", start, phases)

    log("Running deploy-desktop-runtime.sh (first-open path)...")
    t0 = now_ms()
    proc = subprocess.run(
        [
            "bash",
            str(deploy),
            "--bundle-dir",
            str(bundle_dir),
            "--work4you-home",
            str(work4you_home),
            "--install-stamp",
            str(stamp),
        ],
        capture_output=True,
        text=True,
    )
    t1 = now_ms()
    if proc.stdout.strip():
        log("deploy stdout:\n" + proc.stdout.strip())
    if proc.stderr.strip():
        log("deploy stderr:\n" + proc.stderr.strip())
    if proc.returncode != 0:
        fail(result, f"deploy exit {proc.returncode}", start, phases)
    result["timingsMs"]["deployRuntime"] = t1 - t0
    add_phase(phases, "deployRuntime", t0, t1)

    python_bin = work4you_home / "work4you" / "venv" / "bin" / "python3"
    marker = work4you_home / "work4you" / ".work4you-bootstrap-complete"
    fingerprint = work4you_home / "work4you" / ".runtime-fingerprint"
    if not python_bin.is_file():
        fail(result, f"missing deployed python: {python_bin}", start, phases)
    if not marker.is_file():
        fail(result, f"missing bootstrap marker: {marker}", start, phases)

    home_bytes = dir_size(work4you_home)
    log(f"WORK4YOU_HOME size after deploy: {home_bytes} bytes")
    pyvenv = work4you_home / "work4you" / "venv" / "pyvenv.cfg"
    if pyvenv.is_file():
        log("pyvenv.cfg:\n" + pyvenv.read_text(encoding="utf-8").strip())
    if fingerprint.is_file():
        log(f"runtime fingerprint: {fingerprint.read_text(encoding='utf-8').strip()}")

    t0 = now_ms()
    log("Import probe: import work4you_cli")
    probe = subprocess.run(
        [str(python_bin), "-c", "import work4you_cli; print(work4you_cli.__file__)"],
        capture_output=True,
        text=True,
        check=True,
    )
    t1 = now_ms()
    log(f"work4you_cli at: {probe.stdout.strip()}")
    result["timingsMs"]["importProbe"] = t1 - t0
    result["timingsMs"]["total"] = t1 - start
    result["deployedHomeBytes"] = home_bytes
    result["success"] = True
    add_phase(phases, "importProbe", t0, t1)
    result["phases"] = phases
    log(f"SUCCESS totalMs={result['timingsMs']['total']}")
    write_outputs(result)
finally:
    if mount_dir:
        subprocess.run(["hdiutil", "detach", mount_dir, "-quiet"], check=False)
PY
