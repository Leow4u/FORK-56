"""Desktop runtime-payload update path: no git pull, git installs unchanged."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from work4you_cli import update_cmd


def test_desktop_check_reports_available_update(capsys):
    root = SimpleNamespace()
    with patch.object(update_cmd, "_m") as mock_m, patch(
        "work4you_cli.runtime_payload.read_runtime_ref",
        return_value={"commit": "a" * 40, "branch": "main"},
    ), patch(
        "work4you_cli.runtime_payload.compare_runtime_ref", return_value=-1
    ):
        mock_m.return_value.PROJECT_ROOT = root
        update_cmd._cmd_update_check_desktop("main")
    out = capsys.readouterr().out
    assert "Update available" in out
    assert "work4you update" in out


def test_desktop_check_up_to_date(capsys):
    with patch.object(update_cmd, "_m") as mock_m, patch(
        "work4you_cli.runtime_payload.read_runtime_ref",
        return_value={"commit": "a" * 40, "branch": "main"},
    ), patch(
        "work4you_cli.runtime_payload.compare_runtime_ref", return_value=0
    ):
        mock_m.return_value.PROJECT_ROOT = SimpleNamespace()
        update_cmd._cmd_update_check_desktop("main")
    out = capsys.readouterr().out
    assert "Already up to date" in out


def test_desktop_check_exits_when_remote_unreachable():
    with patch.object(update_cmd, "_m") as mock_m, patch(
        "work4you_cli.runtime_payload.read_runtime_ref",
        return_value={"commit": "a" * 40, "branch": "main"},
    ), patch(
        "work4you_cli.runtime_payload.compare_runtime_ref", return_value=None
    ):
        mock_m.return_value.PROJECT_ROOT = SimpleNamespace()
        with pytest.raises(SystemExit) as exc:
            update_cmd._cmd_update_check_desktop("main")
        assert exc.value.code == 1


def test_cmd_update_check_routes_desktop_away_from_git():
    with patch(
        "work4you_cli.config.detect_install_method", return_value="desktop"
    ), patch.object(update_cmd, "_cmd_update_check_desktop") as check_desktop, patch.object(
        update_cmd, "_m"
    ) as mock_m:
        mock_m.return_value.PROJECT_ROOT = SimpleNamespace()
        update_cmd._cmd_update_check("main")
        check_desktop.assert_called_once_with("main")


def test_update_via_zip_honours_branch_for_runtime_payload(monkeypatch, tmp_path):
    """Desktop payload updates may pin a branch; the Windows git-I/O fallback may not."""
    captured = {}

    def fake_urlretrieve(url, dest):
        captured["url"] = url
        raise RuntimeError("stop-before-extract")

    monkeypatch.setattr(update_cmd, "_read_project_version", lambda: "0.0.0")
    monkeypatch.setattr("urllib.request.urlretrieve", fake_urlretrieve)
    monkeypatch.setattr(update_cmd, "_m", lambda: SimpleNamespace(
        PROJECT_ROOT=tmp_path,
        _resolve_update_branch=lambda _args: "release",
        _capture_active_tool_dependencies=lambda: {},
        sys=SimpleNamespace(exit=lambda code: (_ for _ in ()).throw(SystemExit(code))),
    ))

    with pytest.raises(SystemExit):
        update_cmd._update_via_zip(
            SimpleNamespace(branch="release"),
            runtime_payload=False,
        )
    assert "url" not in captured

    with pytest.raises(RuntimeError, match="stop-before-extract"):
        update_cmd._update_via_zip(
            SimpleNamespace(branch="release"),
            runtime_payload=True,
        )
    assert "/refs/heads/release.zip" in captured["url"]


def test_cmd_update_impl_uses_runtime_payload_for_desktop_method(monkeypatch, tmp_path):
    calls = {}

    class FakeMain:
        PROJECT_ROOT = tmp_path

        def _capture_active_lazy_features(self):
            return {}

        def _capture_active_tool_dependencies(self):
            return {}

        def _is_windows(self):
            return False

        def _run_pre_update_backup(self, _args):
            return None

        def _pause_windows_gateways_for_update(self):
            return None

        def _resume_windows_gateways_after_update(self, _token):
            return None

        def _detect_venv_python_processes(self):
            return None

    monkeypatch.setattr(update_cmd, "_m", lambda: FakeMain())
    monkeypatch.setattr(update_cmd, "_read_project_version", lambda: "0.0.0")
    monkeypatch.setattr(update_cmd, "_desktop_app_present", lambda _p: False)
    monkeypatch.setattr(
        "work4you_cli.config.detect_install_method", lambda _root: "desktop"
    )

    def fake_zip(args, *, had_desktop_app_before_update=False, runtime_payload=False):
        calls["runtime_payload"] = runtime_payload
        calls["had_desktop"] = had_desktop_app_before_update
        return True

    monkeypatch.setattr(update_cmd, "_update_via_zip", fake_zip)

    update_cmd._cmd_update_impl(SimpleNamespace(force=False, force_venv=False, yes=True), False)
    assert calls["runtime_payload"] is True
    assert calls["had_desktop"] is False
