"""GitHub CLI (``gh``) login routes for Capabilities → MCP "GitHub CLI".

State lives in this module (device-flow sessions + status cache). The same
shape as the provider OAuth sessions in ``web_server`` (dict + lock + TTL +
``cancelled`` flag the worker thread observes), kept here so the surface stays
self-contained and testable.

Routes (all under the dashboard auth middleware):

* ``GET    /api/git/gh-auth``                 status (cached 5 min, ``?refresh=true``)
* ``POST   /api/git/gh-auth/login``           start device flow → code + URL
* ``GET    /api/git/gh-auth/login/{sid}``     poll: pending | approved | denied | expired | error
* ``DELETE /api/git/gh-auth/login/{sid}``     cancel
* ``POST   /api/git/gh-auth/logout``          ``gh auth logout``
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import threading
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from work4you_cli import gh_auth as _gh
from work4you_cli.web_deps import late

_log = logging.getLogger("work4you_cli.web_server")

router = APIRouter()

_require_token = late("_require_token")

# ─── status cache ────────────────────────────────────────────────────────────

_GH_AUTH_TTL_S = 300.0
_gh_auth_cache: Optional[tuple] = None  # (monotonic_ts, payload)
_gh_auth_cache_lock = threading.Lock()


def invalidate_status_cache() -> None:
    global _gh_auth_cache
    with _gh_auth_cache_lock:
        _gh_auth_cache = None


# ─── login sessions ──────────────────────────────────────────────────────────

_SESSION_TTL_SECONDS = 15 * 60
_sessions: Dict[str, Dict[str, Any]] = {}
_sessions_lock = threading.Lock()


def _gc_sessions() -> None:
    cutoff = time.time() - _SESSION_TTL_SECONDS
    with _sessions_lock:
        for sid in [s for s, sess in _sessions.items() if sess["created_at"] < cutoff]:
            _sessions.pop(sid, None)


def _public_session(sess: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "session_id": sess["session_id"],
        "status": sess["status"],
        "error_message": sess.get("error_message"),
        "login": sess.get("login"),
        "setup_git": sess.get("setup_git"),
    }


def _login_worker(sess: Dict[str, Any], gh: str) -> None:
    """Poll GitHub, then hand the token to gh. Runs on a daemon thread."""
    sid = sess["session_id"]

    def _cancelled() -> bool:
        return bool(sess.get("cancelled"))

    try:
        status, token, message = _gh.poll_access_token(
            sess["device_code"],
            interval=sess.get("interval") or 5,
            timeout_seconds=sess.get("expires_in") or 900,
            should_stop=_cancelled,
        )
    except Exception as exc:  # pragma: no cover - defensive
        _log.warning("gh device-code poll crashed: %s", exc)
        status, token, message = _gh.ERROR, None, str(exc)

    if _cancelled():
        return

    if status != _gh.APPROVED or not token:
        with _sessions_lock:
            sess["status"] = status
            sess["error_message"] = message
        return

    try:
        result = _gh.complete_login(gh, token)
    except Exception as exc:
        _log.warning("gh login completion failed (%s): %s", sid[:6], exc)
        with _sessions_lock:
            sess["status"] = _gh.ERROR
            sess["error_message"] = str(exc) or "Could not store the GitHub credential in gh"
        return
    finally:
        token = None  # don't keep the secret on the heap longer than needed

    invalidate_status_cache()
    with _sessions_lock:
        sess["status"] = _gh.APPROVED
        sess["login"] = result.get("login")
        sess["setup_git"] = bool(result.get("setup_git"))
        sess["error_message"] = None


# ─── routes ──────────────────────────────────────────────────────────────────


@router.get("/api/git/gh-auth")
async def gh_auth_status_route(refresh: bool = False):
    """Whether the backend host's ``gh`` is installed and logged in.

    ``{"available", "authenticated", "login", "host"}``. Cached five minutes;
    ``refresh=true`` bypasses (the UI uses it right after a login/logout).
    """
    global _gh_auth_cache
    with _gh_auth_cache_lock:
        cached = _gh_auth_cache
    if not refresh and cached and time.monotonic() - cached[0] < _GH_AUTH_TTL_S:
        return cached[1]
    payload = await asyncio.to_thread(_gh.probe_status)
    with _gh_auth_cache_lock:
        _gh_auth_cache = (time.monotonic(), payload)
    return payload


@router.post("/api/git/gh-auth/login")
async def gh_auth_login_start_route(request: Request):
    _require_token(request)
    _gc_sessions()

    gh = await asyncio.to_thread(_gh.find_gh_binary)
    if not gh:
        raise HTTPException(status_code=409, detail="gh_missing")

    try:
        device = await asyncio.to_thread(_gh.request_device_code)
    except Exception as exc:
        _log.warning("gh device-code request failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"GitHub device authorization failed: {exc}")

    sid = secrets.token_urlsafe(16)
    sess: Dict[str, Any] = {
        "session_id": sid,
        "created_at": time.time(),
        "status": _gh.PENDING,
        "error_message": None,
        "login": None,
        "setup_git": None,
        "cancelled": False,
        "device_code": device["device_code"],
        "interval": device.get("interval", 5),
        "expires_in": device.get("expires_in", 900),
    }
    with _sessions_lock:
        _sessions[sid] = sess

    threading.Thread(
        target=_login_worker, args=(sess, gh), daemon=True, name=f"gh-login-{sid[:6]}",
    ).start()

    return {
        "session_id": sid,
        "user_code": device["user_code"],
        "verification_url": device["verification_uri"],
        "expires_in": device.get("expires_in", 900),
        "poll_interval": device.get("interval", 5),
    }


@router.get("/api/git/gh-auth/login/{session_id}")
async def gh_auth_login_poll_route(session_id: str):
    with _sessions_lock:
        sess = _sessions.get(session_id)
        snapshot = _public_session(sess) if sess else None
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Unknown session")
    return snapshot


@router.delete("/api/git/gh-auth/login/{session_id}")
async def gh_auth_login_cancel_route(session_id: str, request: Request):
    _require_token(request)
    with _sessions_lock:
        sess = _sessions.get(session_id)
        if sess is not None:
            # Flag the shared dict first: the worker holds its own reference
            # and only sees cancellation through that object.
            sess["cancelled"] = True
            _sessions.pop(session_id, None)
    return {"ok": True, "session_id": session_id}


@router.post("/api/git/gh-auth/logout")
async def gh_auth_logout_route(request: Request):
    _require_token(request)
    gh = await asyncio.to_thread(_gh.find_gh_binary)
    if not gh:
        raise HTTPException(status_code=409, detail="gh_missing")
    ok = await asyncio.to_thread(_gh.logout, gh)
    invalidate_status_cache()
    return {"ok": bool(ok)}
