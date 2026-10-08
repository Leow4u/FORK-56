"""Lifecycle contracts for hosts without a working native gateway service."""

import signal
import subprocess
import sys
import time
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from work4you_cli import gateway
from work4you_cli import gateway_supervisor as supervisor


@pytest.fixture
def no_service(monkeypatch, tmp_path):
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    monkeypatch.delenv("_WORK4YOU_GATEWAY", raising=False)
    monkeypatch.setattr(gateway, "supports_systemd_services", lambda: False)
    monkeypatch.setattr(gateway, "is_container", lambda: False)
    monkeypatch.setattr(gateway, "is_termux", lambda: False)
    monkeypatch.setattr(gateway, "_dispatch_via_service_manager_if_s6", lambda action: False)
    monkeypatch.setattr(gateway, "_dispatch_all_via_service_manager_if_s6", lambda action: False)
    monkeypatch.setattr("gateway.status.get_running_pid", lambda *args, **kwargs: None)
    return tmp_path


@pytest.mark.linux_only
@pytest.mark.parametrize("wsl", [False, True])
def test_linux_and_wsl_start_use_supervised_background_gateway(no_service, monkeypatch, wsl):
    spawned = Mock(return_value=True)
    monkeypatch.setattr(gateway, "is_wsl", lambda: wsl)
    monkeypatch.setattr(gateway, "_spawn_detached_gateway", spawned)

    gateway.gateway_command(SimpleNamespace(gateway_command="start", system=False))

    spawned.assert_called_once_with()


@pytest.mark.linux_only
def test_start_all_waits_for_stopped_supervisor_before_relaunch(no_service, monkeypatch):
    calls = []
    monkeypatch.setattr(gateway, "kill_gateway_processes", lambda **kwargs: calls.append("stop-all") or 0)
    monkeypatch.setattr(supervisor, "wait_for_supervisor_exit", lambda home: calls.append("supervisor-exited") or True)
    monkeypatch.setattr(gateway, "_spawn_detached_gateway", lambda: calls.append("start") or True)

    gateway.gateway_command(SimpleNamespace(gateway_command="start", system=False, all=True))

    assert calls == ["stop-all", "supervisor-exited", "start"]


def test_background_start_keeps_existing_gateway(monkeypatch):
    spawned = Mock()
    monkeypatch.setattr("gateway.status.get_running_pid", lambda: 4242)
    monkeypatch.setattr(gateway, "_spawn_detached_gateway", spawned)

    gateway._start_gateway_without_service()

    spawned.assert_not_called()


def _check_legacy_update_respawn(monkeypatch):
    spawned = Mock()
    monkeypatch.setattr(gateway.subprocess, "Popen", spawned)
    command = [sys.executable, "-m", "work4you_cli.main", "-p", "alice", "gateway", "run"]

    assert gateway.launch_detached_gateway_restart_by_cmdline(4242, command)

    watcher_argv = spawned.call_args.args[0]
    assert watcher_argv[3:] == ["4242", *supervisor.supervisor_command(command)]
    assert spawned.call_args.kwargs["start_new_session"] is True


@pytest.mark.linux_only
def test_linux_update_respawn_keeps_supervision(monkeypatch):
    _check_legacy_update_respawn(monkeypatch)


@pytest.mark.macos_only
def test_macos_update_respawn_keeps_supervision(monkeypatch):
    _check_legacy_update_respawn(monkeypatch)


@pytest.mark.linux_only
@pytest.mark.parametrize("pids", [[], [4242]])
def test_status_distinguishes_background_recovery_from_manual_run(no_service, monkeypatch, capsys, pids):
    monkeypatch.setattr(supervisor, "is_supervisor_running", lambda home: True)
    monkeypatch.setattr(gateway, "get_gateway_runtime_snapshot", lambda **kwargs: SimpleNamespace(gateway_pids=pids))
    monkeypatch.setattr(gateway, "_runtime_health_lines", lambda: [])
    monkeypatch.setattr(gateway, "_print_other_profiles_gateway_status", lambda: None)

    gateway.gateway_command(SimpleNamespace(gateway_command="status", system=False))

    output = capsys.readouterr().out
    assert "recovery" in output
    assert "Gateway is not running" not in output
    assert "Running manually" not in output


@pytest.mark.linux_only
@pytest.mark.parametrize("all_profiles", [False, True])
def test_linux_restart_waits_for_previous_supervisor(no_service, monkeypatch, all_profiles):
    calls = []
    monkeypatch.setattr(gateway, "stop_profile_gateway", lambda: calls.append("stop") or True)
    monkeypatch.setattr(gateway, "kill_gateway_processes", lambda **kwargs: 1)
    monkeypatch.setattr(gateway, "_wait_for_gateway_exit", lambda **kwargs: calls.append("child-exited") or True)
    monkeypatch.setattr(supervisor, "wait_for_supervisor_exit", lambda home: calls.append("supervisor-exited") or True)
    monkeypatch.setattr(gateway, "_spawn_detached_gateway", lambda: calls.append("start") or True)

    gateway.gateway_command(SimpleNamespace(gateway_command="restart", system=False, all=all_profiles))

    assert calls[-4:] == ["stop", "child-exited", "supervisor-exited", "start"]


@pytest.mark.parametrize("child_exited,supervisor_exited", [(False, True), (True, False)])
def test_restart_refuses_duplicate_when_old_generation_has_not_stopped(
    monkeypatch, child_exited, supervisor_exited
):
    spawned = Mock(return_value=True)
    monkeypatch.setattr(gateway, "stop_profile_gateway", lambda: True)
    monkeypatch.setattr(gateway, "_wait_for_gateway_exit", lambda **kwargs: child_exited)
    monkeypatch.setattr(supervisor, "wait_for_supervisor_exit", lambda home: supervisor_exited)
    monkeypatch.setattr(gateway, "_spawn_detached_gateway", spawned)

    with pytest.raises(RuntimeError):
        gateway._restart_gateway_without_service()

    spawned.assert_not_called()


@pytest.mark.linux_only
def test_systemd_start_keeps_native_service_owner(no_service, monkeypatch):
    native_start = Mock()
    fallback = Mock()
    monkeypatch.setattr(gateway, "supports_systemd_services", lambda: True)
    monkeypatch.setattr(gateway, "systemd_start", native_start)
    monkeypatch.setattr(gateway, "_spawn_detached_gateway", fallback)

    gateway.gateway_command(SimpleNamespace(gateway_command="start", system=False))

    native_start.assert_called_once_with(system=False)
    fallback.assert_not_called()


def test_existing_supervisor_makes_detached_start_idempotent(monkeypatch):
    spawned = Mock()
    monkeypatch.setattr(supervisor, "is_supervisor_running", lambda home: True)
    monkeypatch.setattr(gateway.subprocess, "Popen", spawned)

    assert gateway._spawn_detached_gateway()
    spawned.assert_not_called()


@pytest.mark.macos_only
def test_macos_stop_during_recovery_skips_launchctl(no_service, monkeypatch):
    calls = []
    monkeypatch.setattr(supervisor, "is_supervisor_running", lambda home: True)
    monkeypatch.setattr(gateway, "stop_profile_gateway", lambda: calls.append("stop") or True)
    monkeypatch.setattr(gateway, "_wait_for_gateway_exit", lambda **kwargs: calls.append("child-exited") or True)
    monkeypatch.setattr(supervisor, "wait_for_supervisor_exit", lambda home: calls.append("supervisor-exited") or True)
    launchctl = Mock()
    monkeypatch.setattr(gateway.subprocess, "run", launchctl)

    gateway.launchd_stop()

    assert calls == ["stop", "child-exited", "supervisor-exited"]
    launchctl.assert_not_called()


@pytest.mark.macos_only
def test_macos_restart_preserves_graceful_supervised_handoff(no_service, monkeypatch):
    monkeypatch.setattr(supervisor, "is_supervisor_running", lambda home: True)
    monkeypatch.setattr("gateway.status.get_running_pid", lambda: 4242)
    restart_request = Mock(return_value=True)
    monkeypatch.setattr(gateway, "_request_gateway_self_restart", restart_request)
    fallback_restart = Mock()
    monkeypatch.setattr(gateway, "_restart_gateway_without_service", fallback_restart)
    launchctl = Mock()
    monkeypatch.setattr(gateway.subprocess, "run", launchctl)

    gateway.launchd_restart()

    restart_request.assert_called_once_with(4242)
    fallback_restart.assert_not_called()
    launchctl.assert_not_called()


def _wait_until(predicate):
    deadline = time.monotonic() + 10
    while not predicate():
        assert time.monotonic() < deadline, "worker did not reach expected state"
        time.sleep(0.02)


def _exercise_posix_stop(tmp_path, monkeypatch, *, via_signal):
    """The child verifies its planned-stop marker before acknowledging SIGTERM."""
    home = tmp_path / "profile"
    ready = tmp_path / "ready"
    stopped = tmp_path / "stopped.json"
    child = (
        "import json, os, signal, sys, time\nfrom pathlib import Path\n"
        "def stop(_sig, _frame):\n"
        f"    marker = json.loads(Path({str(home / '.gateway-planned-stop.json')!r}).read_text(encoding='utf-8'))\n"
        "    assert marker['target_pid'] == os.getpid()\n"
        f"    Path({str(stopped)!r}).write_text(json.dumps(marker), encoding='utf-8')\n"
        "    sys.exit(0)\n"
        "signal.signal(signal.SIGTERM, stop)\n"
        f"Path({str(ready)!r}).touch()\n"
        "while True: time.sleep(0.02)\n"
    )
    command = [sys.executable, "-c", child]
    worker_code = (
        "from pathlib import Path\nfrom work4you_cli.gateway_supervisor import supervise\n"
        f"raise SystemExit(supervise({command!r}, Path({str(home)!r}), initial_delay=0))"
    )
    worker = subprocess.Popen([sys.executable, "-c", worker_code])
    try:
        _wait_until(ready.exists)
        assert supervisor.is_supervisor_running(home)
        if via_signal:
            worker.send_signal(signal.SIGTERM)
        else:
            # No gateway.pid exists: the owner must still stop its child.
            monkeypatch.setenv("WORK4YOU_HOME", str(home))
            monkeypatch.setattr(gateway, "_reap_unsupervised_gateway_orphans", lambda: False)
            assert gateway.stop_profile_gateway()
        assert worker.wait(timeout=10) == 0
        assert stopped.exists()
        assert supervisor.wait_for_supervisor_exit(home, timeout=2)
        assert not (home / "logs/gateway-supervisor.log").exists()
    finally:
        supervisor.request_supervisor_stop(home)
        if worker.poll() is None:
            worker.send_signal(signal.SIGTERM)
            worker.wait(timeout=10)


@pytest.mark.linux_only
@pytest.mark.parametrize("via_signal", [False, True])
def test_linux_stop_reaches_child_without_restarting(tmp_path, monkeypatch, via_signal):
    _exercise_posix_stop(tmp_path, monkeypatch, via_signal=via_signal)


@pytest.mark.macos_only
@pytest.mark.parametrize("via_signal", [False, True])
def test_macos_stop_reaches_child_without_restarting(tmp_path, monkeypatch, via_signal):
    _exercise_posix_stop(tmp_path, monkeypatch, via_signal=via_signal)
