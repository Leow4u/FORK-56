"""Dashboard/desktop chat must keep a scale-to-zero Cloud VM awake only while
someone is actually using it.

Web and desktop chat run in the dashboard's tui_gateway, not in the messaging
gateway that owns the suspend. The bridge is the activity stamp under
WORK4YOU_HOME; these tests drive the real tui_gateway hooks and read the stamp
back through the same helper the gateway's idle predicate uses.
"""

from __future__ import annotations

import os
import time

import pytest

from gateway import scale_to_zero as stz
from tui_gateway import server


@pytest.fixture
def opted_in(monkeypatch):
    monkeypatch.setenv(stz.SCALE_TO_ZERO_ENV, "1")
    monkeypatch.setattr(stz, "_busy_probes", [])
    monkeypatch.setattr(stz, "_last_noted", {})
    monkeypatch.setattr(stz, "_ensure_activity_heartbeat", lambda: None)
    monkeypatch.setattr(server, "_scale_to_zero_probe_registered", False)
    monkeypatch.setattr(server, "_sessions", {})
    monkeypatch.setattr(server, "_live_transports", set())


def _age_stamp(seconds: float) -> None:
    old = time.time() - seconds
    os.utime(stz.activity_stamp_path(), (old, old))


def test_client_connect_stamps_activity(opted_in):
    transport = object()
    server.register_live_transport(transport)
    assert stz.seconds_since_activity() < 5
    server.unregister_live_transport(transport)


def test_idle_open_client_is_not_busy(opted_in):
    transport = object()
    server.register_live_transport(transport)
    server._sessions["s1"] = {"running": False}
    assert stz.dashboard_busy() is False
    server.unregister_live_transport(transport)


def test_running_turn_is_busy(opted_in):
    server._note_scale_to_zero_activity()
    server._sessions["s1"] = {"running": True}
    assert stz.dashboard_busy() is True
    server._sessions["s1"]["running"] = False
    assert stz.dashboard_busy() is False


def test_starting_a_turn_refreshes_a_stale_stamp(opted_in):
    server._note_scale_to_zero_activity()
    _age_stamp(3600)
    stz._last_noted.clear()
    server._start_inflight_turn({}, "hello")
    assert stz.seconds_since_activity() < 5


def test_nothing_is_written_without_opt_in(monkeypatch):
    monkeypatch.delenv(stz.SCALE_TO_ZERO_ENV, raising=False)
    monkeypatch.setattr(stz, "_last_noted", {})
    server._start_inflight_turn({}, "hello")
    assert not stz.activity_stamp_path().exists()
