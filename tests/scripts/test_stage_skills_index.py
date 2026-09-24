"""The public-site skills index comes from a fresh file or a green-run artifact.

It must not be replaced by whatever is already published at the live docs URL.
"""

import json
import os
import stat
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "stage_skills_index.py"
NOW = datetime(2026, 9, 24, 18, 0, tzinfo=timezone.utc)


def _payload(generated_at: str, n: int = 1500, marker: str = "fresh") -> dict:
    skills = [{"name": marker if i == 0 else str(i)} for i in range(n)]
    return {
        "version": 1,
        "generated_at": generated_at,
        "skill_count": n,
        "skills": skills,
    }


def _iso(when: datetime) -> str:
    return when.astimezone(timezone.utc).isoformat()


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _gh(tmp_path: Path, payload: dict | None, *, fail: bool = False) -> Path:
    bindir = tmp_path / "bin"
    bindir.mkdir()
    fixture = tmp_path / "fixture.json"
    if payload is not None:
        _write(fixture, payload)
    script = bindir / "gh"
    script.write_text(
        "\n".join([
            "#!/bin/sh",
            "if [ \"$FAIL\" = 1 ]; then",
            "  echo 'download failed' >&2",
            "  exit 1",
            "fi",
            "dir=",
            "prev=",
            "for a in \"$@\"; do",
            "  if [ \"$prev\" = --dir ]; then dir=$a; fi",
            "  prev=$a",
            "done",
            "mkdir -p \"$dir\"",
            "cp \"$FIXTURE\" \"$dir/skills-index.json\"",
            "",
        ]),
        encoding="utf-8",
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return bindir


def _run(tmp_path: Path, dest: Path, public_docs: Path, env: dict) -> subprocess.CompletedProcess:
    cmd = [
        sys.executable,
        str(SCRIPT),
        "--dest",
        str(dest),
        "--public-docs",
        str(public_docs),
        "--now",
        _iso(NOW),
    ]
    return subprocess.run(cmd, capture_output=True, text=True, env=env, check=False)


def _env(bindir: Path | None, **extra: str) -> dict:
    env = os.environ.copy()
    env.pop("SKILLS_INDEX_RUN_ID", None)
    if bindir is not None:
        env["PATH"] = str(bindir) + os.pathsep + env.get("PATH", "")
    env.update(extra)
    return env


def test_fresh_on_disk_file_is_what_lands_in_public_docs(tmp_path):
    dest = tmp_path / "static" / "skills-index.json"
    generated = _iso(NOW - timedelta(hours=2))
    _write(dest, _payload(generated, marker="on-disk"))
    public = tmp_path / "public-site" / "docs"
    bindir = _gh(tmp_path, _payload(_iso(NOW), marker="from-artifact"))
    result = _run(tmp_path, dest, public, _env(bindir, SKILLS_INDEX_RUN_ID="999", FAIL="0", FIXTURE=str(tmp_path / "fixture.json")))

    assert result.returncode == 0, result.stderr
    shipped = json.loads((public / "api" / "skills-index.json").read_text(encoding="utf-8"))
    assert shipped["generated_at"] == generated
    assert shipped["skills"][0]["name"] == "on-disk"
    assert "work4you.ai" not in (public / "api" / "skills-index.json").read_text(encoding="utf-8")


def test_recent_mtime_does_not_keep_a_catalog_older_than_24h(tmp_path):
    dest = tmp_path / "static" / "skills-index.json"
    old = _iso(NOW - timedelta(hours=24))
    _write(dest, _payload(old, marker="stale"))
    os.utime(dest, (NOW.timestamp(), NOW.timestamp()))
    public = tmp_path / "public-site" / "docs"
    stale_shipped = public / "api" / "skills-index.json"
    _write(stale_shipped, _payload(_iso(NOW - timedelta(days=21)), marker="leftover"))
    result = _run(tmp_path, dest, public, _env(None))

    assert result.returncode == 0, result.stderr
    assert not dest.exists()
    assert not stale_shipped.exists()


def test_green_run_artifact_replaces_a_stale_file(tmp_path):
    dest = tmp_path / "static" / "skills-index.json"
    _write(dest, _payload(_iso(NOW - timedelta(days=21)), marker="stale"))
    generated = _iso(NOW - timedelta(minutes=5))
    fixture = _payload(generated, marker="artifact")
    bindir = _gh(tmp_path, fixture)
    public = tmp_path / "public-site" / "docs"
    result = _run(
        tmp_path,
        dest,
        public,
        _env(bindir, SKILLS_INDEX_RUN_ID="35087222745", FAIL="0", FIXTURE=str(tmp_path / "fixture.json")),
    )

    assert result.returncode == 0, result.stderr
    shipped = json.loads((public / "api" / "skills-index.json").read_text(encoding="utf-8"))
    assert shipped["generated_at"] == generated
    assert shipped["skills"][0]["name"] == "artifact"
    assert len(shipped["skills"]) >= 1500


def test_failed_artifact_download_does_not_leave_a_stale_catalog(tmp_path):
    dest = tmp_path / "static" / "skills-index.json"
    _write(dest, _payload(_iso(NOW - timedelta(days=21)), marker="stale"))
    bindir = _gh(tmp_path, None, fail=True)
    public = tmp_path / "public-site" / "docs"
    result = _run(
        tmp_path,
        dest,
        public,
        _env(bindir, SKILLS_INDEX_RUN_ID="1", FAIL="1"),
    )

    assert result.returncode != 0
    assert not dest.exists()
    assert not (public / "api" / "skills-index.json").exists()


def test_artifact_older_than_24h_is_refused(tmp_path):
    dest = tmp_path / "static" / "skills-index.json"
    bindir = _gh(tmp_path, _payload(_iso(NOW - timedelta(days=21)), marker="old-run"))
    public = tmp_path / "public-site" / "docs"
    result = _run(
        tmp_path,
        dest,
        public,
        _env(bindir, SKILLS_INDEX_RUN_ID="1", FAIL="0", FIXTURE=str(tmp_path / "fixture.json")),
    )

    assert result.returncode != 0
    assert not dest.exists()
    assert not (public / "api" / "skills-index.json").exists()
