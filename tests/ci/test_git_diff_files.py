"""Tests for scripts/ci/git_diff_files.py.

The helper is the REST-compare fallback: recover the changed-path list from
git when GitHub's compare API is rate-limited. Tests drive an injected runner
so they never touch a real remote.
"""

from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path

_PATH = Path(__file__).resolve().parents[2] / "scripts" / "ci" / "git_diff_files.py"
_spec = importlib.util.spec_from_file_location("git_diff_files", _PATH)
if _spec is None or _spec.loader is None:
    raise ImportError("Failed to load git_diff_files.py")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
list_changed_files = _mod.list_changed_files
main = _mod.main


def _ok(stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(args=[], returncode=0, stdout=stdout, stderr=stderr)


def _err(stderr: str = "boom") -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr=stderr)


def test_lists_stripped_nonempty_paths_in_order():
    calls: list[list[str]] = []

    def runner(args):
        calls.append(list(args))
        if args[1] == "diff":
            return _ok("web/src/pages/SkillsPage.tsx\n\n  \napps/desktop/src/components/page-loader.tsx\n")
        return _ok()

    files, err = list_changed_files("base", "head", runner=runner)
    assert err is None
    assert files == [
        "web/src/pages/SkillsPage.tsx",
        "apps/desktop/src/components/page-loader.tsx",
    ]
    assert calls[0] == ["git", "fetch", "--no-tags", "--depth=1", "origin", "base"]
    assert calls[1] == ["git", "fetch", "--no-tags", "--depth=1", "origin", "head"]
    assert calls[2] == ["git", "diff", "--name-only", "base", "head"]


def test_fetch_failure_returns_error_without_diffing():
    def runner(args):
        if args[-1] == "base":
            return _err("rate limited")
        raise AssertionError(f"unexpected call: {args}")

    files, err = list_changed_files("base", "head", runner=runner)
    assert files == []
    assert err is not None
    assert "git fetch base failed" in err
    assert "rate limited" in err


def test_head_fetch_failure_does_not_diff():
    calls: list[str] = []

    def runner(args):
        calls.append(args[1])
        if args[-1] == "head":
            return _err("missing")
        return _ok()

    files, err = list_changed_files("base", "head", runner=runner)
    assert files == []
    assert err is not None
    assert "git fetch head failed" in err
    assert "diff" not in calls


def test_diff_failure_returns_error():
    def runner(args):
        if args[1] == "diff":
            return _err("bad object")
        return _ok()

    files, err = list_changed_files("aaa", "bbb", runner=runner)
    assert files == []
    assert err is not None
    assert "git diff failed" in err
    assert "bad object" in err


def test_empty_tree_diff_is_success():
    def runner(args):
        if args[1] == "diff":
            return _ok("\n  \n")
        return _ok()

    files, err = list_changed_files("aaa", "bbb", runner=runner)
    assert err is None
    assert files == []


def test_missing_sha_does_not_call_git():
    def runner(args):
        raise AssertionError(f"unexpected call: {args}")

    files, err = list_changed_files("", "head", runner=runner)
    assert files == []
    assert err == "missing base or head SHA"


def test_main_prints_paths_and_exits_zero(capsys):
    _mod.list_changed_files = lambda base, head, runner=_mod._run: (["a.ts", "b.py"], None)
    try:
        assert main(["git_diff_files.py", "base", "head"]) == 0
    finally:
        _mod.list_changed_files = list_changed_files
    out = capsys.readouterr()
    assert out.out == "a.ts\nb.py\n"
    assert out.err == ""


def test_main_empty_success_prints_nothing(capsys):
    _mod.list_changed_files = lambda base, head, runner=_mod._run: ([], None)
    try:
        assert main(["git_diff_files.py", "base", "head"]) == 0
    finally:
        _mod.list_changed_files = list_changed_files
    out = capsys.readouterr()
    assert out.out == ""
    assert out.err == ""


def test_main_error_prints_warning_and_exits_one(capsys):
    _mod.list_changed_files = lambda base, head, runner=_mod._run: ([], "git fetch base failed: boom")
    try:
        assert main(["git_diff_files.py", "base", "head"]) == 1
    finally:
        _mod.list_changed_files = list_changed_files
    out = capsys.readouterr()
    assert out.out == ""
    assert "::warning::git fetch base failed: boom" in out.err


def test_main_rejects_wrong_argc(capsys):
    assert main(["git_diff_files.py"]) == 2
    err = capsys.readouterr().err
    assert "usage:" in err
