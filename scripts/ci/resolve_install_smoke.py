#!/usr/bin/env python3
"""Validate a release snapshot and emit immutable install-smoke selectors."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re


def resolve_snapshot(release: dict, expected_commit: str = "") -> dict[str, str]:
    tag = release.get("tag_name", "")
    commit = release.get("smokeCommit", "")
    if not re.fullmatch(r"desktop-v\d+\.\d+\.\d+", tag):
        raise ValueError("Smoke requires a desktop-v release tag")
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Smoke requires the resolved 40-character release commit")
    if expected_commit and commit != expected_commit:
        raise ValueError("Release snapshot does not belong to the triggering run commit")
    result = {"tag": tag, "commit": commit}
    for platform, name in (("windows", "Work4You-Setup.exe"), ("macos", "Work4You.dmg")):
        matches = [asset for asset in release.get("assets", []) if asset.get("name") == name]
        if len(matches) != 1:
            raise ValueError(f"Expected exactly one {name} asset")
        asset = matches[0]
        asset_id = asset.get("id")
        if not isinstance(asset_id, int) or isinstance(asset_id, bool) or asset_id <= 0:
            raise ValueError(f"Invalid asset ID for {name}")
        digest = asset.get("digest") or ""
        if digest and not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            raise ValueError(f"Unsupported digest for {name}")
        result[f"{platform}_asset"] = str(asset_id)
        result[f"{platform}_sha256"] = digest.removeprefix("sha256:")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--prefix", choices=("", "next_"), default="")
    parser.add_argument("--expected-commit", default="")
    args = parser.parse_args()
    for key, value in resolve_snapshot(json.loads(args.snapshot.read_text(encoding="utf-8")), args.expected_commit).items():
        print(f"{args.prefix}{key}={value}")


if __name__ == "__main__":
    main()
