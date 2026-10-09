#!/usr/bin/env bash
# Native DMG install + actual Electron/backend readiness. Always uses a new sandbox.
set -euo pipefail
smoke_args=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dmg) smoke_args+=(--installer "$2"); shift 2 ;;
    --next-dmg) smoke_args+=(--next-installer "$2"); shift 2 ;;
    *) smoke_args+=("$1"); shift ;;
  esac
done
exec python3 "$(dirname "$0")/desktop_install_smoke.py" "${smoke_args[@]}"
