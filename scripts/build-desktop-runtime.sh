#!/usr/bin/env bash
# Build the prebuilt macOS / POSIX desktop runtime for extraResources.
# Builds the complete app-owned runtime: portable Python with locked packages,
# precompiled interfaces, Node, core tools, browser and computer-use. The
# relocated payload is verified in place; installation never copies it to HOME.

set -euo pipefail

REPO_ROOT=""
OUT_DIR=""
PYTHON_VERSION="3.11"
NODE_FULL_VERSION="22.22.0"
RIPGREP_VERSION="14.1.1"
ZIP_OUT=""
SKIP_RELOCATE_TEST=0
ZIP_ONLY=0
REWRITE_SYMLINKS_DIR=""

RESOLVE_UV_DIR=""
PRINT_UV=0

while [ $# -gt 0 ]; do
  case "$1" in
    --repo-root) REPO_ROOT="${2:-}"; shift 2 ;;
    --out-dir) OUT_DIR="${2:-}"; shift 2 ;;
    --python-version) PYTHON_VERSION="${2:-}"; shift 2 ;;
    --node-version) NODE_FULL_VERSION="${2:-}"; shift 2 ;;
    --ripgrep-version) RIPGREP_VERSION="${2:-}"; shift 2 ;;
    --zip-out) ZIP_OUT="${2:-}"; shift 2 ;;
    --skip-relocate-test) SKIP_RELOCATE_TEST=1; shift ;;
    --zip-only) ZIP_ONLY=1; shift ;;
    --rewrite-symlinks) REWRITE_SYMLINKS_DIR="${2:-}"; shift 2 ;;
    --resolve-uv) RESOLVE_UV_DIR="${2:-}"; shift 2 ;;
    --print-uv) PRINT_UV=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Official uv installer may write $dir/uv or $dir/bin/uv. Prefer the root
# copy so `cp -a "$UV_CMD" "$OUT_DIR/bin/uv"` stays a single file.
resolve_uv_binary() {
  local uv_dir="$1"
  if [ -x "$uv_dir/uv" ]; then
    echo "$uv_dir/uv"
    return 0
  fi
  if [ -x "$uv_dir/bin/uv" ]; then
    echo "$uv_dir/bin/uv"
    return 0
  fi
  return 1
}

install_uv() {
  if command -v uv >/dev/null 2>&1; then
    command -v uv
    return 0
  fi
  local uv_dir="${TMPDIR:-/tmp}/work4you-ci-uv"
  mkdir -p "$uv_dir"
  # install.sh prints "installing to …" on stdout. Command substitution
  # must not capture that — only the resolved executable path belongs in
  # UV_CMD. Official installer lands at $dir/uv or, more often, $dir/bin/uv.
  curl -fsSL https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="$uv_dir" UV_UNMANAGED_INSTALL="$uv_dir" sh >&2
  local uv_bin
  if uv_bin="$(resolve_uv_binary "$uv_dir")"; then
    echo "$uv_bin"
    return 0
  fi
  echo "failed to install uv under $uv_dir (looked for uv and bin/uv)" >&2
  exit 1
}

if [ -n "$RESOLVE_UV_DIR" ]; then
  if bin="$(resolve_uv_binary "$RESOLVE_UV_DIR")"; then
    echo "$bin"
    exit 0
  fi
  echo "uv binary not found under $RESOLVE_UV_DIR" >&2
  exit 1
fi

if [ "$PRINT_UV" -eq 1 ]; then
  install_uv
  exit 0
fi

if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
else
  REPO_ROOT="$(cd "$REPO_ROOT" && pwd)"
fi
if [ -z "$OUT_DIR" ]; then
  OUT_DIR="$REPO_ROOT/apps/desktop/build/runtime"
fi
mkdir -p "$(dirname "$OUT_DIR")"
OUT_DIR="$(cd "$(dirname "$OUT_DIR")" && pwd)/$(basename "$OUT_DIR")"

# zip runs after `cd "$OUT_DIR"`. A relative --zip-out (CI uses
# dist/runtime-darwin-*.zip) would otherwise be created under OUT_DIR
# and fail with "zip I/O error: No such file or directory".
absolutize_path() {
  local path="$1"
  local dir base
  dir="$(dirname "$path")"
  base="$(basename "$path")"
  mkdir -p "$dir"
  echo "$(cd "$dir" && pwd)/$base"
}

write_runtime_zip() {
  if [ -z "$ZIP_OUT" ]; then
    return 0
  fi
  if [ ! -d "$OUT_DIR" ]; then
    echo "out-dir missing for zip: $OUT_DIR" >&2
    exit 1
  fi
  ZIP_OUT="$(absolutize_path "$ZIP_OUT")"
  rm -f "$ZIP_OUT"
  echo "[runtime] writing $ZIP_OUT"
  (
    cd "$OUT_DIR"
    zip -qry "$ZIP_OUT" .
  )
}

rewrite_payload_symlinks() {
  local tree="$1"
  python3 - "$REPO_ROOT" "$tree" <<'PY'
import sys
from pathlib import Path

sys.path.insert(0, sys.argv[1])
from work4you_cli.desktop_runtime import rewrite_runtime_symlinks

changed = rewrite_runtime_symlinks(Path(sys.argv[2]))
print(f"[runtime] rewrote {len(changed)} symlink(s) to stay inside the payload")
PY
}

if [ -n "$REWRITE_SYMLINKS_DIR" ]; then
  rewrite_payload_symlinks "$REWRITE_SYMLINKS_DIR"
  exit 0
fi

if [ "$ZIP_ONLY" -eq 1 ]; then
  write_runtime_zip
  exit 0
fi

SPEC="$REPO_ROOT/work4you_cli/data/runtime_payload.json"
if [ ! -f "$SPEC" ]; then
  echo "runtime allowlist missing: $SPEC" >&2
  exit 1
fi

ARCH="$(uname -m | tr '[:upper:]' '[:lower:]')"
case "$ARCH" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64|amd64) ARCH="x64" ;;
  *) ARCH="x64" ;;
esac

UV_CMD="$(install_uv)"
echo "[runtime] uv: $UV_CMD  arch=$ARCH"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/work4you" "$OUT_DIR/bin"
PAYLOAD_ROOT="$OUT_DIR/work4you"
PYTHON_HOME="$OUT_DIR/python"
NODE_HOME="$OUT_DIR/node"

echo "[runtime] copying allowlist from $REPO_ROOT"
python3 "$REPO_ROOT/scripts/ci/prepare_desktop_runtime.py" payload \
  --runtime-dir "$OUT_DIR" --repo-root "$REPO_ROOT"

echo "[runtime] installing CPython $PYTHON_VERSION"
"$UV_CMD" python install "$PYTHON_VERSION"
FOUND_PYTHON="$("$UV_CMD" python find --managed-python --no-project "$PYTHON_VERSION" | tr -d '\r')"
if [ -z "$FOUND_PYTHON" ] || [ ! -x "$FOUND_PYTHON" ]; then
  echo "uv python find $PYTHON_VERSION failed" >&2
  exit 1
fi
FOUND_BIN="$(dirname "$FOUND_PYTHON")"
if [ "$(basename "$FOUND_BIN")" = "bin" ]; then
  FOUND_HOME="$(cd "$FOUND_BIN/.." && pwd -P)"
else
  FOUND_HOME="$(cd "$FOUND_BIN" && pwd -P)"
fi
echo "[runtime] copying CPython from $FOUND_HOME"
cp -a "$FOUND_HOME" "$PYTHON_HOME"
BUNDLE_PYTHON="$PYTHON_HOME/bin/python3"
if [ ! -x "$BUNDLE_PYTHON" ]; then
  BUNDLE_PYTHON="$PYTHON_HOME/bin/python"
fi
if [ ! -x "$BUNDLE_PYTHON" ]; then
  echo "copied CPython is missing python3" >&2
  exit 1
fi

echo "[runtime] installing locked dependencies into portable Python"
python3 "$REPO_ROOT/scripts/ci/prepare_desktop_runtime.py" python \
  --runtime-dir "$OUT_DIR" --repo-root "$REPO_ROOT" --uv "$UV_CMD"
python3 "$REPO_ROOT/scripts/ci/prepare_desktop_runtime.py" interfaces \
  --runtime-dir "$OUT_DIR" --repo-root "$REPO_ROOT"

cp -a "$UV_CMD" "$OUT_DIR/bin/uv"

echo "[runtime] portable Node $NODE_FULL_VERSION"
NODE_TAR_NAME="node-v${NODE_FULL_VERSION}-darwin-${ARCH}.tar.gz"
if [ "$(uname -s)" != "Darwin" ]; then
  NODE_TAR_NAME="node-v${NODE_FULL_VERSION}-linux-${ARCH}.tar.gz"
  if [ "$ARCH" = "arm64" ]; then
    NODE_TAR_NAME="node-v${NODE_FULL_VERSION}-linux-arm64.tar.gz"
  fi
fi
NODE_TAR="${TMPDIR:-/tmp}/$NODE_TAR_NAME"
NODE_EXTRACT="${TMPDIR:-/tmp}/work4you-node-extract"
curl -fsSL "https://nodejs.org/dist/v${NODE_FULL_VERSION}/${NODE_TAR_NAME}" -o "$NODE_TAR"
rm -rf "$NODE_EXTRACT"
mkdir -p "$NODE_EXTRACT"
tar -xzf "$NODE_TAR" -C "$NODE_EXTRACT"
NODE_INNER="$(find "$NODE_EXTRACT" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ -z "$NODE_INNER" ]; then
  echo "Node archive did not contain a directory" >&2
  exit 1
fi
cp -a "$NODE_INNER" "$NODE_HOME"

echo "[runtime] ripgrep $RIPGREP_VERSION"
if [ "$(uname -s)" = "Darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    RG_ASSET="ripgrep-${RIPGREP_VERSION}-aarch64-apple-darwin.tar.gz"
  else
    RG_ASSET="ripgrep-${RIPGREP_VERSION}-x86_64-apple-darwin.tar.gz"
  fi
else
  if [ "$ARCH" = "arm64" ]; then
    RG_ASSET="ripgrep-${RIPGREP_VERSION}-aarch64-unknown-linux-musl.tar.gz"
  else
    RG_ASSET="ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz"
  fi
fi
RG_TAR="${TMPDIR:-/tmp}/$RG_ASSET"
RG_EXTRACT="${TMPDIR:-/tmp}/work4you-rg-extract"
curl -fsSL "https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${RG_ASSET}" -o "$RG_TAR"
rm -rf "$RG_EXTRACT"
mkdir -p "$RG_EXTRACT"
tar -xzf "$RG_TAR" -C "$RG_EXTRACT"
RG_EXE="$(find "$RG_EXTRACT" -type f -name rg | head -n 1)"
if [ -z "$RG_EXE" ]; then
  echo "ripgrep archive missing rg" >&2
  exit 1
fi
cp -a "$RG_EXE" "$OUT_DIR/bin/rg"

echo "[runtime] preparing standard browser and computer-use"
python3 "$REPO_ROOT/scripts/ci/build-desktop-capabilities.py" \
  --runtime-dir "$OUT_DIR" --repo-root "$REPO_ROOT" --uv "$UV_CMD"
python3 "$REPO_ROOT/scripts/ci/build-desktop-core-tools.py" \
  --runtime-dir "$OUT_DIR" --repo-root "$REPO_ROOT"
python3 "$REPO_ROOT/scripts/ci/build-desktop-voice.py" \
  --runtime-dir "$OUT_DIR" --repo-root "$REPO_ROOT"

COMMIT="${GITHUB_SHA:-}"
if [ -z "$COMMIT" ]; then
  COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
fi
BRANCH="${GITHUB_REF_NAME:-main}"
PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
if [ "$PLATFORM" = "darwin" ]; then
  PLATFORM="darwin"
elif [[ "$PLATFORM" == mingw* || "$PLATFORM" == msys* || "$PLATFORM" == cygwin* ]]; then
  PLATFORM="win32"
else
  PLATFORM="linux"
fi

python3 - "$OUT_DIR/manifest.json" <<PY
import json
from datetime import datetime, timezone
from pathlib import Path
payload = {
    "schemaVersion": 1,
    "present": True,
    "commit": """$COMMIT""",
    "branch": """$BRANCH""",
    "arch": """$ARCH""",
    "platform": """$PLATFORM""",
    "python": """$PYTHON_VERSION""",
    "node": """$NODE_FULL_VERSION""",
    "builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
Path("""$OUT_DIR/manifest.json""").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY

echo "[runtime] finalizing app-owned runtime"
python3 "$REPO_ROOT/scripts/ci/prepare_desktop_runtime.py" finalize \
  --runtime-dir "$OUT_DIR" --repo-root "$REPO_ROOT"

if [ "$SKIP_RELOCATE_TEST" -eq 0 ]; then
  echo "[runtime] verifying relocated runtime without deployment"
  python3 "$REPO_ROOT/scripts/ci/prepare_desktop_runtime.py" verify \
    --runtime-dir "$OUT_DIR" --repo-root "$REPO_ROOT"
fi

write_runtime_zip

echo "[runtime] ready at $OUT_DIR"
