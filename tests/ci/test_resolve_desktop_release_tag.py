"""Tests for scripts/ci/resolve_desktop_release_tag.py.

Tag resolution is data in → tag out. No GitHub / network calls.
"""

from __future__ import annotations

import importlib.util
import io
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


def test_dispatch_empty_rebuilds_latest_when_installers_missing():
    resolved = mod.resolve_desktop_release_tag(
        event="workflow_dispatch",
        input_tag="",
        github_latest="desktop-v0.0.71",
        all_tags=[*EXISTING, "desktop-v0.0.71"],
        latest_assets=[],
    )
    assert resolved == mod.ResolvedDesktopTag(tag="desktop-v0.0.71", create=False)


def test_dispatch_empty_still_bumps_when_latest_has_both_installers():
    resolved = mod.resolve_desktop_release_tag(
        event="workflow_dispatch",
        input_tag="bump",
        github_latest="desktop-v0.0.71",
        all_tags=[*EXISTING, "desktop-v0.0.71"],
        latest_assets=["Work4You-Setup.exe", "Work4You.dmg"],
    )
    assert resolved == mod.ResolvedDesktopTag(tag="desktop-v0.0.72", create=True)


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


def test_cli_rebuilds_hollow_latest(capsys):
    code = mod.main(
        [
            "--event",
            "workflow_dispatch",
            "--input-tag",
            "",
            "--github-latest",
            "desktop-v0.0.71",
            "--desktop-tags",
            "desktop-v0.0.70,desktop-v0.0.71",
            "--latest-assets",
            "",
        ]
    )
    assert code == 0
    assert capsys.readouterr().out == "tag=desktop-v0.0.71\ncreate=false\n"


# --- daily release train ---------------------------------------------------

SHA = "a" * 40


def test_train_publishes_when_app_code_changed():
    decision = mod.decide_release_train(
        github_latest="desktop-v0.0.8",
        base_sha=SHA,
        changed_files=["README.md", "apps/desktop/src/app.tsx"],
    )
    assert decision.release is True


def test_train_skips_when_nothing_that_ships_changed():
    decision = mod.decide_release_train(
        github_latest="desktop-v0.0.8",
        base_sha=SHA,
        changed_files=["README.md", "website/docs/user-guide/desktop.md"],
    )
    assert decision.release is False


def test_train_skips_when_latest_already_points_at_head():
    decision = mod.decide_release_train(
        github_latest="desktop-v0.0.8",
        base_sha=SHA,
        changed_files=[],
    )
    assert decision.release is False


@pytest.mark.parametrize("latest", ["", "v0.20.4", "nas-code-drop"])
def test_train_publishes_without_a_desktop_latest_to_compare(latest):
    decision = mod.decide_release_train(
        github_latest=latest,
        base_sha=SHA,
        changed_files=[],
    )
    assert decision.release is True


def test_train_publishes_when_the_latest_commit_is_unknown():
    decision = mod.decide_release_train(
        github_latest="desktop-v0.0.8",
        base_sha="",
        changed_files=[],
    )
    assert decision.release is True


def test_train_directory_entries_match_whole_path_segments():
    directories = [p[: -len("/**")] for p in mod.RELEASE_TRAIN_PATHS if p.endswith("/**")]
    assert directories
    for directory in directories:
        assert mod.feeds_desktop_release(f"{directory}/nested/file.ts")
        assert not mod.feeds_desktop_release(f"{directory}-legacy/file.ts")


def test_train_exact_entries_match_only_that_file():
    exact = [p for p in mod.RELEASE_TRAIN_PATHS if not p.endswith("/**")]
    assert exact
    for path in exact:
        assert mod.feeds_desktop_release(path)
        assert not mod.feeds_desktop_release(f"{path}.bak")
        assert not mod.feeds_desktop_release(f"vendor/{path}")


def test_cli_train_gate_skips_and_says_why(capsys, monkeypatch):
    monkeypatch.setattr("sys.stdin", io.StringIO("README.md\nwebsite/docs/index.md\n"))
    code = mod.main(
        ["--train-gate", "--github-latest", "desktop-v0.0.8", "--base-sha", SHA]
    )
    assert code == 0
    captured = capsys.readouterr()
    assert captured.out == "release=false\n"
    assert "skipping" in captured.err


def test_cli_train_gate_publishes_when_app_code_changed(capsys, monkeypatch):
    monkeypatch.setattr("sys.stdin", io.StringIO("apps/desktop/electron/main.ts\n"))
    code = mod.main(
        ["--train-gate", "--github-latest", "desktop-v0.0.8", "--base-sha", SHA]
    )
    assert code == 0
    assert capsys.readouterr().out == "release=true\n"


@pytest.mark.parametrize("changed_file", [
    "scripts/ci/prepare_desktop_runtime.py",
    "scripts/ci/build-desktop-capabilities.py",
    "scripts/ci/build-desktop-core-tools.py",
    "scripts/ci/build-desktop-voice.py",
    "scripts/ci/desktop-browser-requirements.txt",
])
def test_runtime_payload_changes_feed_the_release_train(changed_file):
    decision = mod.decide_release_train(
        github_latest="desktop-v0.0.8", base_sha=SHA, changed_files=[changed_file]
    )
    assert decision.release is True


def test_cli_still_requires_an_event_outside_the_train_gate():
    with pytest.raises(SystemExit) as excinfo:
        mod.main([])
    assert excinfo.value.code == 2
