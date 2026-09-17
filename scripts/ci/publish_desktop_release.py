#!/usr/bin/env python3
"""Create or update the desktop-v* GitHub release and upload installers.

Release Desktop run 35266198169 signed + notarized both installers, created
``desktop-v0.0.71`` as Latest, then ``gh release upload`` of
``Work4You-Setup.exe`` died with ``HTTP 500: Error saving asset``. Latest
pointed at an empty release (same class as desktop-v0.0.9).

Rules:

* New tags are created as **drafts**. ``--latest`` is set only after both
  ``Work4You-Setup.exe`` and ``Work4You.dmg`` are on the release.
* Each ``gh`` call retries on transient GitHub errors (5xx, upload 500,
  flaky 403 "Resource not accessible by integration").
* Asset names are never taken from stderr that might include tokens.

Used by ``.github/workflows/release-desktop.yml``. Network I/O goes through
an injected ``run`` so tests stay hermetic.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from collections.abc import Callable, Sequence
from pathlib import Path

REQUIRED_ASSETS = ("Work4You-Setup.exe", "Work4You.dmg")
RETRYABLE_MARKERS = (
    "http 403",
    "http 409",
    "http 429",
    "http 500",
    "http 502",
    "http 503",
    "http 504",
    "error saving asset",
    "resource not accessible by integration",
    "unexpected eof",
    "connection reset",
    "timeout",
)

RunResult = tuple[int, str, str]
Runner = Callable[[Sequence[str]], RunResult]


class PublishError(RuntimeError):
    """gh / GitHub rejected a publish step after retries."""


def is_retryable_gh_error(stderr: str, returncode: int) -> bool:
    if returncode == 0:
        return False
    text = (stderr or "").lower()
    return any(marker in text for marker in RETRYABLE_MARKERS)


def default_run(args: Sequence[str], timeout: int = 600) -> RunResult:
    proc = subprocess.run(
        list(args),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    return proc.returncode, proc.stdout or "", proc.stderr or ""


def run_gh(
    runner: Runner,
    args: Sequence[str],
    *,
    attempts: int = 5,
    delays: Sequence[float] = (10, 20, 40, 60),
    sleep: Callable[[float], None] = time.sleep,
    label: str = "gh",
) -> RunResult:
    last: RunResult = (1, "", f"{label} did not run")
    for attempt in range(1, attempts + 1):
        last = runner(args)
        code, _stdout, stderr = last
        if code == 0:
            return last
        if not is_retryable_gh_error(stderr, code) or attempt == attempts:
            raise PublishError(
                f"{label} failed after {attempt} attempt(s): "
                f"{_safe_error_text(stderr) or f'exit {code}'}"
            )
        wait = delays[min(attempt - 1, len(delays) - 1)]
        print(
            f"::{'warning'}::{label} attempt {attempt}/{attempts} failed; "
            f"retrying in {wait:.0f}s",
            file=sys.stderr,
        )
        sleep(wait)
    raise PublishError(f"{label} failed: {_safe_error_text(last[2])}")


def _safe_error_text(stderr: str) -> str:
    text = (stderr or "").strip()
    if not text:
        return ""
    # Keep the GitHub status line; drop anything that looks like a token.
    lines = [
        line
        for line in text.splitlines()
        if "ghp_" not in line and "github_pat_" not in line
    ]
    return " | ".join(lines[-3:])


def parse_asset_names(view_json: str) -> list[str]:
    if not (view_json or "").strip():
        return []
    payload = json.loads(view_json)
    assets = payload.get("assets") if isinstance(payload, dict) else None
    if not isinstance(assets, list):
        return []
    names: list[str] = []
    for item in assets:
        if isinstance(item, dict) and isinstance(item.get("name"), str):
            names.append(item["name"])
    return names


def has_required_assets(names: Sequence[str]) -> bool:
    have = {name.strip() for name in names if name.strip()}
    return set(REQUIRED_ASSETS) <= have


def release_exists(runner: Runner, tag: str, repo: str) -> bool:
    code, _stdout, _stderr = runner(["gh", "release", "view", tag, "--repo", repo])
    return code == 0


def list_release_assets(runner: Runner, tag: str, repo: str) -> list[str]:
    _code, stdout, _stderr = run_gh(
        runner,
        ["gh", "release", "view", tag, "--repo", repo, "--json", "assets"],
        label=f"gh release view {tag}",
    )
    return parse_asset_names(stdout)


def ensure_release(
    runner: Runner,
    *,
    tag: str,
    repo: str,
    target: str,
    title: str,
    notes: str,
) -> None:
    if release_exists(runner, tag, repo):
        return
    try:
        run_gh(
            runner,
            [
                "gh",
                "release",
                "create",
                tag,
                "--repo",
                repo,
                "--target",
                target,
                "--draft",
                "--title",
                title,
                "--notes",
                notes,
            ],
            label=f"gh release create {tag}",
        )
    except PublishError as exc:
        if release_exists(runner, tag, repo) or "already exists" in str(exc).lower():
            return
        raise


def upload_asset(runner: Runner, *, tag: str, repo: str, path: Path) -> None:
    if not path.is_file():
        raise PublishError(f"missing installer {path}")
    run_gh(
        runner,
        ["gh", "release", "upload", tag, "--repo", repo, str(path), "--clobber"],
        label=f"gh release upload {path.name}",
    )


def promote_latest(runner: Runner, *, tag: str, repo: str) -> None:
    run_gh(
        runner,
        ["gh", "release", "edit", tag, "--repo", repo, "--latest", "--draft=false"],
        label=f"gh release edit {tag} --latest",
    )


def publish_desktop_release(
    *,
    tag: str,
    repo: str,
    target: str,
    exe: Path,
    dmg: Path,
    notes: str,
    runner: Runner = default_run,
) -> None:
    title = f"Work4You Desktop {tag.removeprefix('desktop-v')}"
    print(f"Publishing {tag} from {target}")
    ensure_release(
        runner,
        tag=tag,
        repo=repo,
        target=target,
        title=title,
        notes=notes,
    )
    upload_asset(runner, tag=tag, repo=repo, path=exe)
    upload_asset(runner, tag=tag, repo=repo, path=dmg)
    names = list_release_assets(runner, tag, repo)
    if not has_required_assets(names):
        raise PublishError(
            f"{tag} is missing required installers after upload "
            f"(have {sorted(names)})"
        )
    promote_latest(runner, tag=tag, repo=repo)
    print(f"Published {tag} with {', '.join(REQUIRED_ASSETS)}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--target", required=True, help="commit SHA for a new tag")
    parser.add_argument("--exe", required=True, type=Path)
    parser.add_argument("--dmg", required=True, type=Path)
    parser.add_argument(
        "--notes",
        default=(
            "Signed Windows NSIS app (npm run dist:win:nsis) and "
            "signed/notarized macOS DMG (npm run dist:mac:dmg). Downloads from "
            "[work4you.ai](https://work4you.ai/) redirect here."
        ),
    )
    args = parser.parse_args(argv)

    if not os.environ.get("GH_TOKEN") and not os.environ.get("GITHUB_TOKEN"):
        print("::error::GH_TOKEN or GITHUB_TOKEN is required", file=sys.stderr)
        return 1

    try:
        publish_desktop_release(
            tag=args.tag,
            repo=args.repo,
            target=args.target,
            exe=args.exe,
            dmg=args.dmg,
            notes=args.notes,
        )
    except PublishError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
