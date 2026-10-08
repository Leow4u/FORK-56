"""Backend git operations for the desktop coding rail + Codex-style review pane.

The desktop's git affordances (coding-rail status, worktree lanes, review pane,
branch switch) run as Electron-local git on the user's machine. On a *remote*
gateway those would operate on the wrong filesystem, so this module mirrors them
over the dashboard's authenticated REST surface â€” the same pattern as ``/api/fs``.

Everything shells out to the system ``git`` (and ``gh`` for ship info / PRs).
Legacy probes degrade to ``None`` on a non-repo. Review reads distinguish an
empty scope from a missing repository or failed read; mutations raise. Callers pass an already path-hardened ``cwd``.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import stat
import subprocess
from pathlib import Path

from work4you_cli._subprocess_compat import noninteractive_git_env

_GIT_TIMEOUT = 30
_GH_TIMEOUT = 30
_MAX_BUFFER = 32 * 1024 * 1024
_UNTRACKED_LINE_MAX_BYTES = 1024 * 1024
_REVIEW_FILE_CAP = 2_000
_COMMIT_CONTEXT_DIFF_MAX_CHARS = 120_000
_COMMIT_CONTEXT_UNTRACKED_MAX = 80
_TRUNK_BRANCHES = ("main", "master")


def _git(cwd: str, args: list[str], *, timeout: int = _GIT_TIMEOUT, input_data: str | None = None) -> tuple[int, str, str]:
    """Run ``git`` in ``cwd``. Returns (returncode, stdout, stderr); never raises
    on a non-zero exit (callers decide what an error means).

    Runs non-interactively (stdin nulled, ``GIT_TERMINAL_PROMPT=0``): these
    calls serve authenticated REST requests from the dashboard/desktop, so a
    credential prompt from ``fetch``/``push``/``pull`` could never be answered
    â€” it would just hang the request until the timeout. Failing fast surfaces
    the real auth error in the toast instead."""
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True, encoding='utf-8', errors='replace',
            timeout=timeout,
            **({"stdin": subprocess.DEVNULL} if input_data is None else {"input": input_data}),
            env=noninteractive_git_env(),
        )
    except (OSError, subprocess.SubprocessError):
        return 1, "", "git invocation failed"
    return proc.returncode, proc.stdout, proc.stderr


def _git_out(cwd: str, args: list[str]) -> str:
    """stdout of a git command, or "" on any failure."""
    code, out, _ = _git(cwd, args)
    return out if code == 0 else ""


def _git_ok(cwd: str, args: list[str]) -> None:
    """Run a git mutation, raising RuntimeError with stderr on failure."""
    code, _, err = _git(cwd, args)
    if code != 0:
        raise RuntimeError(err.strip() or f"git {' '.join(args)} failed")


def _is_dir(cwd: str) -> bool:
    try:
        return Path(cwd).is_dir()
    except OSError:
        return False


# â”€â”€ shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def resolve_rename_path(raw: str) -> str:
    """``old => new`` (and ``dir/{old => new}/f``) â†’ the NEW path, so a row
    addresses the real file for diff/stage."""
    path = str(raw or "").strip()
    if " => " not in path:
        return path
    head, _, tail = path.partition("{")
    if tail and "}" in tail:
        inner, _, suffix = tail.partition("}")
        _, _, to = inner.partition(" => ")
        return f"{head}{to}{suffix}".replace("//", "/")
    return path.split(" => ")[-1].strip()


def _untracked_insertions(cwd: str, rel: str) -> int:
    """Line count of an untracked file (newlines + a final unterminated line),
    so the review tree can show +N for new files. Binary / oversized â†’ 0."""
    try:
        target = Path(cwd) / rel
        st = target.lstat()
        if not stat.S_ISREG(st.st_mode) or st.st_size > _UNTRACKED_LINE_MAX_BYTES:
            return 0
        data = target.read_bytes()
        if b"\0" in data:
            return 0
        lines = data.count(b"\n")
        return lines + 1 if data and not data.endswith(b"\n") else lines
    except OSError:
        return 0


def _branch_base(cwd: str) -> str | None:
    """Merge-base with the remote default branch for "all branch changes"."""
    candidates: list[str] = []
    head = _git_out(cwd, ["rev-parse", "--abbrev-ref", "origin/HEAD"]).strip()
    if head:
        candidates.append(head)
    candidates += ["origin/main", "origin/master", "main", "master"]
    for ref in candidates:
        base = _git_out(cwd, ["merge-base", "HEAD", ref]).strip()
        if base:
            return base
    return None


def _default_branch_name(cwd: str) -> str | None:
    """The repo's trunk name ("main"/"master"/â€¦), preferring origin/HEAD."""
    head = _git_out(cwd, ["rev-parse", "--abbrev-ref", "origin/HEAD"]).strip()
    if head and head != "origin/HEAD":
        return head.split("/", 1)[-1]
    for ref in (
        "refs/heads/main",
        "refs/heads/master",
        "refs/remotes/origin/main",
        "refs/remotes/origin/master",
    ):
        code, _, _ = _git(cwd, ["rev-parse", "--verify", "--quiet", ref])
        if code == 0:
            return ref.split("/")[-1]
    return None


# â”€â”€ porcelain v2 status parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def _walk_entries(raw: str):
    """Yield (tag, xy, path) per changed file from ``git status --porcelain=v2 -z``,
    skipping branch headers and the rename/copy origin-path records. One walker
    feeds the rail, the review list, and the commit flow."""
    records = raw.split("\0")
    i = 0
    while i < len(records):
        rec = records[i]
        tag = rec[0] if rec else ""
        if tag == "?":
            yield "?", "??", rec[2:]
        elif tag == "u":
            yield "u", rec.split(" ")[1], rec.split(" ", 10)[-1]
        elif tag in ("1", "2"):
            xy = rec.split(" ")[1]
            path = rec.split(" ", 8)[-1] if tag == "1" else rec.split(" ", 9)[-1]
            if tag == "2":
                i += 1  # rename/copy: the origin path is the next NUL record
            yield tag, xy, path
        i += 1


def _entry_staged(tag: str, xy: str) -> bool:
    """A tracked entry whose index (staged) code is set."""
    return tag in ("1", "2") and xy[0] not in (".", "?")


def _classify(tag: str, xy: str, path: str) -> dict:
    y = xy[1] if len(xy) > 1 else "."
    return {
        "path": path,
        "staged": _entry_staged(tag, xy),
        "unstaged": tag == "?" or (tag in ("1", "2") and y not in (".", "?")),
        "untracked": tag == "?",
        "conflicted": tag == "u",
    }


def _status_letter(tag: str, xy: str) -> str:
    if tag in ("?", "u"):
        return tag.upper() if tag == "u" else "?"
    code = xy[0] if xy[0] != "." else (xy[1] if len(xy) > 1 else ".")
    return (code if code != "." else "M").upper()


# â”€â”€ coding rail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def repo_status(cwd: str) -> dict | None:
    """Compact working-tree status for the coding rail. None on a non-repo."""
    if not _is_dir(cwd):
        return None

    try:
        cwd = _review_repo_root(cwd)
    except RuntimeError:
        return None
    code, raw, _ = _git(cwd, ["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=normal"])
    if code != 0:
        return None

    branch: str | None = None
    detached = False
    ahead = behind = 0
    for rec in raw.split("\0"):
        if rec.startswith("# branch.head "):
            head = rec[len("# branch.head ") :]
            detached = head == "(detached)"
            branch = None if detached else head
        elif rec.startswith("# branch.ab "):
            for tok in rec.split()[2:]:
                if tok.startswith("+"):
                    ahead = int(tok[1:] or 0)
                elif tok.startswith("-"):
                    behind = int(tok[1:] or 0)

    files = [_classify(tag, xy, path) for tag, xy, path in _walk_entries(raw)]

    # Match Review's separate prepared/unprepared parts, not the net HEAD
    # diff (which can hide edits that cancel each other across the index).
    added = removed = 0
    try:
        for part in (_review_counts(cwd, ["--cached"]), _review_counts(cwd, [])):
            for count in part.values():
                added += count["added"]
                removed += count["removed"]
        added += sum(_untracked_insertions(cwd, f["path"]) for f in files[:_REVIEW_FILE_CAP] if f["untracked"])
    except RuntimeError:
        return None

    return {
        "branch": branch,
        "defaultBranch": _default_branch_name(cwd),
        "detached": detached,
        "ahead": ahead,
        "behind": behind,
        "staged": sum(f["staged"] for f in files),
        "unstaged": sum(f["unstaged"] for f in files),
        "untracked": sum(f["untracked"] for f in files),
        "conflicted": sum(f["conflicted"] for f in files),
        "changed": len(files),
        "added": added,
        "removed": removed,
        "files": files[:200],
    }


# â”€â”€ review pane â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def _review_out(cwd: str, args: list[str]) -> str:
    code, out, err = _git(cwd, args)
    if code:
        raise RuntimeError(err.strip() or "Git review read failed")
    if len(out.encode("utf-8")) > _MAX_BUFFER:
        raise RuntimeError("Git review output is too large")
    return out


def _review_repo_root(cwd: str) -> str:
    return _review_out(cwd, ["rev-parse", "--show-toplevel"]).strip()


def _review_path(cwd: str, file_path: str) -> str:
    if not isinstance(file_path, str) or not file_path or "\0" in file_path:
        raise RuntimeError("A repository-relative file path is required.")
    rel = file_path.replace("\\", "/")
    if (os.path.isabs(rel) or re.match(r"^[A-Za-z]:", rel)
            or any(p == ".." or p.lower() == ".git" for p in rel.split("/"))):
        raise RuntimeError("The file must be inside the repository working directory.")
    if os.path.abspath(os.path.join(cwd, rel)) == os.path.abspath(cwd):
        raise RuntimeError("A repository-relative file path is required.")
    return rel


def _review_base(cwd: str, requested: str | None) -> tuple[str, str]:
    if not requested:
        base = _branch_base(cwd)
        if not base:
            raise RuntimeError("No comparison base is available. Select a branch.")
        return base, base
    commit = _review_out(cwd, ["rev-parse", "--verify", "--end-of-options", f"{requested}^{{commit}}"]).strip()
    return requested, commit


def _review_counts(cwd: str, args: list[str]) -> dict[str, dict]:
    records = _review_out(cwd, ["diff", "--no-ext-diff", "--numstat", "-z", *args]).split("\0")
    counts: dict[str, dict] = {}
    i = 0
    while i < len(records):
        match = re.match(r"^(\d+|-)\t(\d+|-)\t([\s\S]*)$", records[i])
        i += 1
        if not match:
            continue
        file_path = match[3]
        previous = None
        if not file_path:
            previous, file_path = records[i:i+2]
            i += 2
        counts[file_path] = {
            "added": 0 if match[1] == "-" else int(match[1]),
            "removed": 0 if match[2] == "-" else int(match[2]),
            "binary": match[1] == "-",
            **({"previousPath": previous} if previous else {}),
        }
    return counts


def _review_statuses(cwd: str, rng: str) -> dict[str, str]:
    records = _review_out(cwd, ["diff", "--no-ext-diff", "--name-status", "-z", rng]).split("\0")
    statuses = {}
    i = 0
    while i < len(records) - 1:
        status, file_path = records[i:i+2]
        i += 2
        if status.startswith(("R", "C")):
            file_path = records[i]
            i += 1
        statuses[file_path] = status[:1]
    return statuses


def _review_untracked(cwd: str, rel: str) -> dict:
    target = Path(cwd) / rel
    st = target.lstat()
    directory = target.is_dir() and not target.is_symlink()
    added = 0
    binary = False
    if stat.S_ISREG(st.st_mode) and st.st_size <= _UNTRACKED_LINE_MAX_BYTES:
        data = target.read_bytes()
        binary = b"\0" in data
        if not binary:
            added = data.count(b"\n") + int(bool(data) and not data.endswith(b"\n"))
    return {
        "path": rel, "added": added, "removed": 0, "status": "?", "staged": False,
        "unstaged": True, "stagedAdded": 0, "stagedRemoved": 0,
        "unstagedAdded": added, "unstagedRemoved": 0,
        "kind": "directory" if directory else "file", "binary": binary,
    }


def _review_directory(cwd: str, requested: str) -> dict:
    rel = _review_path(cwd, requested).rstrip("/")
    target = Path(cwd) / rel
    root = Path(cwd).resolve()
    resolved = target.resolve()
    if resolved == root or root not in resolved.parents or target.is_symlink():
        raise RuntimeError("The directory must be inside the repository working directory.")
    raw = _review_out(cwd, ["--literal-pathspecs", "status", "--porcelain=v2", "-z", "--untracked-files=normal", "--", rel + "/"])
    if not any(tag == "?" and p.rstrip("/") == rel for tag, _xy, p in _walk_entries(raw)):
        raise RuntimeError("This untracked directory changed. Refresh the review.")
    paths = []
    truncated = False
    with os.scandir(target) as entries:
        for entry in entries:
            if entry.name.lower() == ".git":
                continue
            if len(paths) == _REVIEW_FILE_CAP:
                truncated = True
                break
            suffix = "/" if entry.is_dir(follow_symlinks=False) else ""
            paths.append(f"{rel}/{entry.name}{suffix}")
    ignored: set[str] = set()
    if paths:
        code, out, err = _git(cwd, ["check-ignore", "-z", "--stdin"], input_data="\0".join(paths) + "\0")
        if code not in (0, 1):
            raise RuntimeError(err.strip() or "Git ignore check failed")
        ignored = {p.rstrip("/") for p in out.split("\0")}
    files = [_review_untracked(cwd, p) for p in paths if p.rstrip("/") not in ignored]
    return {"files": sorted(files, key=lambda f: f["path"]), "base": None, "state": "ready", "truncated": truncated}


def review_list(cwd: str, scope: str, base_ref: str | None, directory: str | None = None) -> dict:
    """Bounded, scope-correct Git reads, with honest empty and error states."""
    try:
        cwd = _review_repo_root(cwd)
        inside = _review_out(cwd, ["rev-parse", "--is-inside-work-tree"]).strip()
        if inside != "true":
            return {"files": [], "base": None, "state": "not-repo"}
        if directory:
            if scope not in ("uncommitted", "unstaged"):
                raise RuntimeError("Directories are only available for uncommitted files.")
            return {**_review_directory(cwd, directory), "repoRoot": cwd}
        if scope in ("branch", "lastTurn"):
            if scope == "lastTurn" and not base_ref:
                raise RuntimeError("No comparison base is available.")
            base, commit = _review_base(cwd, base_ref)
            if not commit:
                raise RuntimeError("No comparison base is available.")
            rng = f"{commit}...HEAD" if scope == "branch" else commit
            counts = _review_counts(cwd, [rng])
            statuses = _review_statuses(cwd, rng)
            files = [
                {"path": p, **count, "status": statuses.get(p, "M"), "staged": False, "unstaged": False, "kind": "file"}
                for p, count in list(counts.items())[:_REVIEW_FILE_CAP]
            ]
            if scope == "lastTurn" and len(files) < _REVIEW_FILE_CAP:
                raw = _review_out(cwd, ["status", "--porcelain=v2", "-z", "--untracked-files=normal"])
                for tag, _xy, p in _walk_entries(raw):
                    if len(files) == _REVIEW_FILE_CAP:
                        break
                    if tag == "?" and p not in counts:
                        files.append(_review_untracked(cwd, p))
            return {"files": sorted(files, key=lambda f: f["path"]), "base": base, "repoRoot": cwd, "state": "ready", "truncated": len(counts) > _REVIEW_FILE_CAP}
        if scope not in ("uncommitted", "staged", "unstaged"):
            raise RuntimeError("Unknown review scope.")
        raw = _review_out(cwd, ["status", "--porcelain=v2", "-z", "--untracked-files=normal"])
        staged = _review_counts(cwd, ["--cached"])
        unstaged = _review_counts(cwd, [])
        files = []
        selected = []
        # Commit intent must use complete status, before scope filtering or the
        # payload cap. A compact untracked directory is one status entry.
        staged_count = total_count = 0
        for tag, xy, p in _walk_entries(raw):
            has_staged = _entry_staged(tag, xy)
            total_count += 1
            staged_count += int(has_staged)
            has_unstaged = tag in ("?", "u") or xy[1] not in (".", " ")
            if scope == "staged" and not has_staged or scope == "unstaged" and not has_unstaged:
                continue
            selected.append((tag, xy, p, has_staged, has_unstaged))
        for tag, xy, p, has_staged, has_unstaged in selected[:_REVIEW_FILE_CAP]:
            if tag == "?":
                files.append(_review_untracked(cwd, p))
                continue
            sc = staged.get(p, {"added": 0, "removed": 0, "binary": False})
            uc = unstaged.get(p, {"added": 0, "removed": 0, "binary": False})
            files.append({
                "path": p, "added": (0 if scope == "unstaged" else sc["added"]) + (0 if scope == "staged" else uc["added"]),
                "removed": (0 if scope == "unstaged" else sc["removed"]) + (0 if scope == "staged" else uc["removed"]),
                "stagedAdded": sc["added"], "stagedRemoved": sc["removed"],
                "unstagedAdded": uc["added"], "unstagedRemoved": uc["removed"],
                "status": xy[1] if scope == "unstaged" else _status_letter(tag, xy),
                "staged": has_staged, "unstaged": has_unstaged, "kind": "file",
                "binary": sc["binary"] if scope == "staged" else uc["binary"] if scope == "unstaged" else sc["binary"] or uc["binary"],
            })
        return {
            "files": sorted(files, key=lambda f: f["path"]), "base": None, "repoRoot": cwd,
            "state": "ready", "stagedCount": staged_count, "totalCount": total_count,
            "truncated": len(selected) > _REVIEW_FILE_CAP,
        }
    except (RuntimeError, OSError) as exc:
        message = str(exc)
        return {"files": [], "base": None, "state": "not-repo" if "not a git repository" in message.lower() else "error", "error": message}


def review_diff(cwd: str, file_path: str, scope: str, base_ref: str | None, staged: bool, full_context: bool = False) -> str:
    cwd = _review_repo_root(cwd)
    rel = _review_path(cwd, file_path)
    context = ["--unified=2147483647"] if full_context else []
    if scope == "branch":
        _, commit = _review_base(cwd, base_ref)
        rng = [f"{commit}...HEAD"]
    elif scope == "lastTurn":
        if not base_ref:
            raise RuntimeError("No comparison base is available.")
        _, commit = _review_base(cwd, base_ref)
        rng = [commit]
    elif scope == "staged" or scope == "uncommitted" and staged:
        rng = ["--cached"]
    elif scope in ("unstaged", "uncommitted"):
        rng = []
    else:
        raise RuntimeError("Unknown review scope.")
    counts = _review_counts(cwd, rng)
    previous = counts.get(rel, {}).get("previousPath")
    paths = [previous, rel] if previous else [rel]
    patch = _review_out(cwd, ["--literal-pathspecs", "diff", "--no-ext-diff", *context, *rng, "--", *paths])
    if patch.strip() or rng:
        return patch
    raw = _review_out(cwd, ["--literal-pathspecs", "status", "--porcelain=v2", "-z", "--untracked-files=normal", "--", rel])
    if not any(tag == "?" and p == rel for tag, _xy, p in _walk_entries(raw)):
        return ""
    if (Path(cwd) / rel).is_dir():
        raise RuntimeError("Select a file inside this untracked directory.")
    code, out, err = _git(cwd, ["--literal-pathspecs", "diff", "--no-ext-diff", *context, "--no-index", "--", os.devnull, rel])
    if code not in (0, 1):
        raise RuntimeError(err.strip() or "Git review read failed")
    if len(out.encode("utf-8")) > _MAX_BUFFER:
        raise RuntimeError("Git review output is too large")
    return out


def file_diff_vs_head(cwd: str, file_path: str) -> str:
    """Working-tree-vs-HEAD diff for one file (the preview's diff view). Unlike
    review_diff, never all-adds a clean tracked file; only a genuinely untracked one."""
    if not _is_dir(cwd):
        return ""
    head = _git_out(cwd, ["diff", "HEAD", "--", file_path])
    if head.strip():
        return head
    status = _git_out(cwd, ["status", "--porcelain", "--", file_path])
    if not status.strip().startswith("??"):
        return ""
    _, out, _ = _git(cwd, ["diff", "--no-index", "--", os.devnull, file_path])
    return out


def review_stage(cwd: str, file_path: str | None) -> dict:
    cwd = _review_repo_root(cwd)
    if file_path:
        file_path = _review_path(cwd, file_path)
    _git_ok(cwd, ["--literal-pathspecs", "add", "--", file_path] if file_path else ["add", "-A"])
    return {"ok": True}


def review_unstage(cwd: str, file_path: str | None) -> dict:
    cwd = _review_repo_root(cwd)
    if file_path:
        file_path = _review_path(cwd, file_path)
    code, _, err = _git(cwd, ["rev-parse", "--verify", "--quiet", "HEAD"])
    if code == 0:
        _git_ok(cwd, ["--literal-pathspecs", "reset", "-q", "HEAD", "--", file_path] if file_path else ["reset", "-q", "HEAD"])
    elif code == 1:
        _review_out(cwd, ["symbolic-ref", "--quiet", "HEAD"])
        # Unborn branch: clear the index only; retain post-stage working edits.
        _git_ok(cwd, ["--literal-pathspecs", "rm", "--cached", "-q", "-r", "-f", "--ignore-unmatch", "--", file_path or "."])
    else:
        raise RuntimeError(err.strip() or "Could not read HEAD")
    return {"ok": True}


def review_revert(cwd: str, file_path: str | None) -> dict:
    """Discard changes back to the committed state (restore tracked, remove untracked)."""
    cwd = _review_repo_root(cwd)
    if file_path:
        file_path = _review_path(cwd, file_path)
    target = ["--", file_path] if file_path else ["--", "."]
    _git(cwd, ["--literal-pathspecs", "checkout", "HEAD", *target])
    _git(cwd, ["--literal-pathspecs", "clean", "-fd", *target])
    return {"ok": True}


def review_rev_parse(cwd: str, ref: str | None) -> str | None:
    out = _git_out(cwd, ["rev-parse", ref or "HEAD"]).strip()
    return out or None


def review_commit(cwd: str, message: str, push: bool) -> dict:
    """Commit the working tree; stage everything first when nothing is staged."""
    _, raw, _ = _git(cwd, ["status", "--porcelain=v2", "-z"])
    if not any(_entry_staged(tag, xy) for tag, xy, _ in _walk_entries(raw)):
        _git_ok(cwd, ["add", "-A"])
    _git_ok(cwd, ["commit", "-m", message])
    if push:
        _review_push(cwd)
    return {"ok": True}


def _review_push(cwd: str) -> None:
    upstream = _git_out(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).strip()
    if upstream:
        _git_ok(cwd, ["push"])
        return
    branch = _git_out(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).strip()
    if branch and branch != "HEAD":
        _git_ok(cwd, ["push", "-u", "origin", branch])


def review_push(cwd: str) -> dict:
    _review_push(cwd)
    return {"ok": True}


def review_commit_context(cwd: str) -> dict:
    """Diff of what WILL commit + recent subjects, for drafting a commit message."""
    if not _is_dir(cwd):
        return {"diff": "", "recent": ""}
    code, raw, _ = _git(cwd, ["status", "--porcelain=v2", "-z"])
    if code != 0:
        return {"diff": "", "recent": ""}
    entries = list(_walk_entries(raw))

    has_staged = any(_entry_staged(tag, xy) for tag, xy, _ in entries)
    diff = _git_out(cwd, ["diff", "--cached"]) if has_staged else _git_out(cwd, ["diff", "HEAD"])
    if len(diff) > _COMMIT_CONTEXT_DIFF_MAX_CHARS:
        omitted = len(diff) - _COMMIT_CONTEXT_DIFF_MAX_CHARS
        diff = f"{diff[:_COMMIT_CONTEXT_DIFF_MAX_CHARS]}\n# diff truncated: {omitted} chars omitted\n"

    untracked = [path for tag, _xy, path in entries if tag == "?"]
    if untracked:
        visible = untracked[:_COMMIT_CONTEXT_UNTRACKED_MAX]
        note = "\n# New (untracked) files:\n" + "".join(f"#   {p}\n" for p in visible)
        if len(untracked) > len(visible):
            note += f"#   ... {len(untracked) - len(visible)} more omitted\n"
        diff = f"{diff}{note}" if diff else note

    return {"diff": diff or "", "recent": _git_out(cwd, ["log", "-n", "10", "--pretty=format:%s"]).strip()}


# â”€â”€ ship flow (gh) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def _gh(cwd: str, args: list[str]) -> tuple[bool, str]:
    if not shutil.which("gh"):
        return False, ""
    # Same non-interactive contract as _git: these serve REST requests, so gh
    # must fail fast instead of prompting (GH_PROMPT_DISABLED is gh's own
    # documented kill-switch for interactive prompts).
    env = noninteractive_git_env()
    env["GH_PROMPT_DISABLED"] = "1"
    try:
        proc = subprocess.run(
            ["gh", *args], cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=_GH_TIMEOUT,
            stdin=subprocess.DEVNULL, env=env,
        )
    except (OSError, subprocess.SubprocessError):
        return False, ""
    return proc.returncode == 0, proc.stdout or ""


def review_ship_info(cwd: str) -> dict:
    """gh availability/auth + this branch's PR. ghReady false when gh missing/unauthed."""
    if not _is_dir(cwd):
        return {"ghReady": False, "pr": None}
    auth_ok, _ = _gh(cwd, ["auth", "status"])
    if not auth_ok:
        return {"ghReady": False, "pr": None}
    view_ok, out = _gh(cwd, ["pr", "view", "--json", "url,state,number"])
    if not view_ok:
        return {"ghReady": True, "pr": None}
    try:
        pr = json.loads(out)
    except json.JSONDecodeError:
        return {"ghReady": True, "pr": None}
    if pr and pr.get("url"):
        return {"ghReady": True, "pr": {"url": pr["url"], "state": pr.get("state"), "number": pr.get("number")}}
    return {"ghReady": True, "pr": None}


# GraphQL asks per branch, so the answer can't be crowded out the way a
# `gh pr list` page can. Aliases let one request carry many branches; 50 keeps
# the document well inside GitHub's node budget.
_PR_QUERY_BRANCH_CHUNK = 50
_PR_QUERY_BRANCH_CAP = 300


_PR_NODE_FIELDS = "number state isDraft isCrossRepository title url headRefName"


def _pr_query(owner: str, name: str, branches: list[str], numbers: list[int]) -> str:
    fields = [
        f"b{i}: pullRequests(headRefName: {json.dumps(branch)}, first: 5, "
        f"orderBy: {{field: CREATED_AT, direction: DESC}}) "
        f"{{ nodes {{ {_PR_NODE_FIELDS} }} }}"
        for i, branch in enumerate(branches)
    ]
    # A PR recovered from a transcript is known by number, and asking for it
    # directly also tells us its branch â€” so it lands in the same by-branch map
    # as everything else.
    fields += [f"n{i}: pullRequest(number: {n}) {{ {_PR_NODE_FIELDS} }}" for i, n in enumerate(numbers)]
    return (
        f"query {{ repository(owner: {json.dumps(owner)}, name: {json.dumps(name)}) {{\n"
        + "\n".join(fields)
        + "\n} }"
    )


def _pr_payload(pr: dict) -> dict:
    return {
        "branch": str(pr.get("headRefName")),
        "draft": bool(pr.get("isDraft")),
        "number": int(pr.get("number") or 0),
        "state": str(pr.get("state") or "").lower(),
        "title": str(pr.get("title") or ""),
        "url": str(pr.get("url") or ""),
    }


def review_pr_list(cwd: str, branches: list[str], numbers: list[int] = None) -> dict:
    """The PRs on the given branches (plus any asked for by number). Asks GitHub
    about the branches we actually have sessions on rather than listing the
    repo's newest PRs and hoping ours are in the page."""
    if not _is_dir(cwd):
        return {"ghReady": False, "prs": []}
    wanted = list(dict.fromkeys(str(b) for b in (branches or []) if b))[:_PR_QUERY_BRANCH_CAP]
    by_number = list(dict.fromkeys(int(n) for n in (numbers or []) if n))[:_PR_QUERY_BRANCH_CAP]
    if not wanted and not by_number:
        return {"ghReady": False, "prs": []}
    repo_ok, repo_out = _gh(cwd, ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
    owner, _, name = repo_out.strip().partition("/")
    if not repo_ok or not owner or not name:
        # gh missing, unauthenticated, or no GitHub remote â€” all "nothing to badge".
        return {"ghReady": False, "prs": []}

    prs: list[dict] = []
    chunks = [
        (wanted[i : i + _PR_QUERY_BRANCH_CHUNK], [])
        for i in range(0, len(wanted), _PR_QUERY_BRANCH_CHUNK)
    ] + [
        ([], by_number[i : i + _PR_QUERY_BRANCH_CHUNK])
        for i in range(0, len(by_number), _PR_QUERY_BRANCH_CHUNK)
    ]
    for branch_chunk, number_chunk in chunks:
        ok, out = _gh(cwd, ["api", "graphql", "-f", f"query={_pr_query(owner, name, branch_chunk, number_chunk)}"])
        if not ok:
            continue
        try:
            repository = (json.loads(out).get("data") or {}).get("repository") or {}
        except json.JSONDecodeError:
            continue  # A malformed chunk drops its branches; the rest still resolve.
        for key, field in repository.items():
            if not field:
                continue
            if key.startswith("n"):
                # Asked for by number, so it's ours by construction â€” a fork PR
                # can't be recovered from our own transcript.
                if field.get("headRefName"):
                    prs.append(_pr_payload(field))
                continue
            # Fork PRs share our branch namespace: a contributor's `main` is how
            # a session sitting on trunk ends up badged with a stranger's closed
            # PR. Only this repo's own branches describe our sessions.
            nodes = field.get("nodes") or []
            pr = next((n for n in nodes if n and not n.get("isCrossRepository")), None)
            if pr and pr.get("headRefName"):
                prs.append(_pr_payload(pr))
    return {"ghReady": True, "prs": prs}


def review_create_pr(cwd: str) -> dict:
    """Create a PR for the current branch (push first), letting gh fill title/body."""
    try:
        _review_push(cwd)
    except RuntimeError:
        pass
    created, out = _gh(cwd, ["pr", "create", "--fill"])
    if not created:
        raise RuntimeError("gh pr create failed (is gh installed and authenticated?)")
    url = next((line for line in reversed(out.strip().splitlines()) if line.strip()), "")
    return {"url": url}


# â”€â”€ worktrees & branches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def _parse_worktrees(out: str) -> list[dict]:
    trees: list[dict] = []
    cur: dict | None = None
    for line in out.split("\n"):
        if line.startswith("worktree "):
            if cur:
                trees.append(cur)
            cur = {"path": line[9:].strip(), "branch": None, "detached": False, "bare": False, "locked": False}
        elif cur is None:
            continue
        elif line.startswith("branch "):
            cur["branch"] = line[7:].strip().replace("refs/heads/", "", 1)
        elif line == "detached":
            cur["detached"] = True
        elif line == "bare":
            cur["bare"] = True
        elif line.startswith("locked"):
            cur["locked"] = True
    if cur:
        trees.append(cur)
    return trees


def worktree_list(cwd: str) -> list[dict]:
    out = _git_out(cwd, ["worktree", "list", "--porcelain"])
    if not out:
        return []
    return [
        {
            "path": tree["path"],
            "branch": tree["branch"],
            "isMain": index == 0,
            "detached": tree["detached"],
            "locked": tree["locked"],
        }
        for index, tree in enumerate(_parse_worktrees(out))
    ]


def _main_root(cwd: str) -> str:
    for tree in worktree_list(cwd):
        if tree["isMain"]:
            return tree["path"]
    return cwd


def _sanitize_branch(name: str) -> str:
    value = str(name or "")
    value = re.sub(r"\s+", "-", value)
    value = re.sub(r"[^\w./-]", "", value)
    value = re.sub(r"-{2,}", "-", value)
    value = re.sub(r"/{2,}", "/", value)
    value = re.sub(r"\.{2,}", ".", value)
    return re.sub(r"^[-./]+|[-./]+$", "", value)


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(name or "").strip().lower())
    slug = re.sub(r"^-+|-+$", "", slug)[:40].rstrip("-")
    return slug or "work"


def _default_branch(cwd: str) -> str:
    remote = _git_out(
        cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]
    ).strip().replace("origin/", "", 1)
    if remote:
        return remote
    configured = _git_out(cwd, ["config", "--get", "init.defaultBranch"]).strip()
    if configured:
        return configured
    for branch in _TRUNK_BRANCHES:
        if _git_out(cwd, ["show-ref", "--verify", f"refs/heads/{branch}"]).strip():
            return branch
    return ""


def _ensure_repo(cwd: str) -> None:
    """A new project folder may not be a repo (or has no commit to branch from);
    init it with a root commit so worktrees just work. No-op for a committed repo."""
    inside = _git_out(cwd, ["rev-parse", "--is-inside-work-tree"]).strip()
    needs_root = False
    if inside != "true":
        _git_ok(cwd, ["init"])
        needs_root = True
    else:
        code, _, _ = _git(cwd, ["rev-parse", "--verify", "HEAD"])
        needs_root = code != 0
    if needs_root:
        _git_ok(
            cwd,
            [
                "-c",
                "user.email=work4you@localhost",
                "-c",
                "user.name=Work4You",
                "commit",
                "--allow-empty",
                "-m",
                "Initial commit",
            ],
        )


def _unique_dir(base: str) -> str:
    candidate = base
    n = 1
    while os.path.exists(candidate):
        n += 1
        candidate = f"{base}-{n}"
    return candidate


def _remote_of_ref(cwd: str, name: str) -> str:
    """The remote a ref belongs to ("origin" for "origin/main"), or "" when the
    name is not a remote-tracking ref in this repo. Asks git rather than
    assuming the remote is called "origin" (mirrors the Electron op)."""
    if "/" not in name:
        return ""
    code, _, _ = _git(cwd, ["show-ref", "--verify", "--quiet", f"refs/remotes/{name}"])
    if code != 0:
        return ""
    return name.split("/", 1)[0]


def worktree_add(cwd: str, options: dict) -> dict:
    _ensure_repo(cwd)
    root = _main_root(cwd)
    options = options or {}

    requested = _sanitize_branch(options.get("existingBranch") or "")
    if options.get("existingBranch"):
        if not requested:
            raise RuntimeError("Branch name is required.")
        # "origin/feature" is a remote-tracking ref, not a branch git can check
        # out â€” `git worktree add <dir> origin/feature` detaches HEAD. Create a
        # local branch with the same short name that tracks the remote ref,
        # like `git switch feature` does for a branch on exactly one remote.
        # (Parity with the Electron op; a remote gateway serves this mirror, so
        # the desktop's convert-a-branch flow must behave identically. #81724)
        remote = _remote_of_ref(root, requested)
        existing = requested.split("/", 1)[1] if remote else requested
        if not remote and existing == _default_branch(root):
            _git_ok(root, ["switch", existing])
            return {"path": root, "branch": existing, "repoRoot": root}
        target = _unique_dir(os.path.join(root, ".worktrees", _slugify(existing)))
        if remote:
            # Best-effort freshness: the remote-tracking ref is stale if the
            # user did not fetch recently. On failure (offline, branch gone)
            # the last known ref is still there to branch from.
            _git(root, ["fetch", remote, existing])
            _git_ok(root, ["worktree", "add", "--track", "-b", existing, target, requested])
            return {"path": target, "branch": existing, "repoRoot": root}
        _git_ok(root, ["worktree", "add", target, existing])
        return {"path": target, "branch": existing, "repoRoot": root}

    slug = _slugify(options.get("name") or f"work-{os.urandom(4).hex()}")
    branch = _sanitize_branch(options.get("branch") or "") or f"work4you/{slug}"
    target = _unique_dir(os.path.join(root, ".worktrees", slug))
    args = ["worktree", "add", "-b", branch, target]
    if options.get("base"):
        base = str(options["base"])
        # Remote-tracking branches may be stale or missing; fetch just that
        # branch so the local ref is up to date before branching. Ignore fetch
        # failures (offline / no remote) â€” git will use whatever local ref
        # exists, or raise a clear error below if the ref is entirely missing.
        if base.startswith("origin/"):
            remote_branch = base[len("origin/"):]
            _git(root, ["fetch", "origin", remote_branch])
            # Branching off a remote-tracking ref auto-sets up tracking (the
            # new branch silently wired to origin's upstream). The user wants a
            # standalone local branch â€” like `git checkout origin/main && git
            # checkout -b new` â€” so suppress it (parity with the Electron op).
            args.append("--no-track")
        args.append(base)
    code, _, err = _git(root, args)
    if code != 0:
        if "already exists" in (err or "").lower():
            _git_ok(root, ["worktree", "add", target, branch])
        else:
            raise RuntimeError(err.strip() or "git worktree add failed")
    return {"path": target, "branch": branch, "repoRoot": root}


def worktree_remove(cwd: str, worktree_path: str, force: bool) -> dict:
    root = _main_root(cwd)
    args = ["worktree", "remove"]
    if force:
        args.append("--force")
    args.append(worktree_path)
    _git_ok(root, args)
    return {"removed": worktree_path}


def branch_list(cwd: str) -> list[dict]:
    """Branches for the convert-a-branch picker: local heads first, then the
    remote-tracking refs that have no local head yet (a teammate's branch is
    reachable without a manual checkout). Parity with the Electron op â€” a
    remote gateway serves this mirror for the same desktop UI (#81724)."""
    out = _git_out(
        cwd, ["for-each-ref", "--format=%(refname:short)", "--sort=-committerdate", "refs/heads"]
    )
    if not out:
        return []
    trees = worktree_list(cwd)
    path_by_branch = {t["branch"]: t["path"] for t in trees if t["branch"]}
    trunk = _default_branch(cwd)
    locals_ = [name for name in (line.strip() for line in out.split("\n")) if name]
    local_set = set(locals_)
    remote_out = _git_out(
        cwd, ["for-each-ref", "--format=%(refname:short)", "--sort=-committerdate", "refs/remotes"]
    )
    remotes = [
        name
        for name in (line.strip() for line in remote_out.split("\n"))
        if name
        # "origin/HEAD" is a symbolic alias for the remote's default branch â€”
        # not a branch, and a duplicate row in the list.
        and not name.endswith("/HEAD")
        # A remote branch tracked locally is reachable via its local head; a
        # second row is noise, and checking out the remote ref detaches HEAD.
        and name.split("/", 1)[-1] not in local_set
    ]
    return [
        *(
            {
                "name": name,
                "checkedOut": name in path_by_branch,
                "isDefault": bool(trunk and name == trunk),
                "isRemote": False,
                "worktreePath": path_by_branch.get(name),
            }
            for name in locals_
        ),
        *(
            {
                # No local checkout, and never the local trunk.
                "name": name,
                "checkedOut": False,
                "isDefault": False,
                "isRemote": True,
                "worktreePath": None,
            }
            for name in remotes
        ),
    ]


def branch_switch(cwd: str, branch: str) -> dict:
    target = _sanitize_branch(branch)
    if not target:
        raise RuntimeError("Branch name is required.")
    _git_ok(cwd, ["switch", target])
    return {"branch": target}


def base_branch_list(cwd: str) -> list[dict]:
    """Local heads + remote-tracking refs for the base-branch picker.

    The remote default (origin/HEAD) is flagged so the UI can preselect it.
    """
    out = _git_out(
        cwd,
        [
            "for-each-ref",
            "--format=%(refname:short)\t%(committerdate:iso)",
            "--sort=-committerdate",
            "refs/heads",
            "refs/remotes",
        ],
    )
    if not out:
        return []
    remote_default = _git_out(
        cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]
    ).strip()
    local_default = _default_branch(cwd) if not remote_default else ""
    result: list[dict] = []
    for line in out.split("\n"):
        line = line.strip()
        if not line:
            continue
        name = line.split("\t")[0]
        result.append(
            {
                "name": name,
                "isRemote": name.startswith("origin/"),
                # origin/HEAD when a remote exists; otherwise the local
                # default (main/master/init.defaultBranch) so a no-remote
                # repo still flags its trunk.
                "isDefault": bool(
                    (remote_default and name == remote_default)
                    or (not remote_default and local_default and name == local_default)
                ),
            }
        )
    return result
