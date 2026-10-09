"""Route tests for /api/git/gh-auth* (GitHub CLI connector).

gh and GitHub are never touched: ``work4you_cli.gh_auth`` functions are
monkeypatched on the router's module reference.
"""

from __future__ import annotations

import threading
import time

import pytest

from work4you_cli import web_server
from work4you_cli.web_routers import gh_auth as routes

pytest.importorskip("starlette.testclient")
from starlette.testclient import TestClient


@pytest.fixture
def client():
    previous = getattr(web_server.app.state, "auth_required", None)
    web_server.app.state.auth_required = False
    test_client = TestClient(web_server.app)
    test_client.headers[web_server._SESSION_HEADER_NAME] = web_server._SESSION_TOKEN
    try:
        yield test_client
    finally:
        if previous is None:
            try:
                delattr(web_server.app.state, "auth_required")
            except AttributeError:
                pass
        else:
            web_server.app.state.auth_required = previous


@pytest.fixture(autouse=True)
def _clean_state():
    routes.invalidate_status_cache()
    with routes._sessions_lock:
        routes._sessions.clear()
    yield
    routes.invalidate_status_cache()
    with routes._sessions_lock:
        routes._sessions.clear()


def _no_thread(monkeypatch):
    """Keep the worker inert so tests drive session state by hand.

    (Patching ``threading.Thread`` itself would also break the executor
    behind ``asyncio.to_thread`` and hang the route.)
    """
    monkeypatch.setattr(routes, "_login_worker", lambda sess, gh: None)


# ─── status ──────────────────────────────────────────────────────────────────


def test_status_reports_probe_and_caches(client, monkeypatch):
    probes = []

    def _probe():
        probes.append(1)
        return {"available": True, "authenticated": True, "login": "octocat", "host": "github.com"}

    monkeypatch.setattr(routes._gh, "probe_status", _probe)

    first = client.get("/api/git/gh-auth")
    second = client.get("/api/git/gh-auth")
    assert first.status_code == 200
    assert first.json()["login"] == "octocat"
    assert second.json() == first.json()
    assert len(probes) == 1  # cached

    client.get("/api/git/gh-auth?refresh=true")
    assert len(probes) == 2


def test_status_requires_session_token(monkeypatch):
    monkeypatch.setattr(routes._gh, "probe_status", lambda: {"available": False})
    previous = getattr(web_server.app.state, "auth_required", None)
    web_server.app.state.auth_required = False
    try:
        anon = TestClient(web_server.app)
        assert anon.get("/api/git/gh-auth").status_code in (401, 403)
    finally:
        if previous is None:
            delattr(web_server.app.state, "auth_required")
        else:
            web_server.app.state.auth_required = previous


# ─── login start ─────────────────────────────────────────────────────────────


def test_login_start_409_when_gh_missing(client, monkeypatch):
    monkeypatch.setattr(routes._gh, "find_gh_binary", lambda: None)
    resp = client.post("/api/git/gh-auth/login")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "gh_missing"


def test_login_start_returns_code_and_registers_session(client, monkeypatch):
    _no_thread(monkeypatch)
    monkeypatch.setattr(routes._gh, "find_gh_binary", lambda: "/bin/gh")
    monkeypatch.setattr(routes._gh, "request_device_code", lambda: {
        "device_code": "dev", "user_code": "WXYZ-9876",
        "verification_uri": "https://github.com/login/device", "expires_in": 899, "interval": 5,
    })

    resp = client.post("/api/git/gh-auth/login")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_code"] == "WXYZ-9876"
    assert body["verification_url"] == "https://github.com/login/device"
    assert body["poll_interval"] == 5
    sid = body["session_id"]
    assert routes._sessions[sid]["status"] == "pending"
    assert "device_code" not in resp.text  # secret never leaves the backend

    poll = client.get(f"/api/git/gh-auth/login/{sid}")
    assert poll.status_code == 200
    assert poll.json() == {
        "session_id": sid, "status": "pending", "error_message": None, "login": None, "setup_git": None,
    }


def test_login_start_502_when_github_rejects(client, monkeypatch):
    monkeypatch.setattr(routes._gh, "find_gh_binary", lambda: "/bin/gh")

    def _boom():
        raise RuntimeError("rate limited")

    monkeypatch.setattr(routes._gh, "request_device_code", _boom)
    resp = client.post("/api/git/gh-auth/login")
    assert resp.status_code == 502
    assert "rate limited" in resp.json()["detail"]


def test_poll_unknown_session_404(client):
    assert client.get("/api/git/gh-auth/login/nope").status_code == 404


# ─── worker ──────────────────────────────────────────────────────────────────


def _session(sid="s1", **extra):
    sess = {
        "session_id": sid, "created_at": time.time(), "status": "pending", "error_message": None,
        "login": None, "setup_git": None, "cancelled": False, "device_code": "dev",
        "interval": 1, "expires_in": 60,
    }
    sess.update(extra)
    with routes._sessions_lock:
        routes._sessions[sid] = sess
    return sess


def test_worker_approved_stores_token_and_invalidates_cache(client, monkeypatch):
    monkeypatch.setattr(routes._gh, "probe_status", lambda: {"available": True, "authenticated": False, "login": None, "host": "github.com"})
    assert client.get("/api/git/gh-auth").json()["authenticated"] is False  # primes cache

    completed = []
    monkeypatch.setattr(routes._gh, "poll_access_token", lambda *a, **kw: ("approved", "gho_secret", None))
    monkeypatch.setattr(routes._gh, "complete_login", lambda gh, token: completed.append((gh, token)) or {"login": "octocat", "setup_git": True})
    sess = _session()

    routes._login_worker(sess, "/bin/gh")

    assert completed == [("/bin/gh", "gho_secret")]
    assert client.get("/api/git/gh-auth/login/s1").json() == {
        "session_id": "s1", "status": "approved", "error_message": None, "login": "octocat", "setup_git": True,
    }
    monkeypatch.setattr(routes._gh, "probe_status", lambda: {"available": True, "authenticated": True, "login": "octocat", "host": "github.com"})
    assert client.get("/api/git/gh-auth").json()["authenticated"] is True  # cache was dropped


def test_worker_reports_denied(client, monkeypatch):
    monkeypatch.setattr(routes._gh, "poll_access_token", lambda *a, **kw: ("denied", None, "Authorization was denied"))
    sess = _session()
    routes._login_worker(sess, "/bin/gh")
    body = client.get("/api/git/gh-auth/login/s1").json()
    assert body["status"] == "denied"
    assert body["error_message"] == "Authorization was denied"


def test_worker_reports_error_when_gh_store_fails(client, monkeypatch):
    monkeypatch.setattr(routes._gh, "poll_access_token", lambda *a, **kw: ("approved", "gho", None))

    def _fail(gh, token):
        raise RuntimeError("keyring unavailable")

    monkeypatch.setattr(routes._gh, "complete_login", _fail)
    sess = _session()
    routes._login_worker(sess, "/bin/gh")
    body = client.get("/api/git/gh-auth/login/s1").json()
    assert body["status"] == "error"
    assert "keyring" in body["error_message"]


def test_worker_passes_cancel_flag_to_poller(monkeypatch):
    seen = {}

    def _poll(device_code, **kw):
        seen["should_stop"] = kw["should_stop"]
        return ("error", None, "cancelled")

    monkeypatch.setattr(routes._gh, "poll_access_token", _poll)
    sess = _session()
    sess["cancelled"] = True
    routes._login_worker(sess, "/bin/gh")
    assert seen["should_stop"]() is True
    assert sess["status"] == "pending"  # cancelled sessions are left untouched


# ─── cancel ──────────────────────────────────────────────────────────────────


def test_cancel_marks_shared_dict_before_popping(client):
    sess = _session("cancel-me")
    worker_ref = routes._sessions["cancel-me"]

    resp = client.delete("/api/git/gh-auth/login/cancel-me")

    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "session_id": "cancel-me"}
    assert "cancel-me" not in routes._sessions
    assert worker_ref["cancelled"] is True
    assert sess is worker_ref


def test_cancel_unknown_session_is_noop(client):
    assert client.delete("/api/git/gh-auth/login/ghost").json() == {"ok": True, "session_id": "ghost"}


# ─── logout ──────────────────────────────────────────────────────────────────


def test_logout_runs_gh_and_drops_cache(client, monkeypatch):
    monkeypatch.setattr(routes._gh, "probe_status", lambda: {"available": True, "authenticated": True, "login": "octocat", "host": "github.com"})
    client.get("/api/git/gh-auth")
    monkeypatch.setattr(routes._gh, "find_gh_binary", lambda: "/bin/gh")
    calls = []
    monkeypatch.setattr(routes._gh, "logout", lambda gh: calls.append(gh) or True)

    resp = client.post("/api/git/gh-auth/logout")

    assert resp.json() == {"ok": True}
    assert calls == ["/bin/gh"]
    monkeypatch.setattr(routes._gh, "probe_status", lambda: {"available": True, "authenticated": False, "login": None, "host": "github.com"})
    assert client.get("/api/git/gh-auth").json()["authenticated"] is False


def test_logout_409_when_gh_missing(client, monkeypatch):
    monkeypatch.setattr(routes._gh, "find_gh_binary", lambda: None)
    assert client.post("/api/git/gh-auth/logout").status_code == 409


def test_session_gc_drops_expired(monkeypatch):
    _session("old", created_at=time.time() - routes._SESSION_TTL_SECONDS - 5)
    _session("fresh")
    routes._gc_sessions()
    assert "old" not in routes._sessions
    assert "fresh" in routes._sessions
