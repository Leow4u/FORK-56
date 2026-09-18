"""POSIX deploy script: stub no-op + present-bundle relocate."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "deploy-desktop-runtime.sh"


@pytest.mark.linux_only
def test_deploy_desktop_runtime_sh_stub_exits_zero(tmp_path):
    stub = tmp_path / "stub"
    stub.mkdir()
    (stub / "manifest.json").write_text(
        json.dumps({"schemaVersion": 1, "present": False}), encoding="utf-8"
    )
    result = subprocess.run(
        ["bash", str(SCRIPT), "--bundle-dir", str(stub), "--work4you-home", str(tmp_path / "home")],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert "skipping deploy" in result.stdout


@pytest.mark.linux_only
def test_deploy_desktop_runtime_sh_relocates_and_preserves_env(tmp_path):
    bundle = tmp_path / "bundle"
    work4you = bundle / "work4you"
    (work4you / "work4you_cli").mkdir(parents=True)
    (work4you / "work4you_cli" / "__init__.py").write_text("__version__='0'\n", encoding="utf-8")
    (work4you / "cli-config.yaml.example").write_text("model: {}\n", encoding="utf-8")
    (work4you / "venv" / "bin").mkdir(parents=True)
    (work4you / "venv" / "pyvenv.cfg").write_text(
        "home = /builder/python\nexecutable = /builder/python/bin/python3\n",
        encoding="utf-8",
    )
    (work4you / "venv" / "bin" / "work4you").write_text("#!/bin/sh\n", encoding="utf-8")
    (bundle / "python" / "bin").mkdir(parents=True)
    (bundle / "python" / "bin" / "python3").write_text("", encoding="utf-8")
    os.chmod(bundle / "python" / "bin" / "python3", 0o755)
    commit = "a" * 40
    (bundle / "manifest.json").write_text(
        json.dumps({"schemaVersion": 1, "present": True, "commit": commit, "branch": "main"}),
        encoding="utf-8",
    )
    home = tmp_path / "home"
    home.mkdir()
    (home / ".env").write_text("KEEP=1\n", encoding="utf-8")

    result = subprocess.run(
        [
            "bash",
            str(SCRIPT),
            "--bundle-dir",
            str(bundle),
            "--work4you-home",
            str(home),
            "--pinned-commit",
            commit,
            "--pinned-branch",
            "main",
            "--skip-import-probe",
        ],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "HOME": str(tmp_path / "user-home")},
    )
    assert result.returncode == 0, result.stdout + result.stderr
    cfg = (home / "work4you" / "venv" / "pyvenv.cfg").read_text(encoding="utf-8")
    assert str(home / "python") in cfg
    assert "builder" not in cfg
    assert (home / ".env").read_text(encoding="utf-8") == "KEEP=1\n"
    assert (home / "work4you" / ".work4you-bootstrap-complete").is_file()
    assert (home / "SOUL.md").is_file()
    assert (home / "work4you" / "bin" / "work4you").is_file()
