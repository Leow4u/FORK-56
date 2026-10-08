"""Detached gateway recovery, with real child processes and profile files."""

import json
import subprocess
import sys
import time

import pytest

from gateway.status import looks_like_gateway_runtime_command_line
from work4you_cli import gateway_supervisor as supervisor


def _child(tmp_path, codes):
    script = tmp_path / "child.py"
    attempts = tmp_path / "attempts.json"
    script.write_text(
        "import json, sys\n"
        "from pathlib import Path\n"
        f"path = Path({str(attempts)!r})\n"
        "n = json.loads(path.read_text(encoding='utf-8')) if path.exists() else 0\n"
        "path.write_text(json.dumps(n + 1), encoding='utf-8')\n"
        f"codes = {codes!r}\n"
        "sys.exit(codes[min(n, len(codes) - 1)])\n",
        encoding="utf-8",
    )
    return [sys.executable, str(script)], attempts


@pytest.mark.parametrize("first_code", [1, 75])
def test_crash_or_planned_restart_recovers_without_manual_action(tmp_path, first_code):
    command, attempts = _child(tmp_path, [first_code, 0])
    home = tmp_path / "profile"

    assert supervisor.supervise(command, home, initial_delay=0) == 0
    assert json.loads(attempts.read_text(encoding="utf-8")) == 2
    assert not supervisor.is_supervisor_running(home)
    assert not (home / "gateway-supervisor.json").exists()
    assert f"code {first_code}" in (home / "logs/gateway-supervisor.log").read_text(encoding="utf-8")


@pytest.mark.parametrize("code", [0, 78])
def test_clean_stop_and_invalid_configuration_do_not_restart(tmp_path, code):
    command, attempts = _child(tmp_path, [code])

    assert supervisor.supervise(command, tmp_path / "profile", initial_delay=0) == code
    assert json.loads(attempts.read_text(encoding="utf-8")) == 1


def test_repeated_crashes_back_off_and_exhaust_recovery(tmp_path, monkeypatch):
    command, attempts = _child(tmp_path, [1])
    home = tmp_path / "profile"
    delays = []
    monkeypatch.setattr(supervisor, "_wait_for_stop", lambda delay, _stop: delays.append(delay) or False)

    assert supervisor.supervise(command, home, max_restarts=6) == 1
    assert json.loads(attempts.read_text(encoding="utf-8")) == 7
    assert delays == [2, 4, 8, 16, 30, 30]
    assert "Recovery exhausted" in (home / "logs/gateway-supervisor.log").read_text(encoding="utf-8")


def test_stable_runtime_resets_retry_budget(tmp_path, monkeypatch):
    command, attempts = _child(tmp_path, [1, 1, 1, 0])
    times = iter([0, 1, 1, 400, 400, 401, 401])
    delays = []
    monkeypatch.setattr(supervisor.time, "monotonic", lambda: next(times))
    monkeypatch.setattr(supervisor, "_wait_for_stop", lambda delay, _stop: delays.append(delay) or False)

    assert supervisor.supervise(command, tmp_path / "profile", max_restarts=2) == 0
    assert json.loads(attempts.read_text(encoding="utf-8")) == 4
    assert delays == [2, 2, 4]


def test_launch_failure_has_bounded_recovery(tmp_path, monkeypatch):
    delays = []
    monkeypatch.setattr(supervisor, "_wait_for_stop", lambda delay, _stop: delays.append(delay) or False)

    assert supervisor.supervise([str(tmp_path / "missing-python")], tmp_path, max_restarts=2) == 1
    assert len(delays) == 2
    assert "Gateway launch failed" in (tmp_path / "logs/gateway-supervisor.log").read_text(encoding="utf-8")


def test_stop_during_backoff_does_not_cancel_next_manual_start(tmp_path, monkeypatch):
    command, attempts = _child(tmp_path, [1, 0])
    home = tmp_path / "profile"

    def stop_during_backoff(_delay, should_stop):
        assert supervisor.request_supervisor_stop(home)
        return should_stop()

    monkeypatch.setattr(supervisor, "_wait_for_stop", stop_during_backoff)
    assert supervisor.supervise(command, home) == 0
    assert json.loads(attempts.read_text(encoding="utf-8")) == 1
    assert supervisor.supervise(command, home) == 0
    assert json.loads(attempts.read_text(encoding="utf-8")) == 2


def _wait_until(predicate):
    deadline = time.monotonic() + 10
    while not predicate():
        assert time.monotonic() < deadline, "child process did not reach the expected state"
        time.sleep(0.02)


def test_one_supervisor_per_profile_and_stop_before_force_kill(tmp_path):
    """Exercise the real process/lock/stop boundary used by Windows stop()."""
    home = tmp_path / "alice"
    ready = tmp_path / "ready.json"
    release = tmp_path / "release"
    child_code = (
        "import json, os, sys, time; from pathlib import Path; "
        f"Path({str(ready)!r}).write_text(json.dumps(os.getpid()), encoding='utf-8')\n"
        f"while not Path({str(release)!r}).exists(): time.sleep(0.02)\n"
        "sys.exit(1)\n"
    )
    worker_code = (
        "from pathlib import Path; from work4you_cli.gateway_supervisor import supervise; "
        f"raise SystemExit(supervise({[sys.executable, '-c', child_code]!r}, Path({str(home)!r}), initial_delay=0))"
    )
    worker = subprocess.Popen([sys.executable, "-c", worker_code])
    try:
        _wait_until(ready.exists)
        assert supervisor.is_supervisor_running(home)
        # A second launcher must not execute another child for Alice.
        command, attempts = _child(tmp_path, [0])
        assert supervisor.supervise(command, home) == 0
        assert not attempts.exists()
        # Bob is independent and can start while Alice is running.
        assert supervisor.supervise(command, tmp_path / "bob") == 0
        assert json.loads(attempts.read_text(encoding="utf-8")) == 1
        assert not supervisor.request_supervisor_stop(tmp_path / "bob")
        assert supervisor.request_supervisor_stop(home)
        release.touch()
        assert worker.wait(timeout=10) == 0
        assert not supervisor.is_supervisor_running(home)
    finally:
        supervisor.request_supervisor_stop(home)
        release.touch()
        if worker.poll() is None:
            worker.wait(timeout=10)


def test_stop_interrupts_real_backoff(tmp_path):
    command, attempts = _child(tmp_path, [1])
    home = tmp_path / "profile"
    worker_code = (
        "from pathlib import Path; from work4you_cli.gateway_supervisor import supervise; "
        f"raise SystemExit(supervise({command!r}, Path({str(home)!r}), initial_delay=30))"
    )
    worker = subprocess.Popen([sys.executable, "-c", worker_code])
    try:
        _wait_until(lambda: (home / "logs/gateway-supervisor.log").exists())
        assert supervisor.request_supervisor_stop(home)
        assert worker.wait(timeout=10) == 0
        assert json.loads(attempts.read_text(encoding="utf-8")) == 1
    finally:
        supervisor.request_supervisor_stop(home)
        if worker.poll() is None:
            worker.wait(timeout=10)


def test_child_keeps_profile_arguments_and_declares_supervisor(tmp_path, monkeypatch):
    observed = []
    profile_home = tmp_path / "profiles" / "alice"
    profile_home.mkdir(parents=True)
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    monkeypatch.setattr(supervisor, "_ignore_windows_console_controls", lambda: None)
    monkeypatch.setattr(supervisor, "supervise", lambda command, home: observed.append((command, home)) or 0)

    command = [sys.executable, "-m", "work4you_cli.main", "--profile", "alice", "gateway", "run"]
    wrapped = supervisor.supervisor_command(command)
    assert not looks_like_gateway_runtime_command_line(subprocess.list2cmdline(wrapped))
    assert supervisor.main(wrapped[3:]) == 0
    assert observed == [([*command, "--external-supervisor"], profile_home)]
    assert supervisor.supervisor_command(wrapped) == wrapped


def test_default_profile_does_not_follow_sticky_active_profile(tmp_path, monkeypatch):
    observed = []
    (tmp_path / "active_profile").write_text("alice", encoding="utf-8")
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    monkeypatch.setattr(supervisor, "_ignore_windows_console_controls", lambda: None)
    monkeypatch.setattr(supervisor, "supervise", lambda command, home: observed.append((command, home)) or 0)

    assert supervisor.main(["gateway", "run"]) == 0
    command, home = observed[0]
    assert command[3:5] == ["--profile", "default"]
    assert home == tmp_path


@pytest.mark.windows_only
def test_windows_real_supervisor_lock_and_stop(tmp_path):
    # Exercise msvcrt and native child exit semantics on the Windows CI lane.
    test_one_supervisor_per_profile_and_stop_before_force_kill(tmp_path)


@pytest.mark.windows_only
def test_windows_real_supervisor_crash_recovery(tmp_path):
    test_crash_or_planned_restart_recovers_without_manual_action(tmp_path, 1)


@pytest.mark.macos_only
def test_macos_real_supervisor_lock_and_stop(tmp_path):
    test_one_supervisor_per_profile_and_stop_before_force_kill(tmp_path)


@pytest.mark.macos_only
def test_macos_real_supervisor_crash_recovery(tmp_path):
    test_crash_or_planned_restart_recovers_without_manual_action(tmp_path, 1)
