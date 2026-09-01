"""Tests for scripts/ci/resolve_desktop_release_tag.py.

Tag resolution is data in → tag out. No GitHub / network calls.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_PATH = Path(__file__).resolve().parents[2] / "scripts" / "ci" / "resolve_desktop_release_tag.py"
_spec = importlib.util.spec_from_file_location("resolve_desktop_release_tag", _PATH)
if _spec is None or _spec.loader is None:
    raise ImportError("Failed to load resolve_desktop_release_tag.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


EXISTING = [
    "desktop-v0.0.3",
    "desktop-v0.0.7",
    "desktop-v0.0.8",
    "nas-code-drop",
]


def test_release_event_keeps_published_desktop_tag():
    resolved = mod.resolve_desktop_release_tag(
        event="release",
        release_tag="desktop-v0.0.8",
        all_tags=EXISTING,
    )
    assert resolved == mod.ResolvedDesktopTag(tag="desktop-v0.0.8", create=False)


def test_release_event_rejects_non_desktop_tag():
    with pytest.raises(mod.ResolveError, match="desktop-vX.Y.Z"):
        mod.resolve_desktop_release_tag(event="release", release_tag="v0.20.4")


def test_dispatch_empty_bumps_github_latest_not_bootstrap_003():
    resolved = mod.resolve_desktop_release_tag(
        event="workflow_dispatch",
        input_tag="",
        github_latest="desktop-v0.0.8",
        all_tags=EXISTING,
    )
    assert resolved == mod.ResolvedDesktopTag(tag="desktop-v0.0.9", create=True)


def test_dispatch_empty_ignores_non_desktop_github_latest():
    resolved = mod.resolve_desktop_release_tag(
        event="workflow_dispatch",
        input_tag="bump",
        github_latest="nas-code-drop",
        all_tags=EXISTING,
    )
    assert resolved.tag == "desktop-v0.0.9"
    assert resolved.create is True


def test_dispatch_latest_rebuilds_current_latest_in_place():
    resolved = mod.resolve_desktop_release_tag(
        event="workflow_dispatch",
        input_tag="latest",
        github_latest="desktop-v0.0.8",
        all_tags=EXISTING,
    )
    assert resolved == mod.ResolvedDesktopTag(tag="desktop-v0.0.8", create=False)


def test_dispatch_explicit_new_tag_creates():
    resolved = mod.resolve_desktop_release_tag(
        event="workflow_dispatch",
        input_tag="0.0.10",
        github_latest="desktop-v0.0.8",
        all_tags=EXISTING,
    )
    assert resolved == mod.ResolvedDesktopTag(tag="desktop-v0.0.10", create=True)


def test_dispatch_explicit_existing_tag_updates():
    resolved = mod.resolve_desktop_release_tag(
        event="workflow_dispatch",
        input_tag="desktop-v0.0.8",
        github_latest="desktop-v0.0.8",
        all_tags=EXISTING,
    )
    assert resolved == mod.ResolvedDesktopTag(tag="desktop-v0.0.8", create=False)


def test_dispatch_first_release_when_series_empty():
    resolved = mod.resolve_desktop_release_tag(
        event="workflow_dispatch",
        input_tag="",
        github_latest="",
        all_tags=["nas-code-drop"],
    )
    assert resolved == mod.ResolvedDesktopTag(tag="desktop-v0.0.1", create=True)


def test_dispatch_rejects_garbage_tag():
    with pytest.raises(mod.ResolveError, match="desktop-vX.Y.Z"):
        mod.resolve_desktop_release_tag(
            event="workflow_dispatch",
            input_tag="bootstrap",
            github_latest="desktop-v0.0.8",
            all_tags=EXISTING,
        )


def test_cli_writes_github_output(capsys):
    code = mod.main(
        [
            "--event",
            "workflow_dispatch",
            "--input-tag",
            "",
            "--github-latest",
            "desktop-v0.0.8",
            "--desktop-tags",
            "desktop-v0.0.3,desktop-v0.0.8",
        ]
    )
    assert code == 0
    assert capsys.readouterr().out == "tag=desktop-v0.0.9\ncreate=true\n"
