"""Packaged cleanup waits to remove the interpreter until its process exits."""

from types import SimpleNamespace

import pytest

from work4you_cli import gui_uninstall, managed_runtime, uninstall


@pytest.fixture
def installation(tmp_path, monkeypatch):
    runtime = tmp_path / "Applications" / "Work4You" / "resources" / "runtime"
    runtime.mkdir(parents=True)
    engine = runtime / "python.exe"
    engine.write_bytes(b"running interpreter")
    data = tmp_path / "custom data"
    data.mkdir()
    history = data / "state.db"
    history.write_bytes(b"saved conversations")
    userdata = tmp_path / "app preferences"
    userdata.mkdir()
    monkeypatch.setattr(managed_runtime, "bundled_runtime_root", lambda: runtime)
    monkeypatch.setattr(uninstall, "get_work4you_home", lambda: data)
    monkeypatch.setattr(gui_uninstall, "desktop_userdata_dir", lambda: userdata)
    return runtime, engine, data, history, userdata


@pytest.mark.parametrize("mode", ["gui", "lite"])
def test_keep_data_mode_does_not_remove_engine_or_user_data(installation, mode):
    runtime, engine, data, history, userdata = installation
    assert uninstall.main(["--mode", mode]) == 0
    assert engine.read_bytes() == b"running interpreter"
    assert history.read_bytes() == b"saved conversations"
    assert userdata.is_dir()


def test_full_mode_removes_only_confirmed_data_before_os_uninstall(installation):
    runtime, engine, data, history, userdata = installation
    assert uninstall.main(["--mode", "full"]) == 0
    assert engine.read_bytes() == b"running interpreter"
    assert not data.exists()
    assert not userdata.exists()


def test_cli_uninstall_does_not_treat_packaged_runtime_as_source_checkout(installation, monkeypatch):
    runtime, engine, data, history, userdata = installation
    def unexpected(**kwargs):
        pytest.fail("Packaged CLI must not run source uninstaller")
    monkeypatch.setattr(uninstall, "_perform_uninstall", unexpected)
    uninstall.run_uninstall(SimpleNamespace(yes=True, full=True))
    uninstall.run_gui_uninstall(SimpleNamespace(yes=True))
    assert engine.exists() and history.exists()


def test_full_cleanup_refuses_data_directory_containing_app(installation, monkeypatch):
    runtime, engine, *_ = installation
    monkeypatch.setattr(uninstall, "get_work4you_home", lambda: runtime.parent)
    with pytest.raises(ValueError, match="overlap"):
        uninstall.main(["--mode", "full"])
    assert engine.exists()
