"""Scale-to-zero idle detection + dormant-quiesce for the gateway (Phase 0).

This is the gateway-side BEHAVIOUR layer that consumes the relay scale-to-zero
PRIMITIVES (gateway-gateway Phase 5: the buffered-flip, the durable per-instance
buffer, the wakeUrl poke, the reconnect supervisor). It owns the *decision* to go
idle, drives the relay transport's ``go_dormant()`` (D12), and then SUSPENDS the
machine itself through the local Fly Machines API socket. Wake stays platform-side:
autostart-on-wakeUrl (decisions.md Q3=C′).

Why the gateway self-suspends instead of relying on ``autostop:"suspend"``: Fly
Proxy judges idle exclusively on INBOUND proxied connections — it cannot see an
in-flight agent turn (outbound-only LLM traffic) and there is no way for the app
to signal "not ready to suspend". Mid-2026 the proxy also stopped treating open
OUTBOUND sockets as activity, so the relay WebSocket no longer masks the race:
Fly would suspend a machine mid-job, and could suspend BEFORE ``go_dormant()``
flipped the relay destination (the buffered-event black hole). Owning the suspend
call closes both: it only ever fires after the idle predicate (no running agents,
no live background work, inbound-quiet) holds AND the dormant quiesce completed.

Design constraints (decisions.md):
  - Per-instance enable is gated SOLELY by the NAS "Labs" toggle, carried to the
    gateway as the ``WORK4YOU_SCALE_TO_ZERO`` env stamp (D11/Q8=A). NOT a user
    config key; ``scale_to_zero.idle_timeout_minutes`` IS config.yaml (D2).
  - Arm when a wakeUrl is registered (§3.4(1)) AND the flag is set.
  - A direct messaging platform (D1/F6) holds the machine awake while it is
    connected or retrying a blip. One that has failed long enough to be flagged
    NEEDS_ATTENTION, or is paused, holds no socket and no longer does.
  - Idle = no in-flight agent turn AND no inbound for N min AND no live
    background work AND no enabled cron job (D2/D3/F7). Inbound includes the
    dashboard activity stamp: web/TUI chat runs in the dashboard process, which
    the gateway cannot see.
  - The quiesce uses ``go_dormant()`` (socket closed + supervisor preserved),
    NEVER the stop/restart drain or ``disconnect()`` (F12/F14). The process stays
    alive; Fly freezes+resumes it.
  - ``mark_resume_pending`` is deliberately NOT called here (D13 — suspend
    preserves RAM; revive only if we move to autostop:"stop" or see kills).

The pure helpers (``parse_idle_timeout_seconds``, ``scale_to_zero_enabled``,
``messaging_is_relay_only_or_absent``, ``is_idle``, ``should_arm``) take plain
inputs so they unit-test without a live gateway.
"""

from __future__ import annotations

import json
import logging
import os
import socket
import threading
import time
from pathlib import Path
from typing import Any, Callable, Iterable, Optional

logger = logging.getLogger(__name__)

# Env flag stamped by NAS when the scaleToZero Labs toggle is on (D11/Q8=A),
# mirroring how the `relay` feature stamps GATEWAY_RELAY_URL. Truthy values only.
SCALE_TO_ZERO_ENV = "WORK4YOU_SCALE_TO_ZERO"

# Fly-injected machine identity (present on every Fly machine). Used by the
# self-suspend call; both must be present for self_suspend_available().
FLY_APP_NAME_ENV = "FLY_APP_NAME"
FLY_MACHINE_ID_ENV = "FLY_MACHINE_ID"

# The local flaps (Fly Machines API) unix socket, available inside every Fly
# machine. A POST to /v1/apps/{app}/machines/{id}/suspend snapshots RAM and
# suspends THIS machine — the Fly-endorsed replacement for proxy autostop when
# the app must own the idle decision (https://fly.io/docs/reference/suspend-resume/).
FLY_API_SOCKET = "/.fly/api"


# config.yaml default (D2). Behavioural setting -> config, not env.
DEFAULT_IDLE_TIMEOUT_MINUTES = 5

_TRUTHY = {"1", "true", "yes", "on"}


def scale_to_zero_enabled(environ: Optional[dict] = None) -> bool:
    """Whether the per-instance Labs toggle is on (the WORK4YOU_SCALE_TO_ZERO stamp).

    D11/Q8=A: this env flag is the SOLE per-instance enable signal reaching the
    gateway. Absent/blank/falsey -> disabled (fail-safe default off).
    """
    env = environ if environ is not None else os.environ
    return str(env.get(SCALE_TO_ZERO_ENV, "")).strip().lower() in _TRUTHY


def parse_idle_timeout_seconds(
    cfg_value: Any, default_minutes: int = DEFAULT_IDLE_TIMEOUT_MINUTES
) -> float:
    """Coerce ``scale_to_zero.idle_timeout_minutes`` (config.yaml, D2) to seconds.

    Degrades to the default on any non-numeric / non-positive value (never raises,
    never returns <= 0 — a zero/negative timeout would make the gateway go dormant
    instantly, which is never the intent).
    """
    try:
        minutes = float(cfg_value)
    except (TypeError, ValueError):
        minutes = float(default_minutes)
    if minutes <= 0:
        minutes = float(default_minutes)
    return minutes * 60.0


def messaging_is_relay_only_or_absent(platforms: Iterable[Any]) -> bool:
    """True iff the only connected messaging platform is RELAY, or there is none
    (a Chronos-only / no-platform agent) — the F6/D1 structural precondition.

    A directly-connected platform (Discord/Telegram/Slack/...) holds a live
    socket and cannot scale to zero, so its presence disarms the feature. We
    compare by the platform's ``.value``/name to avoid importing the enum here
    (keeps this module import-light and unit-testable).
    """
    names = {_platform_name(p) for p in platforms}
    names.discard("relay")
    return len(names) == 0


def _platform_name(platform: Any) -> str:
    value = getattr(platform, "value", platform)
    return str(value).strip().lower()


def should_arm(*, enabled: bool, wake_url: Optional[str]) -> bool:
    """Whether to start the idle watcher at all (D11/§3.4(1)).

    Both must hold: the Labs flag is on and a wakeUrl is registered (a suspended
    instance with no reachable wake target is a black hole — §3.4(1)). Otherwise
    the watcher never starts, so a non-opted instance behaves exactly as today.
    Direct messaging platforms are checked on every idle tick instead: one can
    connect, or give up, long after startup.
    """
    return bool(enabled) and bool(wake_url)


def is_idle(
    *,
    running_agent_count: int,
    seconds_since_last_inbound: float,
    idle_timeout_seconds: float,
    has_live_background_work: bool,
) -> bool:
    """The idle predicate (D2/D3/F7). Pure — composes the three conjuncts.

    Idle iff: no in-flight agent turn, no inbound within the timeout window, and
    no live background work (backgrounded delegate_task / kanban / bg terminal).
    Any active work keeps the gateway awake — suspending mid-flight would lose it.
    """
    if running_agent_count > 0:
        return False
    if has_live_background_work:
        return False
    return seconds_since_last_inbound >= idle_timeout_seconds


# ── Dashboard activity stamp ──────────────────────────────────────────────────
#
# Web and TUI chat run in the dashboard process (and its PTY TUI children), not
# in the gateway. The suspend freezes the whole machine, so the gateway must see
# that activity: the dashboard side touches a file on user input and while an
# agent turn runs, and the idle predicate treats the file's mtime as inbound. A
# file, because the processes share only the volume. It lives at the Work4You
# root, not the profile home: a profile-scoped chat runs with WORK4YOU_HOME at
# its profile dir, but the suspend freezes every profile on the machine.
#
# An open client is NOT activity. The desktop app and dashboard keep their
# sockets open and poll on timers; counting either would keep the VM up 24/7.

ACTIVITY_STAMP_NAME = ".scale_to_zero_activity"

# Well under the 5-minute default idle window, so a running turn never ages out.
ACTIVITY_HEARTBEAT_SECONDS = 30.0

# Keystrokes arrive many per second; one stamp per window is enough.
ACTIVITY_MIN_INTERVAL_SECONDS = 5.0


def activity_stamp_path() -> Path:
    from work4you_constants import get_default_work4you_root

    return get_default_work4you_root() / ACTIVITY_STAMP_NAME


_last_noted: dict[Path, float] = {}


def note_activity(path: Optional[Path] = None) -> None:
    """Stamp activity the gateway cannot see. No-op unless the instance opted in."""
    if not scale_to_zero_enabled():
        return
    target = path or activity_stamp_path()
    now = time.monotonic()
    if now - _last_noted.get(target, float("-inf")) < ACTIVITY_MIN_INTERVAL_SECONDS:
        return
    _last_noted[target] = now
    try:
        target.touch()
    except OSError:
        logger.debug("scale-to-zero: activity stamp write failed", exc_info=True)


def seconds_since_activity(
    now: Optional[float] = None, path: Optional[Path] = None
) -> float:
    """Seconds since the dashboard last stamped activity; inf when it never has."""
    target = path or activity_stamp_path()
    try:
        mtime = target.stat().st_mtime
    except OSError:
        return float("inf")
    current = time.time() if now is None else now
    return max(0.0, current - mtime)


_busy_probes: list[Callable[[], bool]] = []
_activity_lock = threading.Lock()
_heartbeat_thread: Optional[threading.Thread] = None


def register_busy_probe(probe: Callable[[], bool]) -> None:
    """Keep stamping activity while ``probe()`` is true (checked every heartbeat)."""
    with _activity_lock:
        _busy_probes.append(probe)
    _ensure_activity_heartbeat()


def dashboard_busy() -> bool:
    with _activity_lock:
        probes = list(_busy_probes)
    for probe in probes:
        try:
            if probe():
                return True
        except Exception:  # noqa: BLE001 - a broken probe must not stop the heartbeat
            logger.debug("scale-to-zero: busy probe failed", exc_info=True)
    return False


def _ensure_activity_heartbeat() -> None:
    global _heartbeat_thread
    if not scale_to_zero_enabled():
        return
    with _activity_lock:
        if _heartbeat_thread is not None and _heartbeat_thread.is_alive():
            return
        _heartbeat_thread = threading.Thread(
            target=_activity_heartbeat_loop,
            name="scale-to-zero-activity",
            daemon=True,
        )
        _heartbeat_thread.start()


def _activity_heartbeat_loop() -> None:
    while True:
        time.sleep(ACTIVITY_HEARTBEAT_SECONDS)
        if dashboard_busy():
            note_activity()


def self_suspend_available(environ: Optional[dict] = None) -> bool:
    """Whether this process can suspend its own machine via the flaps socket.

    True iff the Fly-injected machine identity is present AND the local Machines
    API socket exists. Off-Fly (local dev, Azure ACA, tests) this is False and
    the watcher simply skips the suspend step — dormancy still happens, the
    platform just never freezes the process.
    """
    env = environ if environ is not None else os.environ
    return bool(
        str(env.get(FLY_APP_NAME_ENV, "")).strip()
        and str(env.get(FLY_MACHINE_ID_ENV, "")).strip()
        and os.path.exists(FLY_API_SOCKET)
    )


def suspend_self(
    environ: Optional[dict] = None,
    *,
    socket_path: str = FLY_API_SOCKET,
    timeout: float = 10.0,
) -> bool:
    """POST /v1/apps/{app}/machines/{id}/suspend on the local flaps socket.

    Fly's in-machine Machines API needs no token — the socket itself is the
    credential. Equivalent to:
        curl --unix-socket /.fly/api -X POST \\
          http://flaps/v1/apps/$FLY_APP_NAME/machines/$FLY_MACHINE_ID/suspend

    Returns True when flaps accepted the request (2xx). The caller should treat
    this as fire-and-forget: on success the kernel freezes this process shortly
    after, so there may be nothing meaningful to run afterwards. Never raises —
    a failed suspend just leaves the machine running (fail-awake, never
    fail-frozen), which costs money but loses no work.

    stdlib-only on purpose: a plain unix-socket HTTP/1.1 request, no httpx/
    requests dependency in the hot path and no async plumbing to freeze
    mid-await.
    """
    env = environ if environ is not None else os.environ
    app = str(env.get(FLY_APP_NAME_ENV, "")).strip()
    machine_id = str(env.get(FLY_MACHINE_ID_ENV, "")).strip()
    if not app or not machine_id:
        logger.warning("scale-to-zero: suspend_self called without Fly machine identity")
        return False
    request = (
        f"POST /v1/apps/{app}/machines/{machine_id}/suspend HTTP/1.1\r\n"
        "Host: flaps\r\n"
        "Content-Length: 0\r\n"
        "Connection: close\r\n"
        "\r\n"
    )
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            sock.connect(socket_path)
            sock.sendall(request.encode("ascii"))
            response = b""
            while len(response) < 65536:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                response += chunk
    except OSError as exc:
        logger.warning("scale-to-zero: flaps suspend request failed: %s", exc)
        return False
    status_line = response.split(b"\r\n", 1)[0].decode("ascii", "replace")
    parts = status_line.split()
    ok = len(parts) >= 2 and parts[1].isdigit() and 200 <= int(parts[1]) < 300
    if ok:
        logger.info("scale-to-zero: machine suspend accepted by flaps (%s)", status_line)
    else:
        body = response.split(b"\r\n\r\n", 1)[-1][:500].decode("utf-8", "replace")
        logger.warning(
            "scale-to-zero: flaps suspend rejected: %s %s",
            status_line,
            json.dumps(body)[:500],
        )
    return ok
