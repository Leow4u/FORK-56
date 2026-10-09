"""Lifecycle of the desktop's private Chromium used by Browser Use."""

from __future__ import annotations

import atexit
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from work4you_cli._subprocess_compat import windows_hide_flags
from work4you_cli.managed_runtime import bundled_capability_path
from work4you_constants import get_work4you_home


@dataclass
class _Browser:
    process: subprocess.Popen
    directory: Path
    websocket: str
    env: dict
    owners: set[str] = field(default_factory=set)
    touched: float = field(default_factory=time.monotonic)
    in_use: int = 0
    ipc_directory: Path | None = None


_browsers: dict[tuple[str, str], _Browser] = {}
_lock = threading.RLock()
_reaper: threading.Thread | None = None
_stopping = threading.Event()


def _close(browser: _Browser) -> None:
    # Stop the harness daemon as well as Chrome; otherwise a reused name can
    # keep talking to the previous dead endpoint after idle cleanup.
    if browser.env.get("BU_NAME", "").startswith("w4u-"):
        try:
            subprocess.run(
                [sys.executable, "-m", "browser_harness.run", "--reload"],
                env=browser.env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, timeout=5, creationflags=windows_hide_flags(),
            )
        except (OSError, subprocess.SubprocessError):
            pass
    if browser.process.poll() is None:
        from tools.browser_tool import _kill_process_tree

        _kill_process_tree(browser.process)
    try:
        browser.process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    shutil.rmtree(browser.directory, ignore_errors=True)
    if browser.ipc_directory is not None:
        shutil.rmtree(browser.ipc_directory, ignore_errors=True)


def cleanup_bundled_browser(task_id: str | None = None) -> None:
    """Release a task's owned browsers, or all browsers on process shutdown."""
    with _lock:
        for key, browser in list(_browsers.items()):
            if task_id is not None:
                if task_id not in browser.owners:
                    continue
                browser.owners.discard(task_id)
                if browser.owners:
                    continue
            _browsers.pop(key, None)
            _close(browser)


def _reap_idle() -> None:
    while not _stopping.wait(30):
        from tools.browser_tool import BROWSER_SESSION_INACTIVITY_TIMEOUT

        with _lock:
            for key, browser in list(_browsers.items()):
                if browser.in_use == 0 and time.monotonic() - browser.touched > BROWSER_SESSION_INACTIVITY_TIMEOUT:
                    _browsers.pop(key, None)
                    _close(browser)


def connect_bundled_browser(env: dict, *, task_id: str | None, session_name: str = "") -> None:
    """Start/reuse private Chromium and point the harness at its CDP socket.

    Never drives the person's normal Chrome profile or downloads a browser.
    Each profile and task/named session has its own process and writable data.
    """
    global _reaper
    chrome = bundled_capability_path("browser", "executable")
    if chrome is None:
        raise RuntimeError("Chromium is missing from the app. Repair or update Work4You Desktop.")
    home = get_work4you_home().resolve()
    owner = task_id or "default"
    session = f"named:{session_name}" if session_name else f"task:{owner}"
    key = (str(home), session)
    with _lock:
        browser = _browsers.get(key)
        if browser is not None and browser.process.poll() is not None:
            _browsers.pop(key)
            _close(browser)
            browser = None
        if browser is None:
            cache = home / "cache" / "browser-use" / "chromium"
            cache.mkdir(parents=True, exist_ok=True)
            directory = Path(tempfile.mkdtemp(prefix=f"{os.getpid()}-", dir=cache))
            # An ephemeral, dedicated profile enables CDP without asking the
            # person to enable remote debugging on their own browser.
            args = [
                str(chrome), "--headless=new", "--no-first-run", "--no-default-browser-check",
                "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
                f"--user-data-dir={directory}", "about:blank",
            ]
            try:
                process = subprocess.Popen(
                    args, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL, start_new_session=sys.platform != "win32",
                    creationflags=windows_hide_flags(),
                )
            except OSError:
                shutil.rmtree(directory, ignore_errors=True)
                raise
            browser = _Browser(process, directory, "", dict(env))
            try:
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise RuntimeError(f"Chromium exited during startup (exit {process.returncode}).")
                    try:
                        lines = (directory / "DevToolsActivePort").read_text(encoding="utf-8").splitlines()
                        port = int(lines[0])
                        if 0 < port < 65536 and len(lines) > 1 and lines[1].startswith("/devtools/browser/"):
                            browser.websocket = f"ws://127.0.0.1:{port}{lines[1]}"
                            break
                    except (OSError, ValueError, IndexError):
                        pass
                    time.sleep(0.05)
                if not browser.websocket:
                    raise RuntimeError("Chromium did not become ready within 20 seconds.")
            except BaseException:
                _close(browser)
                raise
            # AF_UNIX paths are limited to 104 bytes on macOS. A custom HOME
            # can be arbitrarily deep, so keep only disposable IPC files in
            # a short, private temp directory; browser data stays under HOME.
            temporary_root = Path(tempfile.gettempdir()).resolve()
            if os.name == "posix" and len(os.fsencode(temporary_root)) > 65:
                temporary_root = Path("/tmp")
            try:
                browser.ipc_directory = Path(tempfile.mkdtemp(prefix="w4u-bu-", dir=temporary_root))
            except OSError:
                _close(browser)
                raise
            digest = hashlib.sha256(f"{home}\0{session}\0{os.getpid()}".encode()).hexdigest()[:20]
            browser.env["BU_NAME"] = f"w4u-{digest}"
            browser.env["BU_CDP_WS"] = browser.websocket
            browser.env["BH_RUNTIME_DIR"] = str(browser.ipc_directory)
            browser.env.pop("BH_RUNTIME_DIR_SHARED", None)
            _browsers[key] = browser
        browser.owners.add(owner)
        browser.touched = time.monotonic()
        browser.in_use += 1
        env["BU_NAME"] = browser.env["BU_NAME"]
        env["BU_CDP_WS"] = browser.websocket
        env["BH_RUNTIME_DIR"] = browser.env["BH_RUNTIME_DIR"]
        env.pop("BH_RUNTIME_DIR_SHARED", None)
        if _reaper is None or not _reaper.is_alive():
            _reaper = threading.Thread(target=_reap_idle, daemon=True, name="work4you-bundled-browser")
            _reaper.start()


def release_bundled_browser(env: dict) -> None:
    """End one harness call without expiring a browser while it is busy."""
    with _lock:
        for browser in _browsers.values():
            if browser.env.get("BU_NAME") == env.get("BU_NAME"):
                browser.in_use = max(0, browser.in_use - 1)
                browser.touched = time.monotonic()
                return


def _shutdown() -> None:
    _stopping.set()
    cleanup_bundled_browser()


atexit.register(_shutdown)
