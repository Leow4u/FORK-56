"""Watcher-level tests for scale-to-zero: the idle watcher's dormant sequence and
the arm-gate wiring, exercised against the real GatewayRunner methods bound onto
a lightweight stand-in (booting a full gateway is unnecessary for this logic and
would be slow/flaky).

These cover the parts gateway/test_scale_to_zero.py (pure helpers) can't: that
the watcher calls the relay adapter's go_dormant() exactly when idle+armed,
respects the cooldown, and skips when busy — the F7/D3 + D12 behaviour.
"""

from __future__ import annotations

import asyncio
import time

import pytest

from gateway.run import GatewayRunner


class _FakeRelayAdapter:
    def __init__(self):
        self.go_dormant_calls = 0

    async def go_dormant(self):
        self.go_dormant_calls += 1
        return True


def _runner_with(monkeypatch, *, idle, armed_adapter=True):
    """Build a GatewayRunner without booting it, stubbing just what the watcher
    touches. Real methods (_scale_to_zero_is_idle composition, the watcher body)
    run; only their dependencies are stubbed."""
    r = GatewayRunner.__new__(GatewayRunner)
    r._running = True
    r._scale_to_zero_cooldown_until = 0.0
    r._last_inbound_at = time.time()
    r._running_agents = {}
    r._background_tasks = set()
    adapter = _FakeRelayAdapter() if armed_adapter else None

    monkeypatch.setattr(r, "_scale_to_zero_is_idle", lambda: idle, raising=False)
    monkeypatch.setattr(r, "_relay_adapter_for_dormancy", lambda: adapter, raising=False)
    monkeypatch.setattr(r, "_scale_to_zero_idle_timeout_seconds", lambda: 300.0, raising=False)
    monkeypatch.setattr(r, "_update_runtime_status", lambda *a, **k: None, raising=False)
    return r, adapter


@pytest.mark.asyncio
async def test_watcher_goes_dormant_when_idle(monkeypatch):
    r, adapter = _runner_with(monkeypatch, idle=True)
    # Run one iteration: stop after the first sleep so the loop exits cleanly.
    task = asyncio.create_task(r._scale_to_zero_watcher(interval=0.01))
    await asyncio.sleep(0.1)
    r._running = False
    await asyncio.wait_for(task, timeout=2)
    assert adapter.go_dormant_calls >= 1
    # After driving dormant, a re-arm cooldown is set (0.F).
    assert r._scale_to_zero_cooldown_until > time.time()


    # No exception, loop exits cleanly — nothing to assert beyond survival.


def test_bg_work_blocks_idle_via_background_tasks(monkeypatch):
    """_scale_to_zero_has_live_background_work() reports True when a tracked
    background task is still live (D3/F7) — the guard that keeps a gateway with
    an in-flight backgrounded subagent/terminal awake."""
    r = GatewayRunner.__new__(GatewayRunner)

    async def _never():
        await asyncio.sleep(0.2)

    loop = asyncio.new_event_loop()
    try:
        t = loop.create_task(_never())
        r._background_tasks = {t}
        # process_registry has nothing active in this fresh process.
        assert r._scale_to_zero_has_live_background_work() is True
        t.cancel()
    finally:
        loop.run_until_complete(asyncio.gather(t, return_exceptions=True))
        loop.close()


def test_real_inbound_after_dormancy_restores_running_status(monkeypatch):
    """Once a dormant gateway receives real inbound after wake, the runtime
    lifecycle must not remain stuck in the watcher-written `draining` state."""
    r = GatewayRunner.__new__(GatewayRunner)
    r._last_inbound_at = 0.0
    r._scale_to_zero_cooldown_until = time.time() + 60.0
    status_updates = []
    monkeypatch.setattr(
        r,
        "_update_runtime_status",
        lambda state=None, *a, **k: status_updates.append(state),
        raising=False,
    )

    r._scale_to_zero_note_real_inbound()

    assert r._last_inbound_at > 0.0
    assert status_updates == ["running"]


# ── arm gate: opt-in flag + wake URL only ────────────────────────────────────
#
# Arming used to also require relay-only messaging, decided once at startup from
# the ENABLED platforms. An enabled WhatsApp bridge that never paired therefore
# kept a paid Cloud VM on 24/7 ("NOT armed ... enabled platforms=['whatsapp']" on
# every boot). Platforms are now checked on every idle tick, from what is
# actually connected (see the next section).


def _arm_runner(monkeypatch, *, enabled=True, wake_url="https://wake.example"):
    from types import SimpleNamespace

    from gateway.config import PlatformConfig
    from gateway.platforms.base import Platform

    r = GatewayRunner.__new__(GatewayRunner)
    r.config = SimpleNamespace(platforms={Platform.WHATSAPP: PlatformConfig(enabled=True)})
    monkeypatch.setattr("gateway.scale_to_zero.scale_to_zero_enabled", lambda *a, **k: enabled)
    monkeypatch.setattr("gateway.relay.relay_wake_url", lambda: wake_url)
    return r


def test_arm_with_an_enabled_direct_platform(monkeypatch):
    assert _arm_runner(monkeypatch)._scale_to_zero_should_arm() is True


def test_no_arm_without_wake_url_or_opt_in(monkeypatch):
    assert _arm_runner(monkeypatch, wake_url=None)._scale_to_zero_should_arm() is False
    assert _arm_runner(monkeypatch, enabled=False)._scale_to_zero_should_arm() is False


# ── idle predicate on a real runner stand-in ─────────────────────────────────
#
# These run the REAL _scale_to_zero_is_idle composition. Only the gateway's
# inbound clock and its platform maps are set; config, cron store and the
# dashboard activity stamp come from the isolated WORK4YOU_HOME.


def _idle_runner(*, adapters=(), failed=None, inbound_age=3600.0):
    r = GatewayRunner.__new__(GatewayRunner)
    r._running = True
    r._running_agents = {}
    r._background_tasks = set()
    r._last_inbound_at = time.time() - inbound_age
    r.adapters = {p: object() for p in adapters}
    r._failed_platforms = dict(failed or {})
    return r


def test_idle_with_no_messaging_and_no_activity():
    assert _idle_runner()._scale_to_zero_is_idle() is True


def test_connected_relay_and_non_messaging_surfaces_do_not_hold_awake():
    from gateway.platforms.base import Platform

    r = _idle_runner(
        adapters=(Platform.RELAY, Platform.API_SERVER, Platform.WEBHOOK, Platform.LOCAL)
    )
    assert r._scale_to_zero_is_idle() is True


def test_connected_direct_platform_holds_awake():
    from gateway.platforms.base import Platform

    r = _idle_runner(adapters=(Platform.DISCORD, Platform.API_SERVER))
    assert r._scale_to_zero_is_idle() is False


def test_platform_retrying_a_blip_holds_awake():
    from gateway.platforms.base import Platform

    r = _idle_runner(failed={Platform.WHATSAPP: {"attempts": 2}})
    assert r._scale_to_zero_is_idle() is False


def test_platform_flagged_needs_attention_or_paused_does_not_hold_awake():
    from gateway.platforms.base import Platform

    for info in ({"attempts": 40, "attention_flagged": True}, {"paused": True}):
        r = _idle_runner(failed={Platform.WHATSAPP: info})
        assert r._scale_to_zero_is_idle() is True, info


def test_recent_dashboard_activity_keeps_it_awake(monkeypatch):
    from gateway import scale_to_zero

    monkeypatch.setenv(scale_to_zero.SCALE_TO_ZERO_ENV, "1")
    scale_to_zero.note_activity()
    assert _idle_runner()._scale_to_zero_is_idle() is False


def test_stale_dashboard_activity_does_not(monkeypatch):
    import os

    from gateway import scale_to_zero

    monkeypatch.setenv(scale_to_zero.SCALE_TO_ZERO_ENV, "1")
    scale_to_zero.note_activity()
    stamp = scale_to_zero.activity_stamp_path()
    old = time.time() - 3600
    os.utime(stamp, (old, old))
    assert _idle_runner()._scale_to_zero_is_idle() is True


def test_enabled_cron_job_keeps_it_awake():
    from cron.jobs import create_job, pause_job

    job = create_job(prompt="daily digest", schedule="every 1d")
    assert _idle_runner()._scale_to_zero_is_idle() is False
    pause_job(job["id"])
    assert _idle_runner()._scale_to_zero_is_idle() is True


def test_running_cron_job_counts_as_active_work(monkeypatch):
    monkeypatch.setattr("cron.scheduler.get_running_job_ids", lambda: {"job-1"})
    assert _idle_runner()._scale_to_zero_is_idle() is False


# ── the self-suspend step: fires only after a clean quiesce, in order ─────────
#
# The gateway owns the suspend (Fly Proxy autostop is inbound-only/job-blind and
# no longer held open by outbound sockets), so the watcher must (a) suspend only
# AFTER go_dormant succeeded — the relay flip precedes the freeze, closing the
# buffered-event black hole — and (b) never suspend when the quiesce failed or
# inbound landed mid-quiesce.


@pytest.mark.asyncio
async def test_watcher_suspends_without_relay_when_idle(monkeypatch):
    """A paid Cloud VM with no messaging relay still sleeps when idle.

    There is no relay socket to flip. The next dashboard request is the wake.
    """
    r, adapter = _runner_with(monkeypatch, idle=True, armed_adapter=False)
    assert adapter is None
    calls = []

    async def fake_suspend():
        calls.append("suspend")
        r._running = False

    monkeypatch.setattr(r, "_scale_to_zero_self_suspend", fake_suspend, raising=False)
    task = asyncio.create_task(r._scale_to_zero_watcher(interval=0.01))
    await asyncio.wait_for(task, timeout=2)
    assert calls == ["suspend"]
    assert r._scale_to_zero_cooldown_until > time.time()


@pytest.mark.asyncio
async def test_watcher_self_suspends_after_dormant(monkeypatch):
    r, adapter = _runner_with(monkeypatch, idle=True)
    calls = []

    async def fake_suspend():
        calls.append(("suspend", adapter.go_dormant_calls))
        r._running = False  # stop the loop after the first full sequence

    monkeypatch.setattr(r, "_scale_to_zero_self_suspend", fake_suspend, raising=False)
    task = asyncio.create_task(r._scale_to_zero_watcher(interval=0.01))
    await asyncio.wait_for(task, timeout=2)
    # Suspend fired exactly once, and only AFTER go_dormant ran (flip-before-freeze).
    assert calls == [("suspend", 1)]


@pytest.mark.asyncio
async def test_watcher_skips_suspend_when_dormant_fails(monkeypatch):
    r, adapter = _runner_with(monkeypatch, idle=True)

    async def broken_dormant():
        raise RuntimeError("quiesce failed")

    adapter.go_dormant = broken_dormant
    suspend_calls = []

    async def fake_suspend():
        suspend_calls.append(1)

    monkeypatch.setattr(r, "_scale_to_zero_self_suspend", fake_suspend, raising=False)
    task = asyncio.create_task(r._scale_to_zero_watcher(interval=0.01))
    await asyncio.sleep(0.1)
    r._running = False
    await asyncio.wait_for(task, timeout=2)
    # A failed quiesce means an UNFLIPPED relay — suspending would black-hole
    # inbound events. Must stay awake.
    assert suspend_calls == []


@pytest.mark.asyncio
async def test_watcher_skips_suspend_when_inbound_lands_mid_quiesce(monkeypatch):
    r, adapter = _runner_with(monkeypatch, idle=True)
    # First idle check (loop gate) True, second (post-quiesce re-check) False.
    reads = iter([True, False, False, False, False, False])
    monkeypatch.setattr(
        r, "_scale_to_zero_is_idle", lambda: next(reads, False), raising=False
    )
    suspend_calls = []

    async def fake_suspend():
        suspend_calls.append(1)

    monkeypatch.setattr(r, "_scale_to_zero_self_suspend", fake_suspend, raising=False)
    task = asyncio.create_task(r._scale_to_zero_watcher(interval=0.01))
    await asyncio.sleep(0.15)
    r._running = False
    await asyncio.wait_for(task, timeout=2)
    assert adapter.go_dormant_calls == 1
    assert suspend_calls == []


@pytest.mark.asyncio
async def test_self_suspend_noop_off_fly(monkeypatch):
    """Off-Fly (no flaps socket/identity) the helper is a silent no-op —
    dormancy without platform suspend, never an error."""
    r = GatewayRunner.__new__(GatewayRunner)
    monkeypatch.setattr(
        "gateway.scale_to_zero.self_suspend_available", lambda *a, **k: False
    )
    called = []
    monkeypatch.setattr(
        "gateway.scale_to_zero.suspend_self",
        lambda *a, **k: called.append(1) or True,
    )
    await r._scale_to_zero_self_suspend()
    assert called == []


# ── supervised watchers must NOT count as live background work (staging bug) ──
#
# _spawn_supervised parks every permanent watcher task (session-expiry, kanban,
# reconnect, the scale-to-zero watcher ITSELF, ...) in _background_tasks. The
# bg-work check counted them, so an armed gateway considered itself busy
# forever and never went dormant — verified live on staging 2026-08-12 (armed
# at 05:25, fully idle 25+ min, zero "going dormant" lines). Fly's coarse
# autostop masked this until the gateway took ownership of the suspend.
# These tests exercise the REAL _spawn_supervised path — the earlier tests
# stubbed _background_tasks and missed the call site (same trap as F25).


@pytest.mark.asyncio
async def test_supervised_watchers_do_not_block_idle():
    r = GatewayRunner.__new__(GatewayRunner)
    r._running = True
    r._background_tasks = set()

    async def _forever():
        await asyncio.sleep(3600)

    # Spawn like production does — through _spawn_supervised.
    for name in ("session_expiry", "kanban", "scale_to_zero_watcher"):
        r._spawn_supervised(lambda: _forever(), name)
    await asyncio.sleep(0)  # let tasks start
    try:
        assert r._scale_to_zero_has_live_background_work() is False
    finally:
        for t in r._background_tasks:
            t.cancel()
        await asyncio.gather(*r._background_tasks, return_exceptions=True)


@pytest.mark.asyncio
async def test_transient_background_task_still_blocks_idle():
    """A plain (untagged) task in _background_tasks — startup-resume events,
    ad-hoc work — must still count as live background work."""
    r = GatewayRunner.__new__(GatewayRunner)
    r._running = True

    async def _work():
        await asyncio.sleep(3600)

    t = asyncio.create_task(_work())
    r._background_tasks = {t}
    try:
        assert r._scale_to_zero_has_live_background_work() is True
    finally:
        t.cancel()
        await asyncio.gather(t, return_exceptions=True)


@pytest.mark.asyncio
async def test_done_supervised_watcher_is_ignored_either_way():
    r = GatewayRunner.__new__(GatewayRunner)
    r._running = True

    async def _quick():
        return None

    t = asyncio.create_task(_quick())
    await t
    r._background_tasks = {t}
    assert r._scale_to_zero_has_live_background_work() is False


@pytest.mark.asyncio
async def test_resume_from_suspend_restarts_the_idle_window(monkeypatch):
    """A tick that lands long after its interval means the machine was suspended
    and a request woke it. That tick must not re-suspend; the next idle one may."""
    r, _ = _runner_with(monkeypatch, idle=True, armed_adapter=False)
    r._last_inbound_at = 0.0
    # Elapsed wall-clock per sleep: startup settle, one normal tick, then a
    # 1h jump (suspended), then normal ticks again.
    steps = iter([30.0, 30.0, 3600.0, 30.0, 30.0])
    clock = {"now": 1_000_000.0, "sleeps": 0}
    suspended_on = []
    real_sleep = asyncio.sleep

    async def fake_sleep(_seconds):
        clock["now"] += next(steps)
        clock["sleeps"] += 1
        await real_sleep(0)

    async def fake_suspend():
        suspended_on.append(clock["sleeps"])
        r._scale_to_zero_cooldown_until = 0.0
        if len(suspended_on) == 2:
            r._running = False

    monkeypatch.setattr("gateway.run.time.time", lambda: clock["now"])
    monkeypatch.setattr("gateway.run.asyncio.sleep", fake_sleep)
    monkeypatch.setattr(r, "_scale_to_zero_self_suspend", fake_suspend, raising=False)
    await asyncio.wait_for(r._scale_to_zero_watcher(interval=30.0), timeout=2)

    # sleep #2 is the first normal tick (suspend), #3 is the wake (skip), #4 suspends.
    assert suspended_on == [2, 4]
    assert r._last_inbound_at == 1_000_000.0 + 30.0 + 30.0 + 3600.0
