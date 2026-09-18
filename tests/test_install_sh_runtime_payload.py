"""install.sh --runtime-payload must emit a valid filtered-stage manifest.

Consumer desktop Setup/first-launch must not advertise node-deps or the
from-source desktop build: those stages need the monorepo tree the payload
does not install. The default curl|bash one-liner stays on the git path.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INSTALL_SH = REPO_ROOT / "scripts" / "install.sh"


def _manifest(*extra: str) -> dict:
    result = subprocess.run(
        ["bash", str(INSTALL_SH), "--manifest", *extra],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["protocol_version"] == 1
    assert isinstance(payload["stages"], list)
    return payload


def test_default_manifest_keeps_git_install_stages():
    payload = _manifest()
    names = [stage["name"] for stage in payload["stages"]]
    assert "node-deps" in names
    assert names[0] == "prerequisites"
    assert names[-1] == "complete"
    repo = next(stage for stage in payload["stages"] if stage["name"] == "repository")
    assert repo["title"] == "Download Work4You"


def test_runtime_payload_manifest_omits_monorepo_only_stages():
    payload = _manifest("--runtime-payload")
    names = [stage["name"] for stage in payload["stages"]]
    assert "node-deps" not in names
    assert "desktop" not in names
    assert "repository" in names
    assert "python-deps" in names
    assert "path" in names
    assert "complete" in names
    repo = next(stage for stage in payload["stages"] if stage["name"] == "repository")
    assert repo["title"] == "Install Work4You runtime"


def test_runtime_payload_ignores_include_desktop():
    payload = _manifest("--runtime-payload", "--include-desktop")
    names = [stage["name"] for stage in payload["stages"]]
    assert "desktop" not in names
    assert "node-deps" not in names
