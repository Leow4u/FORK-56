"""Prebuilt Windows desktop runtime (Cursor-model Setup payload).

Consumer Setup.exe ships a CI-built tree: portable CPython, a venv already
synced with ``uv sync --extra all --locked``, the runtime allowlist, portable
Node, and rg. NSIS / first-launch deploy copies that tree into
``WORK4YOU_HOME`` and rewrites ``pyvenv.cfg`` so the existing desktop resolver
(``venv\\Scripts\\python.exe`` + ``import work4you_cli``) works without a
GitHub ZIP or on-device ``uv sync``.

Git / CLI / ``irm | iex`` installs are unchanged.
"""

from __future__ import annotations

import json
import os
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from work4you_cli.default_soul import DEFAULT_SOUL_MD
from work4you_cli.runtime_payload import (
    DEFAULT_GITHUB_REPO,
    INSTALL_METHOD,
    write_runtime_ref,
)

MANIFEST_FILENAME = "manifest.json"
MANIFEST_SCHEMA_VERSION = 1
BOOTSTRAP_MARKER_FILENAME = ".work4you-bootstrap-complete"
BOOTSTRAP_MARKER_SCHEMA_VERSION = 1
DEPLOY_SCRIPT_FILENAME = "deploy-desktop-runtime.ps1"

PREBUILT_RUNTIME_ZIP_NAMES = {
    "x64": "runtime-win-x64.zip",
    "amd64": "runtime-win-x64.zip",
    "arm64": "runtime-win-arm64.zip",
}

# Home-level files the deploy must never clobber.
HOME_PRESERVE_FILES = frozenset({".env", "config.yaml", "SOUL.md"})

# Install-tree names that survive a prebuilt replace. venv is NOT listed:
# the payload *is* the venv. .env is local secrets if someone put one there.
INSTALL_PRESERVE = frozenset({".env", ".git"})


def rewrite_pyvenv_cfg(text: str, python_home: str) -> str:
    """Rewrite ``home`` / ``executable`` so a copied Windows venv can start."""
    home = str(python_home or "").rstrip("\\/")
    if not home:
        raise ValueError("python_home is required")
    windows_home = "\\" in home or (len(home) >= 2 and home[1] == ":")
    executable = f"{home}\\python.exe" if windows_home else str(Path(home) / "python.exe")
    lines = str(text or "").splitlines()
    out: list[str] = []
    seen_home = False
    seen_executable = False
    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith("home"):
            key, sep, _ = line.partition("=")
            if sep:
                out.append(f"{key.rstrip()} = {home}")
                seen_home = True
                continue
        if stripped.lower().startswith("executable"):
            key, sep, _ = line.partition("=")
            if sep:
                out.append(f"{key.rstrip()} = {executable}")
                seen_executable = True
                continue
        out.append(line)
    if not seen_home:
        out.insert(0, f"home = {home}")
    if not seen_executable:
        out.append(f"executable = {executable}")
    return "\n".join(out) + ("\n" if text.endswith("\n") or not text else "\n")


def write_pyvenv_cfg(venv_dir: Path, python_home: str) -> Path:
    cfg = Path(venv_dir) / "pyvenv.cfg"
    original = cfg.read_text(encoding="utf-8") if cfg.is_file() else "home = \n"
    cfg.write_text(rewrite_pyvenv_cfg(original, python_home), encoding="utf-8")
    return cfg


def parse_runtime_manifest(payload: Any) -> Optional[dict]:
    if not isinstance(payload, dict):
        return None
    try:
        schema = int(payload.get("schemaVersion") or 0)
    except (TypeError, ValueError):
        return None
    if schema != MANIFEST_SCHEMA_VERSION:
        return None
    return payload


def read_runtime_manifest(bundle_dir: Path) -> Optional[dict]:
    path = Path(bundle_dir) / MANIFEST_FILENAME
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return parse_runtime_manifest(data)


def is_present_runtime_manifest(manifest: Optional[dict]) -> bool:
    return bool(manifest) and manifest.get("present") is True


def is_prebuilt_runtime_root(bundle_dir: Path) -> bool:
    root = Path(bundle_dir)
    if not is_present_runtime_manifest(read_runtime_manifest(root)):
        return False
    return (root / "work4you").is_dir() and (root / "python").is_dir()


def runtime_zip_name(arch: str = "x64") -> str:
    key = (arch or "x64").strip().lower()
    return PREBUILT_RUNTIME_ZIP_NAMES.get(key, PREBUILT_RUNTIME_ZIP_NAMES["x64"])


def github_prebuilt_runtime_zip_url(
    repo: str = DEFAULT_GITHUB_REPO,
    *,
    arch: str = "x64",
    tag: str = "latest",
) -> str:
    repo = (repo or DEFAULT_GITHUB_REPO).strip().strip("/")
    asset = runtime_zip_name(arch)
    tag = (tag or "latest").strip() or "latest"
    if tag == "latest":
        return f"https://github.com/{repo}/releases/latest/download/{asset}"
    return f"https://github.com/{repo}/releases/download/{tag}/{asset}"


def is_prebuilt_runtime_zip(zip_path: Path) -> bool:
    """True when *zip_path* is a CI runtime bundle, not a GitHub source archive."""
    try:
        with zipfile.ZipFile(zip_path) as zf:
            names = [name.replace("\\", "/") for name in zf.namelist()]
            manifest_name = next(
                (
                    name
                    for name in names
                    if name.rstrip("/").endswith(MANIFEST_FILENAME)
                    and name.count("/") <= 1
                ),
                None,
            )
            if not manifest_name:
                return False
            raw = zf.read(manifest_name)
            data = json.loads(raw.decode("utf-8"))
    except (OSError, zipfile.BadZipFile, json.JSONDecodeError, UnicodeDecodeError, KeyError):
        return False
    return is_present_runtime_manifest(parse_runtime_manifest(data))


def extract_prebuilt_runtime_zip(zip_path: Path, dest: Path) -> Path:
    dest = Path(dest)
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = info.filename.replace("\\", "/")
            if ".." in name.split("/"):
                raise ValueError(f"Zip-slip detected: {info.filename}")
            zf.extract(info, dest)
    if is_prebuilt_runtime_root(dest):
        return dest
    for child in dest.iterdir():
        if child.is_dir() and is_prebuilt_runtime_root(child):
            return child
    raise ValueError("ZIP is not a prebuilt Work4You desktop runtime")


def write_bootstrap_marker(
    install_dir: Path,
    *,
    pinned_commit: str,
    pinned_branch: str = "main",
) -> Path:
    install_dir = Path(install_dir)
    install_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": BOOTSTRAP_MARKER_SCHEMA_VERSION,
        "pinnedCommit": (pinned_commit or "").strip(),
        "pinnedBranch": (pinned_branch or "main").strip() or "main",
        "completedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
    }
    path = install_dir / BOOTSTRAP_MARKER_FILENAME
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def seed_home_templates(work4you_home: Path, install_dir: Path) -> None:
    """Create empty HOME scaffolding. Never overwrite user files."""
    home = Path(work4you_home)
    for name in (
        "cron",
        "sessions",
        "logs",
        "pairing",
        "hooks",
        "image_cache",
        "audio_cache",
        "memories",
        "skills",
    ):
        (home / name).mkdir(parents=True, exist_ok=True)

    env_path = home / ".env"
    if not env_path.exists():
        example = Path(install_dir) / ".env.example"
        if example.is_file():
            shutil.copy2(example, env_path)
        else:
            env_path.write_text("", encoding="utf-8")

    config_path = home / "config.yaml"
    if not config_path.exists():
        example = Path(install_dir) / "cli-config.yaml.example"
        if example.is_file():
            shutil.copy2(example, config_path)

    soul_path = home / "SOUL.md"
    if not soul_path.exists():
        soul_path.write_text(DEFAULT_SOUL_MD + "\n", encoding="utf-8")


def _copy_replace_tree(src: Path, dest: Path, *, preserve: frozenset[str]) -> None:
    src = Path(src)
    dest = Path(dest)
    dest.mkdir(parents=True, exist_ok=True)
    for entry in src.iterdir():
        if entry.name in preserve:
            continue
        target = dest / entry.name
        if entry.is_dir():
            if target.is_dir() and entry.name not in preserve:
                shutil.rmtree(target, ignore_errors=True)
            if target.exists() and not target.is_dir():
                target.unlink()
            shutil.copytree(entry, target, dirs_exist_ok=True)
        else:
            shutil.copy2(entry, target)


def apply_prebuilt_runtime_bundle(
    bundle_dir: Path,
    work4you_home: Path,
    *,
    pinned_commit: str = "",
    pinned_branch: str = "main",
) -> Path:
    """Copy a CI runtime bundle into ``WORK4YOU_HOME`` and relocate the venv.

    Returns the install dir (``<home>/work4you``).
    """
    bundle = Path(bundle_dir)
    if not is_prebuilt_runtime_root(bundle):
        raise ValueError(f"not a prebuilt runtime bundle: {bundle}")

    home = Path(work4you_home)
    home.mkdir(parents=True, exist_ok=True)
    install_dir = home / "work4you"
    python_home = home / "python"

    for name in ("python", "node", "bin"):
        src = bundle / name
        dest = home / name
        if not src.is_dir():
            continue
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
        shutil.copytree(src, dest)

    _copy_replace_tree(bundle / "work4you", install_dir, preserve=INSTALL_PRESERVE)

    venv_dir = install_dir / "venv"
    if venv_dir.is_dir() and python_home.is_dir():
        write_pyvenv_cfg(venv_dir, str(python_home))

    manifest = read_runtime_manifest(bundle) or {}
    commit = (pinned_commit or str(manifest.get("commit") or "")).strip()
    branch = (pinned_branch or str(manifest.get("branch") or "main")).strip() or "main"

    seed_home_templates(home, install_dir)
    (install_dir / ".install_method").write_text(INSTALL_METHOD + "\n", encoding="utf-8")
    write_runtime_ref(install_dir, commit=commit, branch=branch, ref=commit or branch)
    if len(commit) >= 7:
        write_bootstrap_marker(install_dir, pinned_commit=commit, pinned_branch=branch)

    # Match install.ps1 Set-PathVariable: expose ONLY the launchers on
    # ``<install>/bin``, never venv/Scripts (that would shadow ``python``).
    launcher_dest = install_dir / "bin"
    launcher_dest.mkdir(parents=True, exist_ok=True)
    for launcher_src in (venv_dir / "Scripts", venv_dir / "bin"):
        if not launcher_src.is_dir():
            continue
        for launcher in ("work4you.exe", "work4you-acp.exe", "work4you", "work4you-acp"):
            src = launcher_src / launcher
            if src.is_file():
                shutil.copy2(src, launcher_dest / launcher)

    return install_dir


def stub_runtime_manifest() -> dict:
    return {"schemaVersion": MANIFEST_SCHEMA_VERSION, "present": False}
