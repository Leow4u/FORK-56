"""Real Git contracts shared by local Review and the remote gateway adapter."""
import asyncio
import subprocess

import pytest

from work4you_cli import web_git


def git(cwd, *args):
    return subprocess.check_output(["git", *args], cwd=cwd, text=True, encoding="utf-8").strip()


@pytest.fixture
def repo(tmp_path):
    tmp_path = tmp_path / "repository"
    tmp_path.mkdir()
    git(tmp_path, "init", "-q")
    git(tmp_path, "config", "user.email", "review@example.test")
    git(tmp_path, "config", "user.name", "Review Test")
    git(tmp_path, "config", "core.autocrlf", "false")
    (tmp_path / "tracked.txt").write_text("tracked\n", encoding="utf-8")
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-qm", "initial")
    return tmp_path


def test_partial_staging_counts_patches_and_commit_agree(repo):
    target = repo / "tracked.txt"
    target.write_text("prepared\n", encoding="utf-8")
    git(repo, "add", ".")
    target.write_text("tracked\n", encoding="utf-8")
    all_changes = web_git.review_list(str(repo), "uncommitted", None)
    staged = web_git.review_list(str(repo), "staged", None)
    unstaged = web_git.review_list(str(repo), "unstaged", None)
    item = all_changes["files"][0]
    assert all_changes["state"] == "ready"
    assert item["staged"] and item["unstaged"]
    assert item["added"] == staged["files"][0]["added"] + unstaged["files"][0]["added"]
    assert item["stagedAdded"] == staged["files"][0]["added"]
    assert item["unstagedAdded"] == unstaged["files"][0]["added"]
    assert "+prepared" in web_git.review_diff(str(repo), "tracked.txt", "staged", None, False)
    assert "+tracked" in web_git.review_diff(str(repo), "tracked.txt", "unstaged", None, True)
    status = web_git.repo_status(str(repo))
    assert (status["added"], status["removed"]) == (item["added"], item["removed"])
    web_git.review_commit(str(repo), "prepared only", False)
    assert git(repo, "show", "HEAD:tracked.txt") == "prepared"
    assert target.read_text(encoding="utf-8") == "tracked\n"


def test_explicit_local_and_remote_base_drive_list_and_patch_without_checkout(repo):
    git(repo, "branch", "-M", "main")
    git(repo, "switch", "-qc", "feature")
    (repo / "first.txt").write_text("first\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "first")
    git(repo, "branch", "later-base")
    git(repo, "update-ref", "refs/remotes/origin/later-base", "HEAD")
    (repo / "second.txt").write_text("second\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "second")
    main = web_git.review_list(str(repo), "branch", "main")
    local = web_git.review_list(str(repo), "branch", "later-base")
    remote = web_git.review_list(str(repo), "branch", "origin/later-base")
    assert [f["path"] for f in main["files"]] == ["first.txt", "second.txt"]
    assert [f["path"] for f in local["files"]] == ["second.txt"]
    assert remote["files"] == local["files"]
    assert web_git.review_diff(str(repo), "first.txt", "branch", "later-base", False) == ""
    assert "+first" in web_git.review_diff(str(repo), "first.txt", "branch", "main", False)
    assert web_git.review_list(str(repo), "branch", "missing-base")["state"] == "error"
    with pytest.raises(RuntimeError):
        web_git.review_diff(str(repo), "first.txt", "branch", "missing-base", False)
    assert git(repo, "branch", "--show-current") == "feature"


def test_automatic_branch_base_works_with_only_remote_default_ref(repo):
    git(repo, "branch", "-M", "feature")
    base = git(repo, "rev-parse", "HEAD")
    git(repo, "update-ref", "refs/remotes/origin/main", base)
    git(repo, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")
    (repo / "feature.txt").write_text("feature change\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "feature change")
    result = web_git.review_list(str(repo), "branch", None)
    assert result["state"] == "ready" and result["base"] == base
    assert [f["path"] for f in result["files"]] == ["feature.txt"]
    assert "+feature change" in web_git.review_diff(str(repo), "feature.txt", "branch", None, False)
    assert git(repo, "branch", "--list", "main") == ""
    assert git(repo, "branch", "--show-current") == "feature"


def test_commit_metadata_includes_staged_paths_beyond_payload_cap(repo, monkeypatch):
    monkeypatch.setattr(web_git, "_REVIEW_FILE_CAP", 3)
    paths = ["a.txt", "b.txt", "c.txt", "z-staged.txt"]
    for p in paths:
        (repo / p).write_text("original\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "many tracked files")
    for p in paths:
        (repo / p).write_text("changed\n", encoding="utf-8")
    git(repo, "add", "z-staged.txt")
    result = web_git.review_list(str(repo), "uncommitted", None)
    assert len(result["files"]) == 3 and result["truncated"]
    assert not any(f["staged"] for f in result["files"])
    assert result["stagedCount"] == 1 and result["totalCount"] == len(paths)
    prepared = web_git.review_list(str(repo), "staged", None)
    assert [f["path"] for f in prepared["files"]] == ["z-staged.txt"]
    assert prepared["stagedCount"] == result["stagedCount"]
    assert prepared["totalCount"] == result["totalCount"]
    web_git.review_commit(str(repo), "prepared subset", False)
    assert git(repo, "show", "--format=", "--name-only", "HEAD") == "z-staged.txt"


def test_full_context_uses_index_content_not_worktree_content(repo):
    target = repo / "tracked.txt"
    original = "".join(f"line {n}\n" for n in range(40))
    target.write_text(original, encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "many lines")
    target.write_text(original.replace("line 20", "prepared line"), encoding="utf-8")
    git(repo, "add", ".")
    target.write_text(original.replace("line 20", "worktree only"), encoding="utf-8")
    compact = web_git.review_diff(str(repo), "tracked.txt", "staged", None, False)
    full = web_git.review_diff(str(repo), "tracked.txt", "staged", None, False, True)
    assert "line 0" not in compact
    assert " line 0" in full and "+prepared line" in full
    assert "worktree only" not in full


def test_directory_browsing_is_immediate_and_respects_ignores(repo):
    (repo / ".gitignore").write_text("*.ignored\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "ignore")
    (repo / "new" / "nested").mkdir(parents=True)
    (repo / "new" / "a.txt").write_text("new file\n", encoding="utf-8")
    (repo / "new" / "secret.ignored").write_text("excluded\n", encoding="utf-8")
    (repo / "new" / "nested" / "b.txt").write_text("nested\n", encoding="utf-8")
    root = web_git.review_list(str(repo), "uncommitted", None)
    assert [(f["path"], f["kind"]) for f in root["files"]] == [("new/", "directory")]
    children = web_git.review_list(str(repo), "uncommitted", None, "new/")
    assert children["state"] == "ready"
    assert [f["path"] for f in children["files"]] == ["new/a.txt", "new/nested/"]
    assert "+new file" in web_git.review_diff(str(repo), "new/a.txt", "uncommitted", None, False)
    assert web_git.review_diff(str(repo), "tracked.txt", "uncommitted", None, False) == ""
    assert web_git.review_list(str(repo), "uncommitted", None, "../")["state"] == "error"
    with pytest.raises(RuntimeError):
        web_git.review_diff(str(repo), "../outside.txt", "uncommitted", None, False)


def test_clean_nonrepo_and_read_errors_are_distinct(repo, tmp_path):
    clean = web_git.review_list(str(repo), "uncommitted", None)
    assert clean["state"] == "ready" and clean["files"] == []
    # tmp_path is the repository itself; use a separate directory outside it.
    empty = tmp_path.parent / (tmp_path.name + "-nonrepo")
    empty.mkdir()
    assert web_git.review_list(str(empty), "uncommitted", None)["state"] == "not-repo"
    assert web_git.review_list(str(repo / "missing"), "uncommitted", None)["state"] == "error"
    git(repo, "config", "core.repositoryformatversion", "invalid")
    assert web_git.review_list(str(repo), "uncommitted", None)["state"] == "error"


def test_rename_deleted_binary_and_unicode_paths_keep_their_git_meaning(repo):
    (repo / "binary.bin").write_bytes(b"\x00\x01")
    (repo / "remove.txt").write_text("remove\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "files")
    git(repo, "mv", "tracked.txt", "renamed ü.txt")
    (repo / "remove.txt").unlink()
    (repo / "binary.bin").write_bytes(b"\x00\x02")
    staged = web_git.review_list(str(repo), "staged", None)["files"]
    assert staged[0]["status"] == "R" and staged[0]["added"] == 0
    assert "rename from tracked.txt" in web_git.review_diff(str(repo), "renamed ü.txt", "staged", None, False)
    pending = {f["path"]: f for f in web_git.review_list(str(repo), "unstaged", None)["files"]}
    assert pending["binary.bin"]["binary"]
    assert pending["remove.txt"]["status"] == "D"
    assert "Binary files" in web_git.review_diff(str(repo), "binary.bin", "unstaged", None, False)
    assert "-remove" in web_git.review_diff(str(repo), "remove.txt", "unstaged", None, False)


def test_unborn_repo_can_review_staged_unstaged_and_new_files(tmp_path):
    tmp_path = tmp_path / "repository"
    tmp_path.mkdir()
    git(tmp_path, "init", "-q")
    git(tmp_path, "config", "core.autocrlf", "false")
    (tmp_path / "first.txt").write_text("prepared\n", encoding="utf-8")
    git(tmp_path, "add", ".")
    (tmp_path / "first.txt").write_text("pending\n", encoding="utf-8")
    result = web_git.review_list(str(tmp_path), "uncommitted", None)
    assert result["state"] == "ready"
    assert result["files"][0]["staged"] and result["files"][0]["unstaged"]
    assert "+prepared" in web_git.review_diff(str(tmp_path), "first.txt", "staged", None, False)


def test_list_payload_is_bounded_without_recursive_expansion(repo, monkeypatch):
    monkeypatch.setattr(web_git, "_REVIEW_FILE_CAP", 3)
    for i in range(5):
        (repo / f"new-{i}.txt").write_text("new\n", encoding="utf-8")
    result = web_git.review_list(str(repo), "uncommitted", None)
    assert len(result["files"]) == 3 and result["truncated"]


def test_review_routes_forward_directory_and_full_context_to_real_git(repo, monkeypatch):
    from work4you_cli.web_routers import git as routes
    async def operation(fn, *args):
        return fn(*args)
    monkeypatch.setattr(routes, "_git_op", operation)
    monkeypatch.setattr(routes, "_git_path", lambda p: p)
    (repo / "new").mkdir()
    (repo / "new" / "a.txt").write_text("new file\n", encoding="utf-8")
    listing = asyncio.run(routes.git_review_list_route(str(repo), "uncommitted", None, "new/"))
    assert listing["files"][0]["path"] == "new/a.txt"
    response = asyncio.run(routes.git_review_diff_route(str(repo), "new/a.txt", "unstaged", None, False, True))
    assert "+new file" in response["diff"]


def test_subfolder_sessions_use_repo_relative_paths_for_reads_and_staging(repo):
    child = repo / "src"
    child.mkdir()
    (repo / "tracked.txt").write_text("changed\n", encoding="utf-8")
    (child / "new.txt").write_text("new\n", encoding="utf-8")
    result = web_git.review_list(str(child), "uncommitted", None)
    assert result["repoRoot"].replace("\\", "/") == str(repo).replace("\\", "/")
    assert "+changed" in web_git.review_diff(str(child), "tracked.txt", "uncommitted", None, False)
    children = web_git.review_list(str(child), "uncommitted", None, "src/")
    assert children["files"][0]["path"] == "src/new.txt"
    assert "+new" in web_git.review_diff(str(child), "src/new.txt", "uncommitted", None, False)
    web_git.review_stage(str(child), "tracked.txt")
    assert web_git.review_list(str(child), "staged", None)["files"][0]["path"] == "tracked.txt"
    web_git.review_unstage(str(child), "tracked.txt")
    assert web_git.review_list(str(child), "staged", None)["files"] == []


def test_unstage_unborn_branch_preserves_working_files_and_post_stage_edits(tmp_path):
    tmp_path = tmp_path / "repository"
    tmp_path.mkdir()
    git(tmp_path, "init", "-q")
    git(tmp_path, "config", "core.autocrlf", "false")
    (tmp_path / "first.txt").write_text("prepared\n", encoding="utf-8")
    (tmp_path / "second.txt").write_text("second\n", encoding="utf-8")
    git(tmp_path, "add", ".")
    (tmp_path / "first.txt").write_text("working changes\n", encoding="utf-8")
    web_git.review_unstage(str(tmp_path), "first.txt")
    assert (tmp_path / "first.txt").read_text(encoding="utf-8") == "working changes\n"
    assert [f["path"] for f in web_git.review_list(str(tmp_path), "staged", None)["files"]] == ["second.txt"]
    web_git.review_unstage(str(tmp_path), None)
    assert web_git.review_list(str(tmp_path), "staged", None)["files"] == []
    assert (tmp_path / "second.txt").read_text(encoding="utf-8") == "second\n"
