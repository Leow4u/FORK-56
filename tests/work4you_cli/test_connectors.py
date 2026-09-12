"""Work4You Apps local control plane — directory merge + hidden MCP inject."""

from types import SimpleNamespace

import pytest

from work4you_cli.connectors import (
    WORK4YOU_APPS_SERVER_NAME,
    WORK4YOU_APPS_TOKEN_ENV,
    ConnectorError,
    bootstrap_work4you_apps,
    disconnect_app,
    inject_work4you_apps,
    maybe_bootstrap_work4you_apps,
    merge_directory,
    resolve_portal_token,
    wait_app,
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
        assert apps["enabled"] is False
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
        assert servers[WORK4YOU_APPS_SERVER_NAME]["enabled"] is False
        assert result["mcp"]["enabled"] is False

    def test_bootstrap_enables_hidden_server_when_an_app_is_connected(
        self, _isolate_work4you_home, monkeypatch
    ):
        import work4you_cli.connectors as connectors

        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

        def fake_broker(method, path, **kwargs):
            assert method == "POST"
            assert path == "/v1/bootstrap"
            return {
                "mcp": {
                    "url": "https://connectors-api.work4you.ai/mcp",
                    "token": "w4y-c-connected",
                },
                "user_id": "user-sub-1",
                "connected": ["gmail"],
            }

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        result = bootstrap_work4you_apps()
        servers = _get_mcp_servers()
        assert servers[WORK4YOU_APPS_SERVER_NAME]["enabled"] is True
        assert result["mcp"]["enabled"] is True
        assert result["connected"] == ["gmail"]

    def test_rebootstrap_preserves_enabled_when_refreshing_token(
        self, _isolate_work4you_home, monkeypatch
    ):
        import work4you_cli.connectors as connectors

        inject_work4you_apps(
            mcp_url="https://connectors-api.work4you.ai/mcp",
            token="w4y-c-old",
            enabled=True,
        )
        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

        def fake_broker(method, path, **kwargs):
            return {
                "mcp": {
                    "url": "https://connectors-api.work4you.ai/mcp",
                    "token": "w4y-c-new",
                },
                "connected": [],
            }

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        bootstrap_work4you_apps()
        servers = _get_mcp_servers()
        assert servers[WORK4YOU_APPS_SERVER_NAME]["enabled"] is True
        env_text = (get_work4you_home() / ".env").read_text()
        assert "w4y-c-new" in env_text

    def test_wait_enables_hidden_server_after_oauth(
        self, _isolate_work4you_home, monkeypatch
    ):
        import work4you_cli.connectors as connectors

        inject_work4you_apps(
            mcp_url="https://connectors-api.work4you.ai/mcp",
            token="w4y-c-wait",
            enabled=False,
        )
        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

        def fake_broker(method, path, **kwargs):
            assert path == "/v1/apps/gmail/wait"
            return {"slug": "gmail", "status": "active", "connected": True}

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        result = wait_app("gmail")
        assert result["connected"] is True
        assert _get_mcp_servers()[WORK4YOU_APPS_SERVER_NAME]["enabled"] is True

    def test_disconnect_last_app_disables_hidden_server(
        self, _isolate_work4you_home, monkeypatch
    ):
        import work4you_cli.connectors as connectors

        inject_work4you_apps(
            mcp_url="https://connectors-api.work4you.ai/mcp",
            token="w4y-c-disc",
            enabled=True,
        )
        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

        def fake_broker(method, path, **kwargs):
            if path == "/v1/apps/gmail/disconnect":
                return {"slug": "gmail", "disconnected": True}
            if path == "/v1/apps":
                return {"apps": [{"slug": "gmail", "status": "disconnected", "connected": False}]}
            raise AssertionError(path)

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        disconnect_app("gmail")
        assert _get_mcp_servers()[WORK4YOU_APPS_SERVER_NAME]["enabled"] is False

    def test_maybe_bootstrap_skip_false_reissues_when_installed(
        self, _isolate_work4you_home, monkeypatch
    ):
        import work4you_cli.connectors as connectors

        inject_work4you_apps(
            mcp_url="https://connectors-api.work4you.ai/mcp",
            token="w4y-c-already",
            enabled=False,
        )
        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")
        called = {"n": 0}

        def fake_broker(method, path, **kwargs):
            called["n"] += 1
            return {
                "mcp": {
                    "url": "https://connectors-api.work4you.ai/mcp",
                    "token": "w4y-c-reissued",
                },
                "connected": [],
            }

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        assert maybe_bootstrap_work4you_apps(skip_if_installed=False) is True
        assert called["n"] == 1
        env_text = (get_work4you_home() / ".env").read_text()
        assert "w4y-c-reissued" in env_text

    def test_maybe_bootstrap_noops_without_portal(self, _isolate_work4you_home, monkeypatch):
        import work4you_cli.connectors as connectors

        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: None)
        called = {"broker": False}

        def fake_broker(*_a, **_k):
            called["broker"] = True
            raise AssertionError("broker must not run without a Portal token")

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        assert maybe_bootstrap_work4you_apps() is False
        assert called["broker"] is False
        assert WORK4YOU_APPS_SERVER_NAME not in _get_mcp_servers()

    def test_maybe_bootstrap_skips_when_already_installed(self, _isolate_work4you_home, monkeypatch):
        import work4you_cli.connectors as connectors

        inject_work4you_apps(
            mcp_url="https://connectors-api.work4you.ai/mcp",
            token="w4y-c-already",
        )
        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

        def fake_broker(*_a, **_k):
            raise AssertionError("already-installed skip must not hit the broker")

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        assert maybe_bootstrap_work4you_apps(skip_if_installed=True) is False

    def test_maybe_bootstrap_swallows_broker_failure(self, _isolate_work4you_home, monkeypatch):
        import work4you_cli.connectors as connectors

        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

        def fake_broker(*_a, **_k):
            raise ConnectorError("connectors broker unreachable", status=502)

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        assert maybe_bootstrap_work4you_apps(skip_if_installed=False) is False
        assert WORK4YOU_APPS_SERVER_NAME not in _get_mcp_servers()

    def test_maybe_bootstrap_injects_when_missing(self, _isolate_work4you_home, monkeypatch):
        import work4you_cli.connectors as connectors

        monkeypatch.setattr(connectors, "resolve_portal_token", lambda: "portal-jwt")

        def fake_broker(method, path, **kwargs):
            assert method == "POST"
            assert path == "/v1/bootstrap"
            return {
                "mcp": {
                    "url": "https://connectors-api.work4you.ai/mcp",
                    "token": "w4y-c-login",
                },
                "user_id": "user-sub-2",
            }

        monkeypatch.setattr(connectors, "broker_request", fake_broker)
        assert maybe_bootstrap_work4you_apps(skip_if_installed=True) is True
        assert WORK4YOU_APPS_SERVER_NAME in _get_mcp_servers()

    def test_apollo_is_on_the_composio_allowlist(self):
        slugs = {app["slug"] for app in COMPOSIO_CATALOG}
        assert "apollo" in slugs

    def test_static_api_keys_are_not_portal_tokens(self, monkeypatch):
        import work4you_cli.auth as auth

        monkeypatch.setattr(auth, "resolve_work4you_access_token", lambda: "sk-work4you-abc")
        assert resolve_portal_token() is None


class TestBrokerProfileHeader:
    def _capture_broker(self, monkeypatch):
        import work4you_cli.connectors as connectors

        captured = {}

        class FakeResp:
            status_code = 200
            content = b'{"ok":true}'

            def json(self):
                return {"ok": True}

        class FakeClient:
            def __init__(self, timeout=None):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def request(self, method, url, headers=None, json=None, params=None):
                captured["headers"] = dict(headers or {})
                captured["url"] = url
                return FakeResp()

        monkeypatch.setattr(connectors.httpx, "Client", FakeClient)
        return captured

    def test_broker_request_sends_default_profile_header(
        self, _isolate_work4you_home, monkeypatch
    ):
        import work4you_cli.connectors as connectors

        captured = self._capture_broker(monkeypatch)
        connectors.broker_request("GET", "/v1/apps", token="portal-jwt")
        assert captured["headers"]["Authorization"] == "Bearer portal-jwt"
        assert captured["headers"][connectors.WORK4YOU_APPS_PROFILE_HEADER] == "default"

    def test_broker_request_sends_named_profile_from_scoped_home(
        self, _isolate_work4you_home, monkeypatch
    ):
        import work4you_cli.connectors as connectors
        from work4you_cli.profiles import create_profile, get_profile_dir
        from work4you_constants import (
            reset_work4you_home_override,
            set_work4you_home_override,
        )

        create_profile("leo", no_alias=True)
        captured = self._capture_broker(monkeypatch)
        token = set_work4you_home_override(str(get_profile_dir("leo")))
        try:
            connectors.broker_request("POST", "/v1/bootstrap", token="portal-jwt")
        finally:
            reset_work4you_home_override(token)
        assert captured["headers"][connectors.WORK4YOU_APPS_PROFILE_HEADER] == "leo"

    def test_broker_request_ignores_sticky_active_profile(
        self, _isolate_work4you_home, monkeypatch
    ):
        import work4you_cli.connectors as connectors
        from work4you_cli.profiles import create_profile, set_active_profile

        create_profile("leo", no_alias=True)
        set_active_profile("leo")
        captured = self._capture_broker(monkeypatch)
        connectors.broker_request("GET", "/v1/apps", token="portal-jwt")
        assert captured["headers"][connectors.WORK4YOU_APPS_PROFILE_HEADER] == "default"

    def test_custom_home_maps_to_default_profile_suffix(self, monkeypatch):
        import work4you_cli.connectors as connectors

        monkeypatch.setattr(
            "work4you_cli.profiles.get_active_profile_name",
            lambda: "custom",
        )
        assert connectors.scoped_apps_profile_name() == "default"


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
