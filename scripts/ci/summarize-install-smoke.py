#!/usr/bin/env python3
"""Print a human-readable summary of desktop install-smoke JSON artifact(s)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def fmt_ms(ms: int | float | None) -> str:
    if ms is None:
        return "-"
    if ms >= 60_000:
        return f"{ms / 1000:.1f}s ({int(ms)} ms)"
    return f"{int(ms)} ms"


def summarize_one(data: dict, label: str) -> None:
    platform = data.get("platform", "?")
    ok = data.get("success")
    timings = data.get("timingsMs") or {}
    print(f"\n=== {label} ({platform}) success={ok} ===")
    if data.get("error"):
        print(f"error: {data['error']}")
    inst = data.get("installer") or data.get("dmg")
    if isinstance(inst, dict):
        print(f"artifact: {inst.get('bytes', '?')} bytes sha256={str(inst.get('sha256', ''))[:16]}…")
    elif isinstance(inst, str):
        print(f"artifact: {inst}")
    if data.get("installDir"):
        print(f"installDir: {data['installDir']}")
    if data.get("runtimeBundle"):
        rb = data["runtimeBundle"]
        print(
            f"runtime bundle: present={rb.get('present')} "
            f"{rb.get('bytes', '?')} bytes commit={str(rb.get('commit', ''))[:12]}"
        )
    print(
        "timings:",
        ", ".join(f"{k}={fmt_ms(v)}" for k, v in sorted(timings.items())),
    )
    phases = data.get("phases") or []
    if phases:
        print("phases:")
        for p in phases:
            print(f"  - {p.get('name')}: {fmt_ms(p.get('ms'))}")


def markdown_summary(data: dict, *, tag: str = "", mode: str = "") -> str:
    timings = data.get("timingsMs") or {}
    lines = [
        f"## Desktop install smoke ({data.get('platform', '?')})",
        "",
        "| Field | Value |",
        "| --- | --- |",
        f"| Success | {data.get('success')} |",
    ]
    if tag or mode:
        lines.append(f"| Tag / mode | {tag} / {mode} |")
    for key in sorted(timings.keys()):
        lines.append(f"| {key} ms | {timings[key]} |")
    if data.get("deployedHomeBytes") is not None:
        lines.append(f"| WORK4YOU_HOME bytes | {data['deployedHomeBytes']} |")
    if data.get("installDir"):
        lines.append(f"| Install dir | {data['installDir']} |")
    if data.get("error"):
        lines.append(f"| Error | {data['error']} |")
    phases = data.get("phases") or []
    if phases:
        lines.extend(["", "### Phases", ""])
        for p in phases:
            lines.append(f"- **{p.get('name')}**: {p.get('ms')} ms")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json", nargs="+", type=Path, help="install-smoke-*.json files")
    parser.add_argument("--markdown", action="store_true", help="GitHub Actions job summary table")
    parser.add_argument("--tag", default="", help="release tag (markdown mode)")
    parser.add_argument("--mode", default="", help="smoke mode (markdown mode)")
    args = parser.parse_args()
    for path in args.json:
        if not path.is_file():
            print(f"missing: {path}", file=sys.stderr)
            return 1
        data = load(path)
        if args.markdown:
            sys.stdout.write(markdown_summary(data, tag=args.tag, mode=args.mode))
        else:
            summarize_one(data, path.name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
