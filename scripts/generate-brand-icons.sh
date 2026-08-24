#!/usr/bin/env bash
# Regenerate Work4You favicons/icons from the canonical marketing asset.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/sites/work4you-home/public/brand/work4you-favicon-transparent-1024.png"
TMP="$(mktemp -d)"

if [[ ! -f "$SRC" ]]; then
  echo "missing canonical icon: $SRC" >&2
  exit 1
fi

echo "==> Source: $SRC"

npx --yes png2icons@2.0.1 "$SRC" "$TMP/work4you" -all >/dev/null

python3 - <<'PY' "$SRC" "$TMP"
import sys
from pathlib import Path
from PIL import Image

src = Path(sys.argv[1])
tmp = Path(sys.argv[2])
img = Image.open(src).convert('RGBA')

for size, name in ((16, 'favicon-16x16.png'), (32, 'favicon-32x32.png'), (180, 'apple-touch-icon.png'), (1024, 'work4you-icon.png')):
    out = tmp / name
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(out)
    print(f'wrote {out} ({size}x{size})')
PY

copy() {
  install -D -m 0644 "$1" "$2"
  echo "  -> $2"
}

echo "==> Portal (Next.js)"
copy "$TMP/work4you.ico" "$ROOT/work4you-account-service/src/app/favicon.ico"

echo "==> Desktop (Electron)"
copy "$TMP/work4you.ico" "$ROOT/apps/desktop/assets/icon.ico"
copy "$TMP/work4you.icns" "$ROOT/apps/desktop/assets/icon.icns"
copy "$SRC" "$ROOT/apps/desktop/assets/icon.png"
copy "$TMP/apple-touch-icon.png" "$ROOT/apps/desktop/public/apple-touch-icon.png"
copy "$TMP/work4you-icon.png" "$ROOT/apps/desktop/public/work4you-icon.png"

echo "==> Bootstrap installer (Tauri)"
copy "$TMP/work4you.ico" "$ROOT/apps/bootstrap-installer/src-tauri/icons/icon.ico"
copy "$TMP/work4you.icns" "$ROOT/apps/bootstrap-installer/src-tauri/icons/icon.icns"
python3 - <<'PY' "$SRC" "$ROOT/apps/bootstrap-installer/src-tauri/icons"
from PIL import Image
from pathlib import Path
import sys
src = Path(sys.argv[1])
icons = Path(sys.argv[2])
img = Image.open(src).convert('RGBA')
for size, name in ((32, '32x32.png'), (128, '128x128.png'), (256, '128x128@2x.png')):
    img.resize((size, size), Image.Resampling.LANCZOS).save(icons / name)
    print(f'  -> {icons / name}')
PY
copy "$TMP/work4you-icon.png" "$ROOT/apps/bootstrap-installer/public/work4you-icon.png"

echo "==> Docs site + web dashboard"
copy "$TMP/work4you.ico" "$ROOT/website/static/img/favicon.ico"
copy "$TMP/favicon-16x16.png" "$ROOT/website/static/img/favicon-16x16.png"
copy "$TMP/favicon-32x32.png" "$ROOT/website/static/img/favicon-32x32.png"
copy "$TMP/apple-touch-icon.png" "$ROOT/website/static/img/apple-touch-icon.png"
copy "$TMP/work4you.ico" "$ROOT/web/public/favicon.ico"

echo "==> Portal static (Vite)"
copy "$SRC" "$ROOT/sites/work4you-portal/public/brand/work4you-favicon-transparent-1024.png"

echo "==> Portal (NAS sync → work4you-account-service)"
copy "$TMP/work4you.ico" "$ROOT/cloud/nas-sync/src/app/favicon.ico"
copy "$SRC" "$ROOT/cloud/nas-sync/public/brand/work4you-favicon-transparent-1024.png"

rm -rf "$TMP"
echo "==> Done"
