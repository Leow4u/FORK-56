"""Behavior of immutable release selection and measured artifact identities."""
from __future__ import annotations

import copy
import importlib.util
from pathlib import Path

import pytest


def load(name):
    source = Path(__file__).resolve().parents[2] / "scripts/ci" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


resolver = load("resolve_install_smoke")
smoke = load("desktop_install_smoke")


@pytest.fixture
def release():
    return {"tag_name": "desktop-v1.2.3", "smokeCommit": "a" * 40,
            "assets": [{"id": 13, "name": "Work4You-Setup.exe", "digest": "sha256:" + "b" * 64},
                       {"id": 14, "name": "Work4You.dmg", "digest": "sha256:" + "c" * 64}]}


def test_snapshot_pins_asset_ids_and_full_commit(release):
    result = resolver.resolve_snapshot(release, "a" * 40)
    assert result["windows_asset"] == "13"
    assert result["macos_asset"] == "14"
    assert result["commit"] == release["smokeCommit"]
    assert result["windows_sha256"] == "b" * 64


def test_other_publishing_run_is_rejected(release):
    with pytest.raises(ValueError, match="triggering run"):
        resolver.resolve_snapshot(release, "d" * 40)


@pytest.mark.parametrize("field,value", [("tag_name", "latest"), ("tag_name", "desktop-v1.2.3\ninjected=x"),
                                         ("smokeCommit", "main"), ("smokeCommit", "a" * 7)])
def test_mutable_or_invalid_selectors_are_rejected(release, field, value):
    release[field] = value
    with pytest.raises(ValueError):
        resolver.resolve_snapshot(release)


def test_missing_or_ambiguous_installer_fails(release):
    release["assets"].pop()
    with pytest.raises(ValueError, match="Work4You.dmg"):
        resolver.resolve_snapshot(release)
    release["assets"].append(copy.deepcopy(release["assets"][0]))
    with pytest.raises(ValueError, match="Work4You-Setup.exe"):
        resolver.resolve_snapshot(release)


def test_download_content_must_match_selected_digest(tmp_path):
    artifact = tmp_path / "Setup.exe"
    artifact.write_bytes(b"initial signed package")
    identity = smoke.artifact_identity(artifact)
    smoke.check_digest(identity, "sha256:" + identity["sha256"])
    artifact.write_bytes(b"different package with same filename")
    with pytest.raises(ValueError, match="SHA256"):
        smoke.check_digest(smoke.artifact_identity(artifact), identity["sha256"])


@pytest.mark.parametrize("value", [-1, 0, True, "13\ninjected=x"])
def test_asset_ids_cannot_inject_workflow_outputs(release, value):
    release["assets"][0]["id"] = value
    with pytest.raises(ValueError, match="asset ID"):
        resolver.resolve_snapshot(release)
