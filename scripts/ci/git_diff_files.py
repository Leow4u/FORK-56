#!/usr/bin/env python3
"""Recover a PR file list via git when GitHub's compare REST API is down.

``detect-changes`` prefers ``GET /repos/.../compare/{base}...{head}`` because
those SHAs are frozen in the pull_request event. When that endpoint 403s
(installation rate limit) or 404s, the classifier used to see an empty diff
and fail open — every test lane *and* the ``ci-reviewed`` review gate. UI-only
PRs then got a false "CI-sensitive file review" action (FORK-56#229).

Git fetch/diff uses the git protocol, not that REST rate-limit bucket. A
two-dot ``git diff --name-only BASE HEAD`` compares trees and does not need
a merge-base, so it still works with two independent ``--depth=1`` fetches.

Prints one path per line on stdout. Exit 0 on success (including an empty
tree diff). Exit 1 if fetch/diff fails so the caller can fail-open tests.
"""

from __future__ import annotations

import subprocess
import sys
from collections.abc import Callable, Sequence

Runner = Callable[[Sequence[str]], subprocess.CompletedProcess[str]]


def _run(args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, capture_output=True, text=True, check=False)


def list_changed_files(
    base_sha: str,
    head_sha: str,
    *,
    runner: Runner = _run,
) -> tuple[list[str], str | None]:
    """Return ``(paths, error)``. ``error`` is set when git cannot recover."""
    if not base_sha or not head_sha:
        return [], "missing base or head SHA"
    for sha in (base_sha, head_sha):
        proc = runner(["git", "fetch", "--no-tags", "--depth=1", "origin", sha])
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip() or "unknown error"
            return [], f"git fetch {sha} failed: {detail}"
    proc = runner(["git", "diff", "--name-only", base_sha, head_sha])
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip() or "unknown error"
        return [], f"git diff failed: {detail}"
    files = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    return files, None


def main(argv: list[str] | None = None) -> int:
    args = sys.argv if argv is None else argv
    if len(args) != 3:
        print("usage: git_diff_files.py BASE_SHA HEAD_SHA", file=sys.stderr)
        return 2
    files, err = list_changed_files(args[1], args[2])
    if err is not None:
        print(f"::warning::{err}", file=sys.stderr)
        return 1
    if files:
        print("\n".join(files))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
