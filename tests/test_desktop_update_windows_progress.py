"""The Windows hand-off keeps serving progress while its main thread blocks.

windows.ps1 answers /progress from a dedicated runspace precisely so the
window keeps moving through the long silent stretches (`work4you update`, pip,
the desktop rebuild) that made an 18-minute update look hung. This drives the
real script and polls the real listener; the posix half of the same contract
is covered in test_desktop_update_shim_progress.py.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
import urllib.error
from pathlib import Path
from urllib.request import urlopen

import pytest

pytestmark = pytest.mark.windows_only

REPO_ROOT = Path(__file__).resolve().parent.parent
WINDOWS_UPDATE_PS1 = REPO_ROOT / "scripts" / "desktop-update" / "windows.ps1"


def _read_progress(url: str) -> dict[str, object]:
    with urlopen(f"{url}progress", timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def _read_progress_retry(url: str, *, attempts: int = 8) -> dict[str, object]:
    last: BaseException | None = None
    for i in range(attempts):
        try:
            return _read_progress(url)
        except (TimeoutError, urllib.error.URLError, ConnectionError, OSError) as e:
            last = e
            time.sleep(0.25 * (i + 1))
    assert last is not None
    raise last


def test_progress_advances_while_the_orchestrator_blocks(tmp_path: Path) -> None:
    powershell = shutil.which("powershell.exe")
    assert powershell, "Windows updater tests require Windows PowerShell."

    output_path = tmp_path / "self-test-output.log"
    env = os.environ.copy()
    env["TEMP"] = str(tmp_path)
    env["TMP"] = str(tmp_path)
    # Shim discovery can take several seconds on CI; keep the orchestrator
    # blocked long enough that both progress polls land inside the hold
    # window (before Close-ProgressWindow clears message / stops the listener).
    env["WORK4YOU_SELFTEST_HOLD_SECONDS"] = "20"

    with output_path.open("wb") as output:
        process = subprocess.Popen(
            [
                powershell,
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(WINDOWS_UPDATE_PS1),
                "-SelfTestUi",
                "-NoUi",
            ],
            stdout=output,
            stderr=subprocess.STDOUT,
            env=env,
        )

    try:
        # Hold is 20s; allow slow powershell cold-start on GHA before the
        # SELF-TEST line appears on the success stream.
        deadline = time.monotonic() + 40
        shim_url = None
        while time.monotonic() < deadline:
            text = output_path.read_text(encoding="utf-8", errors="replace")
            match = re.search(r"SELF-TEST: shim at (http://127\.0\.0\.1:\d+/)", text)
            if match:
                shim_url = match.group(1)
                break
            if "SELF-TEST: shim failed to start" in text:
                break
            if process.poll() is not None:
                break
            time.sleep(0.1)

        assert shim_url, (
            f"exit={process.poll()} "
            f"output={output_path.read_text(encoding='utf-8', errors='replace')!r}"
        )

        first = None
        poll_deadline = time.monotonic() + 10
        while time.monotonic() < poll_deadline:
            snap = _read_progress_retry(shim_url)
            if snap.get("status") == "running" and snap.get("message"):
                first = snap
                break
            time.sleep(0.2)
        assert first is not None, "progress never published a running message"

        time.sleep(1.5)
        second = _read_progress_retry(shim_url)

        # Still inside the orchestrator hold — stage must stay verbatim and
        # elapsed must keep ticking while the main thread is asleep.
        assert second["status"] == "running", second
        assert second["message"] == first["message"]
        assert int(second["elapsed_seconds"]) > int(first["elapsed_seconds"])

        assert process.wait(timeout=60) == 0
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
