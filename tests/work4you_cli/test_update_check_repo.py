"""Every update probe must point at the repository the payload installs from.

The behind-count for git installs goes through three places that name the
repository: the HTTPS ls-remote URL, the GitHub compare API URL and the
"official remote" check. A placeholder slug in any one of them makes the count
unrecoverable (the compare call 404s), so the contract pinned here is that all
three agree with ``runtime_payload.DEFAULT_GITHUB_REPO`` — not what the slug
literally is.
"""

from __future__ import annotations

import json

from work4you_cli import banner
from work4you_cli.runtime_payload import DEFAULT_GITHUB_REPO


class _Response:
    def __init__(self, payload: dict):
        self._payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


def test_compare_api_targets_the_payload_repository(monkeypatch):
    seen = {}

    def fake_urlopen(req, timeout=0):
        seen["url"] = req.full_url
        return _Response({"ahead_by": 3})

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    assert banner._github_compare_behind("a" * 40, "b" * 40) == 3
    assert seen["url"].startswith(f"https://api.github.com/repos/{DEFAULT_GITHUB_REPO}/compare/")


def test_ls_remote_and_official_remote_agree_with_the_payload_repository():
    slug = DEFAULT_GITHUB_REPO

    assert banner._UPSTREAM_REPO_URL == f"https://github.com/{slug}.git"
    assert banner._is_official_ssh_remote(f"git@github.com:{slug}.git")
    assert banner._is_official_ssh_remote(f"ssh://git@github.com/{slug.upper()}.git")
    # An SSH remote of some other repository is a fork, not the official one.
    assert not banner._is_official_ssh_remote("git@github.com:someone-else/their-fork.git")
    # HTTPS remotes never take the SSH-only passive probe path.
    assert not banner._is_official_ssh_remote(f"https://github.com/{slug}.git")
