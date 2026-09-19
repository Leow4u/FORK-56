#!/usr/bin/env bash
# Deploy the prebuilt desktop runtime (Cursor-model macOS / POSIX).
# Called from packaged Electron first-open (and Repair) when extraResources
# runtime/manifest.json has present:true. Copies the tree into WORK4YOU_HOME,
# rewrites pyvenv.cfg, seeds HOME templates only when missing, writes
# ~/.local/bin shims, and writes the bootstrap marker.
# Does NOT call install.sh stages, GitHub, or PyPI.
#
# Exit 0 when there is no present runtime (dev packs / stub extraResources).
# Exit 1 only when a present bundle failed to deploy or failed the import probe.

set -euo pipefail

BUNDLE_DIR=""
WORK4YOU_HOME=""
INSTALL_STAMP_PATH=""
PINNED_COMMIT=""
PINNED_BRANCH="main"
SKIP_IMPORT_PROBE=0
FORCE=0

usage() {
  echo "Usage: deploy-desktop-runtime.sh --bundle-dir DIR --work4you-home DIR [--install-stamp FILE] [--pinned-commit SHA] [--pinned-branch NAME] [--skip-import-probe] [--force]" >&2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --bundle-dir) BUNDLE_DIR="${2:-}"; shift 2 ;;
    --work4you-home) WORK4YOU_HOME="${2:-}"; shift 2 ;;
    --install-stamp) INSTALL_STAMP_PATH="${2:-}"; shift 2 ;;
    --pinned-commit) PINNED_COMMIT="${2:-}"; shift 2 ;;
    --pinned-branch) PINNED_BRANCH="${2:-}"; shift 2 ;;
    --skip-import-probe) SKIP_IMPORT_PROBE=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$BUNDLE_DIR" ] || [ -z "$WORK4YOU_HOME" ]; then
  usage
  exit 1
fi

BUNDLE_DIR="$(cd "$BUNDLE_DIR" && pwd)"
mkdir -p "$WORK4YOU_HOME"
WORK4YOU_HOME="$(cd "$WORK4YOU_HOME" && pwd)"

read_json_field() {
  # $1 file $2 key — best-effort, no extra deps.
  python3 -c '
import json, sys
try:
    data = json.loads(open(sys.argv[1], encoding="utf-8").read())
except Exception:
    raise SystemExit(0)
val = data.get(sys.argv[2])
if val is None:
    raise SystemExit(0)
print(val)
' "$1" "$2" 2>/dev/null || true
}

MANIFEST="$BUNDLE_DIR/manifest.json"
PRESENT="$(read_json_field "$MANIFEST" present)"
if [ "$PRESENT" != "True" ] && [ "$PRESENT" != "true" ]; then
  echo "[work4you] no present prebuilt runtime in $BUNDLE_DIR; skipping deploy"
  exit 0
fi

if [ ! -d "$BUNDLE_DIR/work4you" ] || [ ! -d "$BUNDLE_DIR/python" ]; then
  echo "present runtime manifest is missing work4you/ or python/" >&2
  exit 1
fi

if [ -z "$PINNED_COMMIT" ] && [ -n "$INSTALL_STAMP_PATH" ] && [ -f "$INSTALL_STAMP_PATH" ]; then
  PINNED_COMMIT="$(read_json_field "$INSTALL_STAMP_PATH" commit)"
  if [ -z "$PINNED_BRANCH" ] || [ "$PINNED_BRANCH" = "main" ]; then
    stamp_branch="$(read_json_field "$INSTALL_STAMP_PATH" branch)"
    if [ -n "$stamp_branch" ]; then
      PINNED_BRANCH="$stamp_branch"
    fi
  fi
fi
if [ -z "$PINNED_COMMIT" ]; then
  PINNED_COMMIT="$(read_json_field "$MANIFEST" commit)"
fi
if [ -z "$PINNED_BRANCH" ]; then
  PINNED_BRANCH="$(read_json_field "$MANIFEST" branch)"
fi
PINNED_BRANCH="${PINNED_BRANCH:-main}"

INSTALL_DIR="$WORK4YOU_HOME/work4you"
PYTHON_HOME="$WORK4YOU_HOME/python"

runtime_already_current() {
  # work4you_cli/runtime_fingerprint.py is stdlib-only; the bundle copy wins.
  python3 -c '
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from work4you_cli.runtime_fingerprint import installed_runtime_is_current
raise SystemExit(0 if installed_runtime_is_current(Path(sys.argv[2]), Path(sys.argv[3])) else 1)
' "$BUNDLE_DIR/work4you" "$BUNDLE_DIR" "$WORK4YOU_HOME"
}

finish_without_copy() {
  echo "[work4you] prebuilt runtime already current at $INSTALL_DIR; skipping copy"
  rewrite_pyvenv_cfg
  mkdir -p "$WORK4YOU_HOME/cron" "$WORK4YOU_HOME/sessions" "$WORK4YOU_HOME/logs" \
    "$WORK4YOU_HOME/pairing" "$WORK4YOU_HOME/hooks" "$WORK4YOU_HOME/image_cache" \
    "$WORK4YOU_HOME/audio_cache" "$WORK4YOU_HOME/memories" "$WORK4YOU_HOME/skills"
  if [ ! -f "$WORK4YOU_HOME/.env" ]; then
    if [ -f "$INSTALL_DIR/.env.example" ]; then
      cp "$INSTALL_DIR/.env.example" "$WORK4YOU_HOME/.env"
    else
      : > "$WORK4YOU_HOME/.env"
    fi
  fi
  if [ ! -f "$WORK4YOU_HOME/config.yaml" ] && [ -f "$INSTALL_DIR/cli-config.yaml.example" ]; then
    cp "$INSTALL_DIR/cli-config.yaml.example" "$WORK4YOU_HOME/config.yaml"
  fi
  if [ ! -f "$WORK4YOU_HOME/SOUL.md" ]; then
    printf '%s\n' "You are Work4You, an intelligent AI assistant created by Work4You. You are helpful, knowledgeable, and direct. You assist users with a wide range of tasks including answering questions, writing and editing code, analyzing information, creative work, and executing actions via your tools. You communicate clearly, admit uncertainty when appropriate, and prioritize being genuinely useful over being verbose unless otherwise directed below. Be targeted and efficient in your exploration and investigations." > "$WORK4YOU_HOME/SOUL.md"
  fi
  printf 'desktop\n' > "$INSTALL_DIR/.install_method"
  python3 -c '
import json
from datetime import datetime, timezone
from pathlib import Path
payload = {
    "commit": "'"$PINNED_COMMIT"'",
    "branch": "'"$PINNED_BRANCH"'",
    "ref": "'"${PINNED_COMMIT:-$PINNED_BRANCH}"'",
    "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
Path("'"$INSTALL_DIR"'/.runtime-ref").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
' 2>/dev/null || printf '{\n  "commit": "%s",\n  "branch": "%s",\n  "ref": "%s"\n}\n' \
    "$PINNED_COMMIT" "$PINNED_BRANCH" "${PINNED_COMMIT:-$PINNED_BRANCH}" > "$INSTALL_DIR/.runtime-ref"
  if [ "${#PINNED_COMMIT}" -ge 7 ]; then
    python3 -c '
import json
from datetime import datetime, timezone
from pathlib import Path
payload = {
    "schemaVersion": 1,
    "pinnedCommit": "'"$PINNED_COMMIT"'",
    "pinnedBranch": "'"$PINNED_BRANCH"'",
    "completedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
}
Path("'"$INSTALL_DIR"'/.work4you-bootstrap-complete").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
' 2>/dev/null || printf '{\n  "schemaVersion": 1,\n  "pinnedCommit": "%s",\n  "pinnedBranch": "%s"\n}\n' \
      "$PINNED_COMMIT" "$PINNED_BRANCH" > "$INSTALL_DIR/.work4you-bootstrap-complete"
  fi
  echo "[work4you] prebuilt runtime ready at $INSTALL_DIR"
  exit 0
}

copy_replace_dir() {
  local src="$1"
  local dest="$2"
  shift 2
  mkdir -p "$dest"
  local name
  for name in $(cd "$src" && ls -A); do
    local skip=0
    local p
    for p in "$@"; do
      if [ "$name" = "$p" ]; then
        skip=1
        break
      fi
    done
    if [ "$skip" -eq 1 ]; then
      continue
    fi
    rm -rf "$dest/$name"
    cp -a "$src/$name" "$dest/$name"
  done
}

rewrite_pyvenv_cfg() {
  local cfg="$INSTALL_DIR/venv/pyvenv.cfg"
  if [ ! -f "$cfg" ]; then
    return 0
  fi
  local executable=""
  if [ -x "$PYTHON_HOME/bin/python3" ]; then
    executable="$PYTHON_HOME/bin/python3"
  elif [ -x "$PYTHON_HOME/bin/python" ]; then
    executable="$PYTHON_HOME/bin/python"
  else
    executable="$PYTHON_HOME/bin/python3"
  fi
  python3 -c '
from pathlib import Path
import sys
sys.path.insert(0, str(Path(sys.argv[1])))
from work4you_cli.desktop_runtime import rewrite_pyvenv_cfg
cfg = Path(sys.argv[2])
text = cfg.read_text(encoding="utf-8") if cfg.is_file() else "home = \n"
cfg.write_text(rewrite_pyvenv_cfg(text, sys.argv[3], executable=sys.argv[4]), encoding="utf-8")
' "$INSTALL_DIR" "$cfg" "$PYTHON_HOME" "$executable" 2>/dev/null || {
    {
      echo "home = $PYTHON_HOME"
      grep -v -E '^[[:space:]]*(home|executable)[[:space:]]*=' "$cfg" || true
      echo "executable = $executable"
    } > "$cfg.tmp"
    mv "$cfg.tmp" "$cfg"
  }
}

if [ "$FORCE" -eq 0 ] && runtime_already_current; then
  skip_ok=0
  if [ "$SKIP_IMPORT_PROBE" -eq 1 ]; then
    skip_ok=1
  else
    VENV_PY="$INSTALL_DIR/venv/bin/python"
    if [ ! -x "$VENV_PY" ] && [ -x "$INSTALL_DIR/venv/bin/python3" ]; then
      VENV_PY="$INSTALL_DIR/venv/bin/python3"
    fi
    if [ -x "$VENV_PY" ] && PYTHONPATH="$INSTALL_DIR" PYTHONUTF8=1 "$VENV_PY" -c "import work4you_cli"; then
      skip_ok=1
    fi
  fi
  if [ "$skip_ok" -eq 1 ]; then
    finish_without_copy
  fi
fi

echo "[work4you] deploying prebuilt runtime to $WORK4YOU_HOME"

for name in python node bin; do
  if [ -d "$BUNDLE_DIR/$name" ]; then
    rm -rf "$WORK4YOU_HOME/$name"
    cp -a "$BUNDLE_DIR/$name" "$WORK4YOU_HOME/$name"
  fi
done

copy_replace_dir "$BUNDLE_DIR/work4you" "$INSTALL_DIR" .env .git

python3 -c '
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from work4you_cli.desktop_runtime import rewrite_runtime_symlinks
rewrite_runtime_symlinks(Path(sys.argv[2]))
' "$INSTALL_DIR" "$WORK4YOU_HOME" || echo "[work4you] symlink rewrite skipped" >&2

rewrite_pyvenv_cfg

mkdir -p "$WORK4YOU_HOME/cron" "$WORK4YOU_HOME/sessions" "$WORK4YOU_HOME/logs" \
  "$WORK4YOU_HOME/pairing" "$WORK4YOU_HOME/hooks" "$WORK4YOU_HOME/image_cache" \
  "$WORK4YOU_HOME/audio_cache" "$WORK4YOU_HOME/memories" "$WORK4YOU_HOME/skills"

if [ ! -f "$WORK4YOU_HOME/.env" ]; then
  if [ -f "$INSTALL_DIR/.env.example" ]; then
    cp "$INSTALL_DIR/.env.example" "$WORK4YOU_HOME/.env"
  else
    : > "$WORK4YOU_HOME/.env"
  fi
fi
if [ ! -f "$WORK4YOU_HOME/config.yaml" ] && [ -f "$INSTALL_DIR/cli-config.yaml.example" ]; then
  cp "$INSTALL_DIR/cli-config.yaml.example" "$WORK4YOU_HOME/config.yaml"
fi
if [ ! -f "$WORK4YOU_HOME/SOUL.md" ]; then
  printf '%s\n' "You are Work4You, an intelligent AI assistant created by Work4You. You are helpful, knowledgeable, and direct. You assist users with a wide range of tasks including answering questions, writing and editing code, analyzing information, creative work, and executing actions via your tools. You communicate clearly, admit uncertainty when appropriate, and prioritize being genuinely useful over being verbose unless otherwise directed below. Be targeted and efficient in your exploration and investigations." > "$WORK4YOU_HOME/SOUL.md"
fi

printf 'desktop\n' > "$INSTALL_DIR/.install_method"

python3 -c '
import json
from datetime import datetime, timezone
from pathlib import Path
payload = {
    "commit": "'"$PINNED_COMMIT"'",
    "branch": "'"$PINNED_BRANCH"'",
    "ref": "'"${PINNED_COMMIT:-$PINNED_BRANCH}"'",
    "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
Path("'"$INSTALL_DIR"'/.runtime-ref").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
' 2>/dev/null || printf '{\n  "commit": "%s",\n  "branch": "%s",\n  "ref": "%s"\n}\n' \
  "$PINNED_COMMIT" "$PINNED_BRANCH" "${PINNED_COMMIT:-$PINNED_BRANCH}" > "$INSTALL_DIR/.runtime-ref"

LAUNCHER_DIR="$INSTALL_DIR/bin"
mkdir -p "$LAUNCHER_DIR"
VENV_BIN="$INSTALL_DIR/venv/bin"
VENV_PY="$VENV_BIN/python"
if [ ! -x "$VENV_PY" ] && [ -x "$VENV_BIN/python3" ]; then
  VENV_PY="$VENV_BIN/python3"
fi
ENTRYPOINT="$INSTALL_DIR/work4you"
for launcher in work4you work4you-acp; do
  if [ -f "$VENV_BIN/$launcher" ]; then
    cp -a "$VENV_BIN/$launcher" "$LAUNCHER_DIR/$launcher"
  fi
done

# Public shims in ~/.local/bin — same contract as install.sh (macOS has no
# realpath on stock /bin, so exec the venv interpreter + checked-in entry).
LINK_DIR="${HOME:-}/.local/bin"
if [ -n "${HOME:-}" ]; then
  mkdir -p "$LINK_DIR"
  if [ -x "$VENV_PY" ] && [ -f "$ENTRYPOINT" ]; then
    cat > "$LINK_DIR/work4you" <<EOF
#!/usr/bin/env bash
unset PYTHONPATH
unset PYTHONHOME
exec "$VENV_PY" "$ENTRYPOINT" "\$@"
EOF
    cat > "$LINK_DIR/work4you-acp" <<EOF
#!/usr/bin/env bash
unset PYTHONPATH
unset PYTHONHOME
exec "$VENV_PY" "$ENTRYPOINT" acp "\$@"
EOF
    chmod +x "$LINK_DIR/work4you" "$LINK_DIR/work4you-acp"
  fi
  case ":${PATH:-}:" in
    *":$LINK_DIR:"*) ;;
    *)
      PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'
      for rc in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.bashrc" "$HOME/.profile"; do
        if [ -f "$rc" ] && ! grep -v '^[[:space:]]*#' "$rc" 2>/dev/null | grep -qE 'PATH=.*\.local/bin'; then
          printf '\n# Work4You — ensure ~/.local/bin is on PATH\n%s\n' "$PATH_LINE" >> "$rc"
        fi
      done
      if [ ! -f "$HOME/.zshrc" ] && [ ! -f "$HOME/.zprofile" ] && [ ! -f "$HOME/.bashrc" ]; then
        touch "$HOME/.zshrc"
        printf '\n# Work4You — ensure ~/.local/bin is on PATH\n%s\n' "$PATH_LINE" >> "$HOME/.zshrc"
      fi
      ;;
  esac
fi

export WORK4YOU_HOME
if [ "$SKIP_IMPORT_PROBE" -eq 0 ]; then
  if [ ! -x "$VENV_PY" ]; then
    echo "deployed runtime is missing $VENV_PY" >&2
    exit 1
  fi
  export PYTHONPATH="$INSTALL_DIR${PYTHONPATH:+:$PYTHONPATH}"
  export PYTHONUTF8=1
  if ! "$VENV_PY" -c "import work4you_cli"; then
    echo "deployed interpreter cannot import work4you_cli" >&2
    exit 1
  fi
fi

if [ "${#PINNED_COMMIT}" -ge 7 ]; then
  python3 -c '
import json
from datetime import datetime, timezone
from pathlib import Path
payload = {
    "schemaVersion": 1,
    "pinnedCommit": "'"$PINNED_COMMIT"'",
    "pinnedBranch": "'"$PINNED_BRANCH"'",
    "completedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
}
Path("'"$INSTALL_DIR"'/.work4you-bootstrap-complete").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
' 2>/dev/null || printf '{\n  "schemaVersion": 1,\n  "pinnedCommit": "%s",\n  "pinnedBranch": "%s"\n}\n' \
    "$PINNED_COMMIT" "$PINNED_BRANCH" > "$INSTALL_DIR/.work4you-bootstrap-complete"
fi

echo "[work4you] prebuilt runtime ready at $INSTALL_DIR"
exit 0
