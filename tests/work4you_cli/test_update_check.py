"""Tests for the update check mechanism in work4you_cli.banner."""

import json
import os
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest




def test_check_for_updates_uses_cache(tmp_path, monkeypatch):
    """When cache is fresh, check_for_updates should return cached value without calling git."""
    from work4you_cli.banner import check_for_updates
    from work4you_cli import __version__

    # Create a fake git repo and fresh cache
    repo_dir = tmp_path / "work4you"
    repo_dir.mkdir()
    (repo_dir / ".git").mkdir()

    cache_file = tmp_path / ".update_check"
    cache_file.write_text(json.dumps({"ts": time.time(), "behind": 3, "ver": __version__}))

    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    with patch("work4you_cli.banner.subprocess.run") as mock_run:
        result = check_for_updates()

    assert result == 3
    mock_run.assert_not_called()






def test_check_for_updates_desktop_compares_runtime_ref(tmp_path, monkeypatch):
    """Consumer desktop installs have no git history; compare .runtime-ref."""
    from work4you_cli.banner import check_for_updates

    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    monkeypatch.delenv("WORK4YOU_REVISION", raising=False)
    (tmp_path / "work4you").mkdir()
    (tmp_path / "work4you" / ".install_method").write_text("desktop\n", encoding="utf-8")

    with patch("work4you_cli.config.detect_install_method", return_value="desktop"), patch(
        "work4you_cli.config.get_project_root", return_value=tmp_path / "work4you"
    ), patch(
        "work4you_cli.runtime_payload.compare_runtime_ref", return_value=-1
    ) as compare:
        result = check_for_updates()

    assert result == -1
    compare.assert_called_once()


def test_prefetch_non_blocking():
    """prefetch_update_check() should return immediately without blocking."""
    import work4you_cli.banner as banner

    # Reset module state
    banner._update_result = None
    banner._update_check_done = threading.Event()

    with patch.object(banner, "check_for_updates", return_value=5):
        start = time.monotonic()
        banner.prefetch_update_check()
        elapsed = time.monotonic() - start

        # Should return almost immediately (well under 1 second)
        assert elapsed < 1.0

        # Wait for the background thread to finish
        banner._update_check_done.wait(timeout=5)
        assert banner._update_result == 5




