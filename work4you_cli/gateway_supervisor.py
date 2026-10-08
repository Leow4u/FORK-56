"""Keep a detached messaging gateway alive without a native service manager.

Windows launchers own a hidden console that their children inherit. POSIX
launchers start a separate session. Both use this bounded recovery path.
The kernel lock is per profile and survives child restarts. A generation-scoped
stop request also works during backoff, when there is no gateway PID to stop.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterator

from utils import atomic_json_write


def supervisor_command(command: list[str]) -> list[str]:
    """Wrap a Python CLI gateway command without advertising a runtime PID."""
    if command[1:3] != ["-m", "work4you_cli.main"]:
        return command
    return [command[0], "-m", "work4you_cli.gateway_supervisor", "--", *command[3:]]


@contextmanager
def _profile_lock(home: Path) -> Iterator[bool]:
    home.mkdir(parents=True, exist_ok=True)
    # Never unlink this file: another process may already have it open.
    with (home / ".gateway-supervisor.lock").open("a+b") as handle:
        if os.name == "nt":
            import msvcrt

            if handle.tell() == 0:
                handle.write(b" ")
                handle.flush()
            handle.seek(0)
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                yield False
                return
        else:
            import fcntl

            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                yield False
                return
        try:
            yield True
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def is_supervisor_running(home: Path) -> bool:
    if not (home / ".gateway-supervisor.lock").exists():
        return False
    with _profile_lock(home) as acquired:
        return not acquired


def request_supervisor_stop(home: Path) -> bool:
    """Disable recovery for the current generation before stopping its child."""
    try:
        record = json.loads((home / "gateway-supervisor.json").read_text(encoding="utf-8"))
        generation = record["generation"]
    except (OSError, ValueError, KeyError, TypeError):
        return False
    atomic_json_write(home / ".gateway-supervisor-stop.json", {"generation": generation})
    return True


def wait_for_supervisor_exit(home: Path, timeout: float = 10.0) -> bool:
    """Wait for a stopped generation to release its lock before relaunching."""
    deadline = time.monotonic() + timeout
    while is_supervisor_running(home):
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.1)
    return True


def _stop_requested(home: Path, generation: str) -> bool:
    try:
        record = json.loads((home / ".gateway-supervisor-stop.json").read_text(encoding="utf-8"))
        return record.get("generation") == generation
    except (OSError, ValueError, AttributeError):
        return False


def _log(home: Path, message: str) -> None:
    try:
        log_dir = home / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        with (log_dir / "gateway-supervisor.log").open("a", encoding="utf-8") as handle:
            handle.write(f"{datetime.now(timezone.utc).isoformat()} {message}\n")
    except OSError:
        pass  # A logging failure must not disable recovery.


def _wait_for_stop(seconds: float, should_stop: Callable[[], bool]) -> bool:
    deadline = time.monotonic() + seconds
    while not should_stop():
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False
        time.sleep(min(0.2, remaining))
    return True


def _wait_for_child(proc: subprocess.Popen, home: Path, should_stop: Callable[[], bool]) -> int:
    if os.name == "nt":
        # Windows stop() owns the planned-marker drain and process-tree kill.
        return proc.wait()
    stop_deadline = None
    while True:
        if should_stop() and stop_deadline is None:
            from gateway.status import write_planned_stop_marker

            write_planned_stop_marker(proc.pid, work4you_home=home)
            proc.terminate()
            stop_deadline = time.monotonic() + 30.0
        if stop_deadline is not None and time.monotonic() >= stop_deadline:
            proc.kill()
        try:
            return proc.wait(timeout=0.2)
        except subprocess.TimeoutExpired:
            continue


def supervise(
    command: list[str],
    home: Path,
    *,
    max_restarts: int = 5,
    initial_delay: float = 2.0,
    stable_seconds: float = 300.0,
) -> int:
    """Restart crashes, but never a clean stop or fatal configuration error.

    Code 75 (planned update/restart) returns through the same bounded path.
    A child that has stayed up for five minutes earns a fresh retry budget.
    """
    from gateway.restart import GATEWAY_FATAL_CONFIG_EXIT_CODE

    with _profile_lock(home) as acquired:
        if not acquired:
            return 0
        generation = uuid.uuid4().hex
        record_path = home / "gateway-supervisor.json"
        atomic_json_write(record_path, {"pid": os.getpid(), "generation": generation})
        signalled = False

        def on_stop_signal(_signum, _frame):
            nonlocal signalled
            signalled = True

        def should_stop():
            return signalled or _stop_requested(home, generation)

        previous_handlers = {}
        if os.name == "posix":
            for signum in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):  # windows-footgun: ok — guarded by os.name == "posix"
                try:
                    previous = signal.signal(signum, on_stop_signal)
                    previous_handlers[signum] = previous
                except ValueError:
                    pass  # Direct library use from a non-main thread.
        retries = 0
        try:
            while not should_stop():
                started = time.monotonic()
                try:
                    # Inherit the launcher's console/session and log streams.
                    proc = subprocess.Popen(command, stdin=subprocess.DEVNULL)
                    code = _wait_for_child(proc, home, should_stop)
                except OSError as exc:
                    _log(home, f"Gateway launch failed: {exc}")
                    code = 1
                if should_stop():
                    return 0
                if code in (0, GATEWAY_FATAL_CONFIG_EXIT_CODE):
                    return code
                # A legacy update may need takeover on its first launch. Never
                # repeat that takeover against a replacement started elsewhere.
                command = [arg for arg in command if arg != "--replace"]
                if time.monotonic() - started >= stable_seconds:
                    retries = 0
                if retries >= max_restarts:
                    _log(home, f"Recovery exhausted after {retries} retries (exit {code}); manual restart required.")
                    return code
                delay = min(initial_delay * (2 ** retries), 30.0)
                retries += 1
                _log(home, f"Gateway exited with code {code}; retry {retries}/{max_restarts} in {delay:g}s.")
                if _wait_for_stop(delay, should_stop):
                    return 0
            return 0
        finally:
            try:
                record_path.unlink(missing_ok=True)
            finally:
                for signum, previous in previous_handlers.items():
                    signal.signal(signum, previous)


def _ignore_windows_console_controls() -> None:
    if os.name == "nt":
        import ctypes
        import signal

        # Match the detached child's console-control policy. The supervisor
        # must also survive broadcasts from sibling console processes.
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGBREAK, signal.SIG_IGN)
        ctypes.windll.kernel32.SetConsoleCtrlHandler(None, 1)


def main(argv: list[str] | None = None) -> int:
    from work4you_constants import get_work4you_home

    args = list(sys.argv[1:] if argv is None else argv)
    if args[:1] == ["--"]:
        args = args[1:]
    parser = argparse.ArgumentParser(add_help=False, allow_abbrev=False)
    parser.add_argument("--profile", "-p")
    options, _rest = parser.parse_known_args(args)
    if options.profile is not None:
        from work4you_cli.profiles import resolve_profile_env

        os.environ["WORK4YOU_HOME"] = resolve_profile_env(options.profile)
    elif get_work4you_home().parent.name != "profiles":
        # A service for the default profile must not follow active_profile
        # to another profile on its next child restart.
        args = ["--profile", "default", *args]
    if "--external-supervisor" not in args:
        args.append("--external-supervisor")
    _ignore_windows_console_controls()
    command = [sys.executable, "-m", "work4you_cli.main", *args]
    return supervise(command, get_work4you_home())


if __name__ == "__main__":
    raise SystemExit(main())
