#!/usr/bin/env bash
# End-to-end desktop install smoke (macOS DMG + bundled runtime deploy).
set -euo pipefail

DMG_PATH=""
JSON_OUT="install-smoke.json"
WORK4YOU_HOME="${HOME}/.work4you"
APP_DEST="${HOME}/Applications/Work4You.app"

usage() {
  echo "Usage: desktop-install-smoke.sh --dmg PATH [--json-out FILE] [--work4you-home DIR] [--app-dest DIR]" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dmg) DMG_PATH="${2:-}"; shift 2 ;;
    --json-out) JSON_OUT="${2:-}"; shift 2 ;;
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

MOUNT_DIR=""
cleanup() {
  if [ -n "$MOUNT_DIR" ] && [ -d "$MOUNT_DIR" ]; then
    hdiutil detach "$MOUNT_DIR" -quiet || true
  fi
}
trap cleanup EXIT

export DMG_PATH JSON_OUT WORK4YOU_HOME APP_DEST
python3 <<'PY'
import json
import os
import subprocess
import sys
import time
from pathlib import Path

dmg = Path(os.environ["DMG_PATH"]).resolve()
json_out = Path(os.environ["JSON_OUT"])
work4you_home = Path(os.environ["WORK4YOU_HOME"]).expanduser()
app_dest = Path(os.environ["APP_DEST"]).expanduser()

def now_ms() -> int:
    return int(time.time() * 1000)

def write_result(obj: dict) -> None:
    json_out.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(obj, indent=2))

def fail(obj: dict, msg: str, start: int) -> None:
    obj["error"] = msg
    obj["timingsMs"]["total"] = now_ms() - start
    write_result(obj)
    sys.exit(1)

start = now_ms()
result = {
    "platform": "darwin",
    "mode": "dmg-deploy",
    "dmg": str(dmg),
    "work4youHome": str(work4you_home),
    "appDest": str(app_dest),
    "success": False,
    "timingsMs": {},
    "error": "",
}

if work4you_home.exists():
    subprocess.run(["rm", "-rf", str(work4you_home)], check=True)
if app_dest.exists():
    subprocess.run(["rm", "-rf", str(app_dest)], check=True)

t0 = now_ms()
attach = subprocess.run(
    ["hdiutil", "attach", "-nobrowse", "-readonly", str(dmg)],
    check=True,
    capture_output=True,
    text=True,
)
mount_dir = ""
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
if not mount_dir or not Path(mount_dir).is_dir():
    fail(result, f"failed to mount DMG: {attach.stdout!r}", start)
result["timingsMs"]["mountDmg"] = now_ms() - t0

try:
    src_candidates = list(Path(mount_dir).rglob("Work4You.app"))
    if not src_candidates:
        fail(result, "Work4You.app not found inside DMG", start)
    src_app = src_candidates[0]

    t0 = now_ms()
    app_dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ditto", str(src_app), str(app_dest)], check=True)
    result["timingsMs"]["copyApp"] = now_ms() - t0

    bundle_dir = app_dest / "Contents" / "Resources" / "runtime"
    stamp = app_dest / "Contents" / "Resources" / "install-stamp.json"
    deploy = bundle_dir / "deploy-desktop-runtime.sh"
    if not deploy.is_file():
        fail(result, f"missing deploy script: {deploy}", start)

    t0 = now_ms()
    subprocess.run(
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
        check=True,
    )
    result["timingsMs"]["deployRuntime"] = now_ms() - t0

    python_bin = work4you_home / "work4you" / "venv" / "bin" / "python3"
    marker = work4you_home / "work4you" / ".work4you-bootstrap-complete"
    if not python_bin.is_file():
        fail(result, f"missing deployed python: {python_bin}", start)
    if not marker.is_file():
        fail(result, f"missing bootstrap marker: {marker}", start)

    t0 = now_ms()
    subprocess.run(
        [str(python_bin), "-c", "import work4you_cli; print('ok')"],
        check=True,
    )
    result["timingsMs"]["importProbe"] = now_ms() - t0
    result["timingsMs"]["total"] = now_ms() - start
    result["success"] = True
    write_result(result)
finally:
    if mount_dir:
        subprocess.run(["hdiutil", "detach", mount_dir, "-quiet"], check=False)
PY
