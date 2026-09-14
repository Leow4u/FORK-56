"""Dashboard routes for the Work4You Apps store (Composio-backed connectors).

Native MCP install/OAuth stays on ``/api/mcp/*``. These routes only proxy the
Fly broker and merge the directory. ``work4you_apps`` is injected with
``_save_mcp_server`` (upsert), never a full ``mcp_servers`` replace.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from work4you_cli.web_deps import late, LateState

_log = logging.getLogger("work4you_cli.web_server")

router = APIRouter()

_profile_scope = late("_profile_scope")
_CONFIG_MUTATION_LOCK = LateState("_CONFIG_MUTATION_LOCK")


class ConnectorAuthorizeBody(BaseModel):
    profile: Optional[str] = None
    callback_url: Optional[str] = None


class ConnectorProfileBody(BaseModel):
    profile: Optional[str] = None


def _raise_connector(exc: Exception) -> None:
    from work4you_cli.connectors import ConnectorError

    if isinstance(exc, ConnectorError):
        detail: Any = exc.payload if exc.payload is not None else str(exc)
        raise HTTPException(status_code=int(exc.status), detail=detail) from exc
    raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/connectors/bootstrap")
async def bootstrap_connectors(body: Optional[ConnectorProfileBody] = None, profile: Optional[str] = None):
    from work4you_cli.connectors import bootstrap_work4you_apps

    payload = body or ConnectorProfileBody()

    def _run():
        with _profile_scope(payload.profile or profile):
            with _CONFIG_MUTATION_LOCK:
                return bootstrap_work4you_apps()

    try:
        return await asyncio.to_thread(_run)
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("POST /api/connectors/bootstrap failed")
        _raise_connector(exc)


@router.get("/api/connectors/directory")
async def connectors_directory(profile: Optional[str] = None):
    from work4you_cli.connectors import list_directory

    def _run():
        with _profile_scope(profile):
            return list_directory()

    try:
        return await asyncio.to_thread(_run)
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("GET /api/connectors/directory failed")
        _raise_connector(exc)


@router.post("/api/connectors/apps/{slug}/authorize")
async def authorize_connector(
    slug: str,
    body: Optional[ConnectorAuthorizeBody] = None,
    profile: Optional[str] = None,
):
    from work4you_cli.connectors import authorize_app

    payload = body or ConnectorAuthorizeBody()

    def _run():
        with _profile_scope(payload.profile or profile):
            with _CONFIG_MUTATION_LOCK:
                return authorize_app(slug, callback_url=payload.callback_url)

    try:
        return await asyncio.to_thread(_run)
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("POST /api/connectors/apps/%s/authorize failed", slug)
        _raise_connector(exc)


@router.get("/api/connectors/apps/{slug}/wait")
async def wait_connector(slug: str, timeout_ms: int = 25_000, profile: Optional[str] = None):
    from work4you_cli.connectors import wait_app

    def _run():
        with _profile_scope(profile):
            return wait_app(slug, timeout_ms=timeout_ms)

    try:
        return await asyncio.to_thread(_run)
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("GET /api/connectors/apps/%s/wait failed", slug)
        _raise_connector(exc)


@router.post("/api/connectors/apps/{slug}/disconnect")
async def disconnect_connector(
    slug: str,
    body: Optional[ConnectorProfileBody] = None,
    profile: Optional[str] = None,
):
    from work4you_cli.connectors import disconnect_app

    payload = body or ConnectorProfileBody()

    def _run():
        with _profile_scope(payload.profile or profile):
            return disconnect_app(slug)

    try:
        return await asyncio.to_thread(_run)
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("POST /api/connectors/apps/%s/disconnect failed", slug)
        _raise_connector(exc)
