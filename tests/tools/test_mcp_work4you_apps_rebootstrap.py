"""Work4You Apps 401 recovery re-bootstraps the broker token."""

from __future__ import annotations

import asyncio
from unittest.mock import patch

from tools.mcp_tool import (
    MCPServerTask,
    _is_work4you_apps_server,
    refresh_work4you_apps_mcp_config,
)


def test_refresh_ignores_non_apps_servers():
    server = MCPServerTask("notion")
    server._config = {"url": "https://example"}
    assert refresh_work4you_apps_mcp_config(server) is False
    assert server._config == {"url": "https://example"}
    assert _is_work4you_apps_server("notion") is False
    assert _is_work4you_apps_server("work4you_apps") is True


def test_refresh_reloads_interpolated_token(monkeypatch, _isolate_work4you_home):
    from work4you_cli.connectors import (
        WORK4YOU_APPS_SERVER_NAME,
        WORK4YOU_APPS_TOKEN_ENV,
        inject_work4you_apps,
    )
    from work4you_constants import get_work4you_home

    inject_work4you_apps(
        mcp_url="https://connectors-api.work4you.ai/mcp",
        token="w4y-c-stale",
        enabled=True,
    )
    server = MCPServerTask(WORK4YOU_APPS_SERVER_NAME)
    server._config = {
        "url": "https://connectors-api.work4you.ai/mcp",
        "headers": {"Authorization": "Bearer stale"},
        "enabled": True,
    }

    import work4you_cli.connectors as connectors

    monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

    def fake_broker(method, path, **kwargs):
        assert method == "POST"
        assert path == "/v1/bootstrap"
        return {
            "mcp": {
                "url": "https://connectors-api.work4you.ai/mcp",
                "token": "w4y-c-fresh-token",
            },
            "connected": ["gmail"],
        }

    monkeypatch.setattr(connectors, "broker_request", fake_broker)
    assert refresh_work4you_apps_mcp_config(server) is True
    assert "w4y-c-fresh-token" in server._config["headers"]["Authorization"]
    env_text = (get_work4you_home() / ".env").read_text()
    assert f"{WORK4YOU_APPS_TOKEN_ENV}=w4y-c-fresh-token" in env_text
    assert server._config.get("enabled") is True


def test_run_uses_refreshed_config_after_work4you_apps_401(monkeypatch):
    """The reconnect loop must pass self._config, not the original dict."""
    captured = []

    async def fake_http(self, config):
        captured.append(config.get("headers", {}).get("Authorization"))
        if len(captured) == 1:
            raise PermissionError("401 unauthorized unknown_mcp_token")
        self._shutdown_event.set()
        return None

    def fake_refresh(server):
        server._config = {
            "url": "https://connectors-api.work4you.ai/mcp",
            "headers": {"Authorization": "Bearer new"},
            "skip_preflight": True,
        }
        return True

    monkeypatch.setattr("tools.mcp_tool._is_auth_error", lambda exc: True)
    monkeypatch.setattr("tools.mcp_tool.refresh_work4you_apps_mcp_config", fake_refresh)

    server = MCPServerTask("work4you_apps")

    async def drive():
        with (
            patch.object(MCPServerTask, "_run_http", fake_http),
            patch.object(MCPServerTask, "_is_http", lambda self: True),
            patch("tools.mcp_tool._validate_remote_mcp_url", lambda *a, **k: None),
            patch.object(
                MCPServerTask,
                "_preflight_content_type",
                lambda *a, **k: None,
            ),
        ):
            await server.run({
                "url": "https://connectors-api.work4you.ai/mcp",
                "headers": {"Authorization": "Bearer stale"},
                "skip_preflight": True,
            })

    asyncio.run(drive())
    assert captured[:2] == ["Bearer stale", "Bearer new"]
