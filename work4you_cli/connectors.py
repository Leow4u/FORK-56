"""Work4You Apps local control plane.

Talks to the Fly connectors broker with the user's Portal JWT. Injects one
hidden MCP server (``work4you_apps``) whose Bearer token is stored in ``.env``
as ``WORK4YOU_APPS_MCP_TOKEN``. The platform ``COMPOSIO_API_KEY`` never lands
in user config.

Directory merge: native ``optional-mcps/`` catalog + Composio allowlist, one
grid, native name wins on collision. ``work4you_apps`` is hidden from the
directory (it may still appear in the raw MCP JSON editor).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Mapping, Optional

import httpx

from work4you_cli.connectors_catalog import (
    COMPOSIO_CATALOG,
    HIDDEN_DIRECTORY_NAMES,
    NATIVE_POPULAR,
    NATIVE_SECTIONS,
    SECTION_IDS,
    composio_logo_url,
    is_trusted_composio_logo_url,
)
from work4you_cli.mcp_config import _get_mcp_servers, _save_mcp_server
from work4you_cli.config import save_env_value

_log = logging.getLogger(__name__)

DEFAULT_CONNECTORS_API_BASE = "https://connectors-api.work4you.ai"
WORK4YOU_APPS_SERVER_NAME = "work4you_apps"
WORK4YOU_APPS_TOKEN_ENV = "WORK4YOU_APPS_MCP_TOKEN"


class ConnectorError(RuntimeError):
    """Broker or local control-plane failure."""

    def __init__(self, message: str, *, status: int = 502, payload: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.payload = payload


def connectors_api_base() -> str:
    return DEFAULT_CONNECTORS_API_BASE.rstrip("/")


def resolve_portal_token() -> Optional[str]:
    """Return the Portal access token, or None if the user is not logged in."""
    try:
        from work4you_cli.auth import AuthError, resolve_work4you_access_token

        token = resolve_work4you_access_token()
    except AuthError:
        return None
    except Exception:
        _log.debug("Portal token resolve failed", exc_info=True)
        return None
    if not isinstance(token, str):
        return None
    token = token.strip()
    if not token or token.startswith("sk-"):
        # Static API keys must never become Composio user_id.
        return None
    return token


def broker_request(
    method: str,
    path: str,
    *,
    token: str,
    json: Any = None,
    timeout: float = 30.0,
    params: Optional[Mapping[str, Any]] = None,
) -> Any:
    """HTTP call to the connectors broker. Never logs the bearer token."""
    url = f"{connectors_api_base()}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.request(
                method,
                url,
                headers=headers,
                json=json,
                params=dict(params) if params else None,
            )
    except httpx.HTTPError as exc:
        raise ConnectorError(f"connectors broker unreachable: {exc}", status=502) from exc

    if response.status_code >= 400:
        detail: Any
        try:
            detail = response.json()
        except Exception:
            detail = (response.text or "")[:300]
        err = "connectors_broker_error"
        if isinstance(detail, dict) and detail.get("error"):
            err = str(detail.get("error"))
        raise ConnectorError(err, status=response.status_code, payload=detail)

    if response.status_code == 204 or not response.content:
        return {}
    try:
        return response.json()
    except Exception as exc:
        raise ConnectorError("connectors broker returned non-JSON", status=502) from exc


def inject_work4you_apps(*, mcp_url: str, token: str) -> Dict[str, Any]:
    """Upsert the hidden MCP server + env token. Does not replace ``mcp_servers``."""
    if not mcp_url or not token:
        raise ConnectorError("bootstrap missing mcp url or token", status=502)
    if "composio" in token.lower() or token.startswith("ak_"):
        raise ConnectorError("refusing to persist a Composio project key", status=500)
    save_env_value(WORK4YOU_APPS_TOKEN_ENV, token)
    server_config = {
        "url": mcp_url,
        "headers": {"Authorization": f"Bearer ${{{WORK4YOU_APPS_TOKEN_ENV}}}"},
        "enabled": True,
    }
    if not _save_mcp_server(WORK4YOU_APPS_SERVER_NAME, server_config):
        raise ConnectorError("work4you_apps MCP server was rejected", status=400)
    return server_config


def bootstrap_work4you_apps(*, timeout: float = 30.0) -> Dict[str, Any]:
    """Create/reuse the broker session and inject ``work4you_apps`` locally."""
    token = resolve_portal_token()
    if not token:
        raise ConnectorError("portal_login_required", status=401)
    payload = broker_request("POST", "/v1/bootstrap", token=token, timeout=timeout)
    mcp = payload.get("mcp") if isinstance(payload, dict) else None
    if not isinstance(mcp, dict):
        raise ConnectorError("bootstrap missing mcp payload", status=502)
    mcp_url = str(mcp.get("url") or "")
    mcp_token = str(mcp.get("token") or "")
    inject_work4you_apps(mcp_url=mcp_url, token=mcp_token)
    return {
        "ok": True,
        "mcp": {
            "name": WORK4YOU_APPS_SERVER_NAME,
            "url": mcp_url,
            "token_env": WORK4YOU_APPS_TOKEN_ENV,
        },
        "user_id": payload.get("user_id"),
    }


def _native_row(entry: Any, *, installed: bool, enabled: bool) -> Dict[str, Any]:
    name = str(getattr(entry, "name", "") or "")
    auth = getattr(entry, "auth", None)
    auth_type = str(getattr(auth, "type", "none") or "none")
    required_env = [
        {"name": e.name, "prompt": e.prompt, "required": e.required}
        for e in (getattr(auth, "env", None) or [])
    ]
    transport = getattr(entry, "transport", None)
    return {
        "id": name,
        "name": name,
        "description": str(getattr(entry, "description", "") or "").strip(),
        "section": NATIVE_SECTIONS.get(name, "other"),
        "popular": name in NATIVE_POPULAR,
        "source": "native",
        "connected": bool(installed),
        "enabled": bool(enabled),
        "status": "active" if installed else "disconnected",
        "auth_type": auth_type,
        "needs_login": False,
        "notes": None,
        "required_env": required_env,
        "transport": getattr(transport, "type", None),
        "command": getattr(transport, "command", None),
        "args": list(getattr(transport, "args", None) or []),
        "url": getattr(transport, "url", None),
        "needs_install": getattr(entry, "install", None) is not None,
        "installed": bool(installed),
    }


def _composio_row(app: Mapping[str, Any], *, portal_ok: bool) -> Dict[str, Any]:
    slug = str(app.get("slug") or "")
    status = str(app.get("status") or "disconnected").lower()
    connected = bool(app.get("connected")) or status == "active"
    provided = app.get("logo")
    logo = (
        provided
        if isinstance(provided, str) and is_trusted_composio_logo_url(provided)
        else composio_logo_url(slug)
    )
    return {
        "id": slug,
        "name": str(app.get("name") or slug),
        "description": str(app.get("description") or ""),
        "section": str(app.get("section") or "other"),
        "popular": bool(app.get("popular")),
        "source": "composio",
        "connected": connected if portal_ok else False,
        "enabled": connected if portal_ok else False,
        "status": status if portal_ok else "disconnected",
        "auth_type": "oauth",
        "needs_login": not portal_ok,
        "notes": app.get("notes"),
        "required_env": [],
        "installed": connected if portal_ok else False,
        "logo": logo or None,
    }


def merge_directory(
    *,
    native_entries: Iterable[Any],
    native_state: Mapping[str, tuple],
    composio_apps: Optional[Iterable[Mapping[str, Any]]],
    portal_ok: bool,
) -> List[Dict[str, Any]]:
    """One directory: natives + Composio gaps. Native name wins on collision."""
    native_rows: List[Dict[str, Any]] = []
    native_ids = set()
    for entry in native_entries:
        name = str(getattr(entry, "name", "") or "")
        if not name or name in HIDDEN_DIRECTORY_NAMES:
            continue
        installed, enabled = native_state.get(name, (False, False))
        native_rows.append(_native_row(entry, installed=bool(installed), enabled=bool(enabled)))
        native_ids.add(name.lower())

    if composio_apps is None:
        source_apps: Iterable[Mapping[str, Any]] = COMPOSIO_CATALOG
    else:
        source_apps = composio_apps

    composio_rows: List[Dict[str, Any]] = []
    for app in source_apps:
        slug = str(app.get("slug") or "")
        if not slug or slug in HIDDEN_DIRECTORY_NAMES:
            continue
        if slug.lower() in native_ids:
            continue
        composio_rows.append(_composio_row(app, portal_ok=portal_ok))

    return native_rows + composio_rows


def list_directory() -> Dict[str, Any]:
    from work4you_cli import mcp_catalog

    catalog = list(mcp_catalog.list_catalog())
    state = {
        entry.name: (mcp_catalog.is_installed(entry.name), mcp_catalog.is_enabled(entry.name))
        for entry in catalog
    }
    token = resolve_portal_token()
    portal_ok = token is not None
    composio_apps: Optional[List[Mapping[str, Any]]] = None
    if token:
        try:
            payload = broker_request("GET", "/v1/apps", token=token)
            if isinstance(payload, dict) and isinstance(payload.get("apps"), list):
                composio_apps = payload["apps"]
        except ConnectorError:
            _log.warning("connectors broker /v1/apps failed; using static catalog", exc_info=True)
            composio_apps = None
    apps = merge_directory(
        native_entries=catalog,
        native_state=state,
        composio_apps=composio_apps,
        portal_ok=portal_ok,
    )
    return {
        "apps": apps,
        "sections": list(SECTION_IDS),
        "portal": portal_ok,
        "hidden": [WORK4YOU_APPS_SERVER_NAME],
    }


def authorize_app(slug: str, *, callback_url: Optional[str] = None) -> Dict[str, Any]:
    bootstrap_work4you_apps()
    token = resolve_portal_token()
    if not token:
        raise ConnectorError("portal_login_required", status=401)
    body: Dict[str, Any] = {}
    if callback_url:
        body["callback_url"] = callback_url
    return broker_request(
        "POST",
        f"/v1/apps/{slug}/authorize",
        token=token,
        json=body or {},
    )


def wait_app(slug: str, *, timeout_ms: int = 25_000) -> Dict[str, Any]:
    token = resolve_portal_token()
    if not token:
        raise ConnectorError("portal_login_required", status=401)
    timeout_s = max(5.0, min(timeout_ms / 1000.0, 30.0) + 5.0)
    return broker_request(
        "GET",
        f"/v1/apps/{slug}/wait",
        token=token,
        params={"timeout_ms": timeout_ms},
        timeout=timeout_s,
    )


def disconnect_app(slug: str) -> Dict[str, Any]:
    token = resolve_portal_token()
    if not token:
        raise ConnectorError("portal_login_required", status=401)
    return broker_request("POST", f"/v1/apps/{slug}/disconnect", token=token, json={})


def work4you_apps_installed() -> bool:
    return WORK4YOU_APPS_SERVER_NAME in _get_mcp_servers()


def maybe_bootstrap_work4you_apps(*, skip_if_installed: bool = True) -> bool:
    """Best-effort inject of the hidden ``work4you_apps`` MCP server.

    Used on Portal login and MCP discovery so the Work4You Apps session exists
    before the first Capabilities/chat Connect. Never raises: a down broker
    or a missing Portal login is a no-op. Returns True when bootstrap ran.
    """
    try:
        if not resolve_portal_token():
            return False
        if skip_if_installed and work4you_apps_installed():
            return False
        bootstrap_work4you_apps(timeout=8.0)
        return True
    except Exception:
        _log.debug("best-effort work4you_apps bootstrap skipped", exc_info=True)
        return False
