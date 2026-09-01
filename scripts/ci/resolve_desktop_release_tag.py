#!/usr/bin/env python3
"""Pick the GitHub ``desktop-v*`` tag for a desktop installer publish.

Public downloads (``work4you.ai/downloads/Work4You-Setup.exe`` and
``.dmg``) redirect to GitHub ``releases/latest``. That pointer is the
``desktop-v*`` installer series (0.0.4, 0.0.8, …), **not** the Tauri
bootstrap-installer package version (stuck at 0.0.3).

``workflow_dispatch`` used to read ``apps/bootstrap-installer/package.json``
and clobber ``desktop-v0.0.3``, leaving Latest (and therefore the public
``.exe`` / ``.dmg``) untouched.

Rules:

* ``release`` event → the published tag (must already be ``desktop-vX.Y.Z``).
* dispatch with an explicit tag (``desktop-vX.Y.Z`` or ``X.Y.Z``) → that tag.
* dispatch with ``latest`` → current Latest if it is ``desktop-v*``, else the
  highest ``desktop-v*`` tag (rebuild in place).
* dispatch with empty / ``next`` / ``bump`` → bump the patch of that same
  base tag and create a new Latest so the Git tag, asar install-stamp, and
  download URL all point at this run's commit.

Used by ``.github/workflows/release-desktop.yml``. No network I/O — the
workflow feeds GitHub's current tags in as data.
"""

from __future__ import annotations

import argparse
import re
import sys
from typing import NamedTuple

DESKTOP_TAG_RE = re.compile(r"^desktop-v(\d+)\.(\d+)\.(\d+)$")
BARE_VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
FIRST_TAG = "desktop-v0.0.1"
BUMP_ALIASES = frozenset({"", "next", "bump"})
LATEST_ALIASES = frozenset({"latest"})


class ResolveError(ValueError):
    """Invalid tag / event combination."""


class ResolvedDesktopTag(NamedTuple):
    tag: str
    create: bool


def parse_desktop_tag(tag: str) -> tuple[int, int, int] | None:
    match = DESKTOP_TAG_RE.fullmatch(tag.strip())
    if not match:
        return None
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def normalize_explicit_tag(raw: str) -> str:
    text = raw.strip()
    if BARE_VERSION_RE.fullmatch(text):
        text = f"desktop-v{text}"
    if parse_desktop_tag(text) is None:
        raise ResolveError(
            f"installer tag must be desktop-vX.Y.Z (got {raw!r}); "
            "empty bumps Latest, 'latest' rebuilds Latest in place"
        )
    return text


def desktop_tags_from(names: list[str]) -> list[str]:
    parsed: list[tuple[tuple[int, int, int], str]] = []
    for name in names:
        version = parse_desktop_tag(name)
        if version is None:
            continue
        parsed.append((version, name.strip()))
    parsed.sort()
    return [name for _version, name in parsed]


def highest_desktop_tag(names: list[str]) -> str | None:
    tags = desktop_tags_from(names)
    return tags[-1] if tags else None


def bump_patch(tag: str) -> str:
    version = parse_desktop_tag(tag)
    if version is None:
        raise ResolveError(f"cannot bump non-desktop tag {tag!r}")
    major, minor, patch = version
    return f"desktop-v{major}.{minor}.{patch + 1}"


def base_desktop_tag(github_latest: str, all_tags: list[str]) -> str | None:
    """Prefer GitHub Latest when it is a desktop installer tag."""
    latest = github_latest.strip()
    if parse_desktop_tag(latest):
        return latest
    return highest_desktop_tag(all_tags)


def resolve_desktop_release_tag(
    *,
    event: str,
    release_tag: str = "",
    input_tag: str = "",
    github_latest: str = "",
    all_tags: list[str] | None = None,
) -> ResolvedDesktopTag:
    tags = list(all_tags or [])
    if event == "release":
        tag = release_tag.strip()
        if parse_desktop_tag(tag) is None:
            raise ResolveError(
                f"release tag must be desktop-vX.Y.Z (got {release_tag!r})"
            )
        return ResolvedDesktopTag(tag=tag, create=False)

    if event != "workflow_dispatch":
        raise ResolveError(f"unsupported event {event!r}")

    raw = input_tag.strip()
    alias = raw.lower()
    if alias in LATEST_ALIASES or alias in BUMP_ALIASES:
        base = base_desktop_tag(github_latest, tags)
        if alias in LATEST_ALIASES:
            if base is None:
                raise ResolveError(
                    "no desktop-v* release exists yet; pass tag=desktop-v0.0.1 "
                    "or omit tag to create desktop-v0.0.1"
                )
            return ResolvedDesktopTag(tag=base, create=False)
        if base is None:
            return ResolvedDesktopTag(tag=FIRST_TAG, create=True)
        return ResolvedDesktopTag(tag=bump_patch(base), create=True)

    explicit = normalize_explicit_tag(raw)
    return ResolvedDesktopTag(
        tag=explicit,
        create=explicit not in desktop_tags_from(tags),
    )


def format_github_output(resolved: ResolvedDesktopTag) -> str:
    create = "true" if resolved.create else "false"
    return f"tag={resolved.tag}\ncreate={create}\n"


def _split_tags(raw: str) -> list[str]:
    if not raw.strip():
        return []
    return [part.strip() for part in re.split(r"[\n,]+", raw) if part.strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", required=True, help="release or workflow_dispatch")
    parser.add_argument("--release-tag", default="", help="github.event.release.tag_name")
    parser.add_argument("--input-tag", default="", help="workflow_dispatch inputs.tag")
    parser.add_argument(
        "--github-latest",
        default="",
        help="tag_name of GitHub's Latest release",
    )
    parser.add_argument(
        "--desktop-tags",
        default="",
        help="newline- or comma-separated existing release tags",
    )
    args = parser.parse_args(argv)

    try:
        resolved = resolve_desktop_release_tag(
            event=args.event,
            release_tag=args.release_tag,
            input_tag=args.input_tag,
            github_latest=args.github_latest,
            all_tags=_split_tags(args.desktop_tags),
        )
    except ResolveError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1

    sys.stdout.write(format_github_output(resolved))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
