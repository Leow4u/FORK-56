#!/usr/bin/env python3
"""Stage the skills index for the public-site build.

The file that lands in ``public-site/docs`` is either:

* the on-disk ``skills-index.json`` whose ``generated_at`` is under 24 hours, or
* the ``skills-index`` artifact from ``SKILLS_INDEX_RUN_ID``.

This does not download the live docs URL. That URL is the catalog already
published, and fetching it again republishes a stale file.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

MAX_AGE = timedelta(hours=24)
MIN_SKILLS = 1500
CLOCK_SKEW = timedelta(hours=1)


class StageError(Exception):
    """The requested artifact could not be staged."""


def _parse_time(raw: str) -> datetime:
    ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)


def _now_from(raw: str | None) -> datetime:
    if raw:
        return _parse_time(raw)
    return datetime.now(timezone.utc)


def load_index(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def index_age(data: dict, now: datetime) -> timedelta | None:
    raw = data.get("generated_at")
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        generated = _parse_time(raw)
    except ValueError:
        return None
    return now - generated


def index_is_usable(data: dict, now: datetime) -> bool:
    skills = data.get("skills")
    if not isinstance(skills, list) or len(skills) < MIN_SKILLS:
        return False
    age = index_age(data, now)
    if age is None:
        return False
    return -CLOCK_SKEW <= age < MAX_AGE


def _download_artifact(run_id: str, dest: Path) -> None:
    tmp = Path(tempfile.mkdtemp(prefix="skills-index-"))
    try:
        proc = subprocess.run(
            [
                "gh",
                "run",
                "download",
                run_id,
                "--name",
                "skills-index",
                "--dir",
                str(tmp),
            ],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "gh run download failed").strip()
            raise StageError(detail)
        matches = sorted(tmp.rglob("skills-index.json"))
        if len(matches) != 1:
            raise StageError(
                f"expected one skills-index.json in the artifact, found {len(matches)}"
            )
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(matches[0], dest)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def stage(dest: Path, *, run_id: str, now: datetime) -> str:
    """Return ``kept``, ``downloaded``, or ``absent``.

    A non-empty ``run_id`` whose artifact is missing or unusable raises
    ``StageError`` and leaves ``dest`` without that artifact.
    """
    if dest.is_file():
        data = load_index(dest)
        if data is not None and index_is_usable(data, now):
            return "kept"
        dest.unlink()

    if not run_id:
        return "absent"

    _download_artifact(run_id, dest)
    data = load_index(dest) if dest.is_file() else None
    if data is None or not index_is_usable(data, now):
        if dest.is_file():
            dest.unlink()
        raise StageError(
            "skills-index artifact is missing, unreadable, or older than 24h"
        )
    return "downloaded"


def copy_into_public_docs(src: Path, public_docs: Path) -> bool:
    """Copy a staged index into ``public-site/docs/api``. Return whether it copied."""
    if not src.is_file():
        return False
    target = public_docs / "api" / "skills-index.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, target)
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", type=Path, required=True)
    parser.add_argument(
        "--public-docs",
        type=Path,
        default=None,
        help="Copy the staged file to PUBLIC_DOCS/api/skills-index.json",
    )
    parser.add_argument(
        "--now",
        default=None,
        help="ISO timestamp used for the 24h check (tests)",
    )
    args = parser.parse_args(argv)
    run_id = os.environ.get("SKILLS_INDEX_RUN_ID", "").strip()
    now = _now_from(args.now)
    try:
        status = stage(args.dest, run_id=run_id, now=now)
    except StageError as exc:
        print(f"skills index staging failed: {exc}", file=sys.stderr)
        return 1
    print(f"skills index: {status}")
    if args.public_docs is not None:
        target = args.public_docs / "api" / "skills-index.json"
        if copy_into_public_docs(args.dest, args.public_docs):
            print(f"skills index copied to {target}")
        else:
            if target.is_file():
                target.unlink()
            print("skills index not copied; no fresh file on disk")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
