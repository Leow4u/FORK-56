"""Work4You Apps local control plane — directory merge + hidden MCP inject."""

from types import SimpleNamespace

import pytest

from work4you_cli.connectors import (
    WORK4YOU_APPS_SERVER_NAME,
    WORK4YOU_APPS_TOKEN_ENV,
    ConnectorError,
    bootstrap_work4you_apps,
    inject_work4you_apps,
    merge_directory,
    resolve_portal_token,
)
from work4you_cli.connectors_catalog import COMPOSIO_CATALOG, NATIVE_POPULAR
from work4you_cli.mcp_config import _get_mcp_servers, _save_mcp_server
from work4you_constants import get_work4you_home


def _native(name, **kwargs):
    auth = SimpleNamespace(type=kwargs.get("auth_type", "oauth"), env=[])
    transport = SimpleNamespace(
        type="http",
        command=None,
        args=[],
        url=kwargs.get("url", f"https://mcp.example/{name}"),
    )
    return SimpleNamespace(
        name=name,
        description=kwargs.get("description", f"{name} native"),
        auth=auth,
        transport=transport,
        install=None,
    )


class TestMergeDirectory:
    def test_native_name_wins_over_composio_slug(self):
        apps = merge_directory(
            native_entries=[_native("gmail"), _native("notion")],
            native_state={"gmail": (True, True), "notion": (False, False)},
            composio_apps=COMPOSIO_CATALOG,
            portal_ok=True,
        )
        by_id = {row["id"]: row for row in apps}
        assert by_id["gmail"]["source"] == "native"
        assert by_id["gmail"]["connected"] is True
        assert by_id["notion"]["source"] == "native"
        assert by_id["hubspot"]["source"] == "composio"
        assert sum(1 for row in apps if row["id"] == "gmail") == 1

    def test_work4you_apps_is_hidden(self):
        apps = merge_directory(
            native_entries=[_native("work4you_apps"), _native("linear")],
            native_state={},
            composio_apps=[{"slug": "work4you_apps", "name": "Apps", "section": "other"}],
            portal_ok=True,
        )
        assert all(row["id"] != "work4you_apps" for row in apps)
        assert any(row["id"] == "linear" for row in apps)

    def test_no_portal_lists_natives_and_marks_composio_needs_login(self):
        apps = merge_directory(
            native_entries=[_native("notion")],
            native_state={"notion": (False, False)},
            composio_apps=None,
            portal_ok=False,
        )
        by_id = {row["id"]: row for row in apps}
        assert by_id["notion"]["needs_login"] is False
        assert by_id["notion"]["source"] == "native"
        assert by_id["gmail"]["source"] == "composio"
        assert by_id["gmail"]["needs_login"] is True
        assert by_id["gmail"]["connected"] is False
        granola = by_id["granola_mcp"]
        assert granola["name"] == "Granola"
        assert by_id["canva"]["name"] == "Canva"
        assert by_id["canva_mcp"]["name"] == "Canva MCP"
        assert by_id["instagram"]["notes"] == "instagram_business_creator"
        assert by_id["gmail"]["logo"] == "https://logos.composio.dev/api/gmail"
        assert by_id["granola_mcp"]["logo"] == "https://logos.composio.dev/api/granola_mcp"
        assert by_id["notion"].get("logo") in (None, "")

    def test_untrusted_broker_logo_is_replaced_with_cdn(self):
        apps = merge_directory(
            native_entries=[],
            native_state={},
            composio_apps=[
                {
                    "slug": "hubspot",
                    "name": "HubSpot",
                    "section": "crm",
                    "logo": "https://evil.example/x.png",
                }
            ],
            portal_ok=True,
        )
        by_id = {row["id"]: row for row in apps}
        assert by_id["hubspot"]["logo"] == "https://logos.composio.dev/api/hubspot"

    def test_native_popular_pins_applied_at_merge(self):
        apps = merge_directory(
            native_entries=[_native(name) for name in sorted(NATIVE_POPULAR)],
            native_state={},
            composio_apps=[],
            portal_ok=True,
        )
        popular = {row["id"] for row in apps if row["popular"]}
        assert popular == set(NATIVE_POPULAR)


class TestInjectAndBootstrap:
    def test_inject_upserts_without_replacing_other_servers(self, _isolate_work4you_home):
        _save_mcp_server("notion", {"url": "https://mcp.notion.com/mcp", "enabled": True})
        inject_work4you_apps(
            mcp_url="https://connectors-api.work4you.ai/mcp",
            token="w4y-c-testtoken",
        )
        servers = _get_mcp_servers()
        assert "notion" in servers
        assert servers["notion"]["url"] == "https://mcp.notion.com/mcp"
        apps = servers[WORK4YOU_APPS_SERVER_NAME]
        assert apps["url"] == "https://connectors-api.work4you.ai/mcp"
        env_text = (get_work4you_home() / ".env").read_text()
        assert f"{WORK4YOU_APPS_TOKEN_ENV}=w4y-c-testtoken" in env_text
        assert "COMPOSIO_API_KEY" not in env_text
        config_text = (get_work4you_home() / "config.yaml").read_text()
        assert f"Bearer ${{{WORK4YOU_APPS_TOKEN_ENV}}}" in config_text
        assert "COMPOSIO_API_KEY" not in config_text
        assert "w4y-c-testtoken" not in config_text

    def test_inject_refuses_composio_project_key(self, _isolate_work4you_home):
        with pytest.raises(ConnectorError):
            inject_work4you_apps(
                mcp_url="https://connectors-api.work4you.ai/mcp",
                token="ak_composio_project",
            )
        assert WORK4YOU_APPS_SERVER_NAME not in _get_mcp_servers()

    def test_bootstrap_requires_portal(self, _isolate_work4you_home, monkeypatch):
        import work4you_cli.connectors as connectors

        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: None)
        with pytest.raises(ConnectorError) as exc:
            bootstrap_work4you_apps()
        assert exc.value.status == 401

    def test_bootstrap_calls_broker_and_injects(self, _isolate_work4you_home, monkeypatch):
        import work4you_cli.connectors as connectors

        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

        def fake_broker(method, path, **kwargs):
            assert method == "POST"
            assert path == "/v1/bootstrap"
            assert kwargs["token"] == "portal-jwt"
            return {
                "mcp": {
                    "url": "https://connectors-api.work4you.ai/mcp",
                    "token": "w4y-c-from-broker",
                },
                "user_id": "user-sub-1",
            }

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        result = bootstrap_work4you_apps()
        assert result["ok"] is True
        assert result["user_id"] == "user-sub-1"
        servers = _get_mcp_servers()
        assert WORK4YOU_APPS_SERVER_NAME in servers
        env_text = (get_work4you_home() / ".env").read_text()
        assert "w4y-c-from-broker" in env_text

    def test_static_api_keys_are_not_portal_tokens(self, monkeypatch):
        import work4you_cli.auth as auth

        monkeypatch.setattr(auth, "resolve_work4you_access_token", lambda: "sk-work4you-abc")
        assert resolve_portal_token() is None


class TestDirectoryApi:
    @pytest.fixture(autouse=True)
    def _setup(self, _isolate_work4you_home, monkeypatch):
        try:
            from starlette.testclient import TestClient
        except ImportError:
            pytest.skip("fastapi/starlette not installed")

        import work4you_state
        from work4you_constants import get_work4you_home
        from work4you_cli.web_server import app, _SESSION_HEADER_NAME, _SESSION_TOKEN

        work4you_state.DEFAULT_DB_PATH = get_work4you_home() / "state.db"
        import work4you_cli.connectors as connectors

        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: None)
        self.client = TestClient(app)
        self.client.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN

    def test_directory_without_portal_still_lists_natives(self):
        response = self.client.get("/api/connectors/directory")
        assert response.status_code == 200
        data = response.json()
        assert data["portal"] is False
        by_id = {row["id"]: row for row in data["apps"]}
        assert "notion" in by_id
        assert by_id["notion"]["source"] == "native"
        assert by_id["gmail"]["source"] == "composio"
        assert by_id["gmail"]["needs_login"] is True
        assert "work4you_apps" not in by_id
        assert "firecrawl" not in by_id

    def test_bootstrap_without_portal_is_401(self):
        response = self.client.post("/api/connectors/bootstrap")
        assert response.status_code == 401
