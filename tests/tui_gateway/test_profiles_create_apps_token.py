"""profiles.create must not copy WORK4YOU_APPS_MCP_TOKEN into the new home.

Clone and Bot Mode credential-mirror copy the launch ``.env``. That token
selects a Composio session; sharing it would bind both homes to the same
``sub::{profile}`` entity.
"""

from __future__ import annotations

from pathlib import Path

import pytest

import tui_gateway.server as server


@pytest.fixture
def work4you_root(tmp_path, monkeypatch):
    root = tmp_path / "work4you_home"
    root.mkdir()
    (root / ".env").write_text(
        "OPENAI_API_KEY=sk-launch\nWORK4YOU_APPS_MCP_TOKEN=w4y-c-launch-home\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("WORK4YOU_HOME", str(root))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    from work4you_constants import get_work4you_home_override

    assert get_work4you_home_override() is None
    return root


def _call(method, params=None):
    handler = server._methods[method]
    return handler(1, params or {})


def _result(resp):
    assert "error" not in resp, resp.get("error")
    return resp["result"]


def test_mirror_credentials_strips_apps_mcp_token(work4you_root, monkeypatch):
    from work4you_cli import profiles as profiles_mod

    monkeypatch.setattr(profiles_mod, "create_wrapper_script", lambda *a, **k: None)
    monkeypatch.setattr(profiles_mod, "seed_profile_skills", lambda *a, **k: None)
    monkeypatch.setattr(profiles_mod, "check_alias_collision", lambda *_a, **_k: "skip")

    result = _result(
        _call(
            "profiles.create",
            {
                "name": "appsbot",
                "mirror_credentials": True,
                "share_auth": True,
            },
        )
    )
    assert result.get("ok") is True or "path" in result or "name" in result
    dest = Path(work4you_root) / "profiles" / "appsbot" / ".env"
    assert dest.is_file()
    text = dest.read_text(encoding="utf-8")
    assert "OPENAI_API_KEY=sk-launch" in text
    assert "WORK4YOU_APPS_MCP_TOKEN" not in text
    assert "w4y-c-launch-home" not in text
    launch = (work4you_root / ".env").read_text(encoding="utf-8")
    assert "WORK4YOU_APPS_MCP_TOKEN=w4y-c-launch-home" in launch
