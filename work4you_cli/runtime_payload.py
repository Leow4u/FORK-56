"""Desktop runtime payload — filtered tree for consumer Setup / first-launch.

Consumer desktop installs must not clone the monorepo. This module is the
allowlist + extract/replace contract used by ``work4you update`` (method
``desktop``). The Windows/POSIX installers embed the same lists so they can
filter a GitHub ZIP before ``work4you_cli`` exists on disk.

Git / CLI / dev checkouts are unchanged: they keep cloning and ``git pull``.
"""

from __future__ import annotations

import json
import os
import stat
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, Optional
from urllib.request import Request, urlopen

INSTALL_METHOD = "desktop"
RUNTIME_REF_FILENAME = ".runtime-ref"
DEFAULT_GITHUB_REPO = "Leow4u/FORK-56"

# Names that must survive a payload replace. These are local state, not
# upstream source — wiping them would destroy the venv / bootstrap marker.
RUNTIME_PRESERVE = frozenset(
    {
        ".env",
        ".git",
        ".install_method",
        ".runtime-ref",
        ".work4you-bootstrap-complete",
        "bin",
        "node_modules",
        "venv",
    }
)

_FALLBACK_SPEC = {
    "directories": [
        "acp_adapter",
        "agent",
        "cron",
        "gateway",
        "locales",
        "optional-mcps",
        "optional-skills",
        "plugins",
        "providers",
        "skills",
        "tools",
        "tui_gateway",
        "work4you_cli",
    ],
    "files": [
        "LICENSE",
        "README.md",
        "cli-config.yaml.example",
        "pyproject.toml",
        "setup.py",
        "uv.lock",
        "work4you",
    ],
    "prefixes": [
        "scripts/whatsapp-bridge",
    ],
    "include_root_python_modules": True,
}


def spec_path() -> Path:
    return Path(__file__).resolve().parent / "data" / "runtime_payload.json"


def load_spec() -> dict:
    """Load the allowlist. JSON is canonical; the fallback keeps extract working
    if the data file is missing from a broken tree."""
    try:
        data = json.loads(spec_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = dict(_FALLBACK_SPEC)
    if not isinstance(data, dict):
        data = dict(_FALLBACK_SPEC)
    return data


def runtime_directories() -> frozenset[str]:
    spec = load_spec()
    dirs = spec.get("directories") or _FALLBACK_SPEC["directories"]
    return frozenset(str(name) for name in dirs)


def runtime_files() -> frozenset[str]:
    spec = load_spec()
    files = spec.get("files") or _FALLBACK_SPEC["files"]
    return frozenset(str(name) for name in files)


def runtime_prefixes() -> frozenset[str]:
    """Nested trees that are payload even when their top-level dir is not.

    WhatsApp's Baileys bridge lives at ``scripts/whatsapp-bridge``. Shipping
    all of ``scripts/`` would drag installer/CI helpers into the consumer
    tree; omitting the prefix leaves Pair-with-QR looking for a missing
    ``bridge.js``.
    """
    spec = load_spec()
    prefixes = spec.get("prefixes") or _FALLBACK_SPEC.get("prefixes") or ()
    return frozenset(
        normalize_zip_relpath(str(name))
        for name in prefixes
        if str(name).strip()
    )


def include_root_python_modules() -> bool:
    spec = load_spec()
    return bool(spec.get("include_root_python_modules", True))


def normalize_zip_relpath(name: str) -> str:
    return str(name or "").replace("\\", "/").strip("/")


def strip_archive_root(relpath: str) -> Optional[str]:
    """Drop the GitHub ZIP root folder (``FORK-56-<ref>/...``).

    Returns the inner relative path, or ``None`` for the root folder entry
    itself or a path that escapes the archive.
    """
    parts = [
        part
        for part in normalize_zip_relpath(relpath).split("/")
        if part and part not in (".",)
    ]
    if not parts or ".." in parts:
        return None
    if len(parts) == 1:
        return None
    return "/".join(parts[1:])


def is_runtime_payload_path(relpath: str) -> bool:
    """True when *relpath* (already stripped of the ZIP root) is payload."""
    parts = [
        part
        for part in normalize_zip_relpath(relpath).split("/")
        if part and part not in (".",)
    ]
    if not parts or ".." in parts:
        return False
    top = parts[0]
    if top in runtime_directories():
        return True
    rel = "/".join(parts)
    for prefix in runtime_prefixes():
        if rel == prefix or rel.startswith(prefix + "/"):
            return True
        if prefix.startswith(rel + "/"):
            return True
    if len(parts) == 1:
        if top in runtime_files():
            return True
        if include_root_python_modules() and top.endswith(".py"):
            return True
    return False


def github_archive_url(
    repo: str = DEFAULT_GITHUB_REPO,
    *,
    commit: str = "",
    tag: str = "",
    branch: str = "main",
) -> str:
    """GitHub source-archive URL. Precedence: commit > tag > branch."""
    repo = (repo or DEFAULT_GITHUB_REPO).strip().strip("/")
    commit = (commit or "").strip()
    tag = (tag or "").strip()
    branch = (branch or "main").strip() or "main"
    if commit:
        return f"https://github.com/{repo}/archive/{commit}.zip"
    if tag:
        return f"https://github.com/{repo}/archive/refs/tags/{tag}.zip"
    return f"https://github.com/{repo}/archive/refs/heads/{branch}.zip"


def github_commit_api_url(repo: str, ref: str) -> str:
    repo = (repo or DEFAULT_GITHUB_REPO).strip().strip("/")
    ref = (ref or "main").strip() or "main"
    return f"https://api.github.com/repos/{repo}/commits/{ref}"


def fetch_github_commit_sha(
    repo: str,
    ref: str,
    *,
    opener: Optional[Callable[[str], object]] = None,
) -> Optional[str]:
    """Best-effort SHA for *ref*. *opener* is injected by tests (no live net)."""
    url = github_commit_api_url(repo, ref)
    try:
        if opener is not None:
            raw = opener(url)
            if hasattr(raw, "read"):
                payload = raw.read()
            else:
                payload = raw
        else:
            request = Request(
                url,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "work4you-runtime-payload",
                },
            )
            with urlopen(request, timeout=20) as response:  # noqa: S310 — fixed GitHub API
                payload = response.read()
        if isinstance(payload, bytes):
            payload = payload.decode("utf-8")
        data = json.loads(payload)
        sha = str(data.get("sha") or "").strip()
        return sha or None
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None


def write_runtime_ref(
    dest: Path,
    *,
    commit: str = "",
    branch: str = "main",
    ref: str = "",
) -> Path:
    dest = Path(dest)
    dest.mkdir(parents=True, exist_ok=True)
    payload = {
        "commit": (commit or "").strip(),
        "branch": (branch or "main").strip() or "main",
        "ref": (ref or commit or branch or "main").strip(),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    path = dest / RUNTIME_REF_FILENAME
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def read_runtime_ref(dest: Path) -> Optional[dict]:
    path = Path(dest) / RUNTIME_REF_FILENAME
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def compare_runtime_ref(
    root: Path,
    *,
    branch: str = "main",
    fetch_sha: Optional[Callable[[str], Optional[str]]] = None,
) -> Optional[int]:
    """Compare a desktop payload pin to upstream.

    Returns ``0`` when the stored SHA matches, ``-1`` when an update is
    available but the commit distance is unknown (no git history), or
    ``None`` when the check cannot run.
    """
    recorded = read_runtime_ref(root) or {}
    local = str(recorded.get("commit") or "").strip()
    target = (branch or str(recorded.get("branch") or "main")).strip() or "main"
    getter = fetch_sha or (
        lambda ref: fetch_github_commit_sha(DEFAULT_GITHUB_REPO, ref)
    )
    remote = getter(target)
    if not remote:
        return None
    if local and local.lower() == str(remote).lower():
        return 0
    return -1


def _is_zip_symlink(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0o170000
    return stat.S_ISLNK(mode)


def extract_runtime_zip(zip_path: Path | str, dest: Path | str) -> list[str]:
    """Extract only allowlisted members from a GitHub source ZIP into *dest*.

    Rejects zip-slip and symlink members. Returns the inner relative paths
    that were written.
    """
    dest_path = Path(dest)
    dest_path.mkdir(parents=True, exist_ok=True)
    dest_real = dest_path.resolve()
    written: list[str] = []

    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            rel = strip_archive_root(info.filename)
            if rel is None or not is_runtime_payload_path(rel):
                continue
            if _is_zip_symlink(info):
                raise ValueError(
                    f"ZIP contains unsupported symlink member: {info.filename}"
                )
            target = dest_real.joinpath(*rel.split("/")).resolve()
            if target != dest_real and not str(target).startswith(
                str(dest_real) + os.sep
            ):
                raise ValueError(
                    f"Zip-slip detected: {info.filename} escapes extraction directory"
                )
            is_dir = info.is_dir() or info.filename.endswith("/")
            if is_dir:
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info, "r") as src, open(target, "wb") as out:
                out.write(src.read())
            written.append(rel)
    return written


def list_payload_top_level(extracted: Path | str) -> list[str]:
    """Top-level payload entry names under an already-extracted tree."""
    root = Path(extracted)
    if not root.is_dir():
        return []
    names = []
    for child in root.iterdir():
        if is_runtime_payload_path(child.name):
            names.append(child.name)
    return sorted(names)


def preserve_names(extra: Iterable[str] | None = None) -> frozenset[str]:
    names = set(RUNTIME_PRESERVE)
    if extra:
        names.update(str(item) for item in extra)
    return frozenset(names)
