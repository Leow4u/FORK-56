"""Desktop-owned code stays immutable while user extensions remain usable."""

import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from work4you_cli import managed_runtime as runtime


@pytest.fixture
def bundle(tmp_path, monkeypatch):
    root = tmp_path / "app" / "runtime"
    root.mkdir(parents=True)
    paths = {"browser": {"command": "browsers/agent-browser", "executable": "browsers/chrome"},
             "browserUse": {"module": "browser_harness.run"},
             "computerUse": {"command": "computer-use/cua-driver"}}
    for capability in (paths["browser"], paths["computerUse"]):
        for relative in capability.values():
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("bundled")
            target.chmod(0o755)
    (root / "manifest.json").write_text(json.dumps({"present": True, "layout": "app-owned", "capabilities": paths}))
    monkeypatch.setenv("WORK4YOU_BUNDLED_RUNTIME", str(root))
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path / "custom-home"))
    return root


def test_capabilities_cannot_escape_bundle(bundle, tmp_path):
    assert runtime.bundled_capability_path("browser") == bundle / "browsers" / "agent-browser"
    manifest = runtime.bundled_runtime_manifest()
    outside = tmp_path / "outside"
    outside.write_text("not owned")
    manifest["capabilities"]["browser"]["command"] = str(outside)
    (bundle / "manifest.json").write_text(json.dumps(manifest))
    assert runtime.bundled_capability_path("browser") is None


def test_extension_target_is_outside_bundle_and_shared_with_profile(bundle, monkeypatch, tmp_path):
    from tools.lazy_deps import _lazy_install_target

    monkeypatch.setenv("WORK4YOU_LAZY_INSTALL_TARGET", str(bundle / "python"))
    target = _lazy_install_target()
    assert target.is_relative_to(tmp_path / "custom-home" / "extensions" / "python")
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path / "custom-home" / "profiles" / "writer"))
    assert _lazy_install_target() == target
    assert not target.exists()  # resolving a package target does not run setup


def test_installs_target_extensions_and_never_bootstrap_pip_in_app(bundle, monkeypatch):
    from tools import lazy_deps

    calls = []
    monkeypatch.setattr("work4you_cli.managed_uv.resolve_uv", lambda: None)
    monkeypatch.setattr(lazy_deps.shutil, "which", lambda _: None)
    def run(args, **kwargs):
        calls.append(args)
        return subprocess.CompletedProcess(args, 1, "", "pip unavailable")
    monkeypatch.setattr(lazy_deps.subprocess, "run", run)
    result = lazy_deps._venv_pip_install(("sample-package==1.0",))
    assert not result.success
    assert "bundled package installer" in result.stderr
    assert calls == [[sys.executable, "-m", "pip", "--version"]]


def test_extensions_activate_after_core_across_process_startup(bundle, monkeypatch):
    target = runtime.extension_packages_dir()
    target.mkdir(parents=True)
    (target / "desktop_extension_fixture.py").write_text("value = 42\n")
    source = str(Path(__file__).resolve().parents[2])
    env = {**os.environ, "PYTHONPATH": source, "PYTHONDONTWRITEBYTECODE": "1"}
    result = subprocess.run(
        [sys.executable, "-c", "import work4you_bootstrap; import desktop_extension_fixture; print(desktop_extension_fixture.value)"],
        env=env, capture_output=True, text=True, timeout=20,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "42"


def test_update_delegates_before_source_update_or_lock(bundle, monkeypatch, tmp_path):
    from work4you_cli import main

    executable = tmp_path / "Work4You"
    executable.write_text("app")
    monkeypatch.setenv("WORK4YOU_DESKTOP_APP_EXECUTABLE", str(executable))
    calls = []
    monkeypatch.setattr(runtime.subprocess, "Popen", lambda argv, **kwargs: calls.append((argv, kwargs)))
    monkeypatch.setattr(main, "_cmd_update_impl", lambda *a, **k: pytest.fail("source update invoked"))
    main.cmd_update(SimpleNamespace(check=False))
    main.cmd_update(SimpleNamespace(check=True))
    assert [args for args, _ in calls] == [[str(executable), "--work4you-update"], [str(executable), "--work4you-check-updates"]]
    assert all(options["env"]["WORK4YOU_HOME"] == os.environ["WORK4YOU_HOME"] for _, options in calls)


def test_browser_and_computer_use_resolve_offline_bundle(bundle, monkeypatch):
    from tools import browser_tool, browser_use_cli
    from tools.computer_use import cua_backend
    from work4you_cli import tools_config

    monkeypatch.setattr(browser_tool.shutil, "which", lambda *a, **k: pytest.fail("PATH fallback"))
    assert browser_tool._find_agent_browser() == str(bundle / "browsers" / "agent-browser")
    assert browser_tool._chromium_installed()
    assert browser_tool._maybe_autoinstall_chromium()
    assert browser_use_cli._find_cli() == [sys.executable, "-m", "browser_harness.run"]
    assert browser_use_cli.install_cli()[0]
    assert cua_backend._candidate_cua_driver_commands() == [str(bundle / "computer-use" / "cua-driver")]
    monkeypatch.setattr(tools_config, "_cua_driver_contract_status", lambda *_: {"ready": True})
    assert tools_config.install_cua_driver(upgrade=True)


def test_bundled_node_and_shell_resolve_without_machine_installs(bundle, monkeypatch):
    from work4you_constants import find_node_executable, with_work4you_node_path
    from work4you_cli._subprocess_compat import resolve_node_command
    from tools.environments.local import _find_bash

    manifest = runtime.bundled_runtime_manifest()
    manifest["capabilities"]["shell"] = {"command": "git/bin/bash.exe"}
    (bundle / "manifest.json").write_text(json.dumps(manifest))
    bash = bundle / "git" / "bin" / "bash.exe"
    bash.parent.mkdir(parents=True)
    bash.write_text("bundled bash")
    node_dir = bundle / "node" if sys.platform == "win32" else bundle / "node" / "bin"
    node_dir.mkdir(parents=True)
    npm = node_dir / ("npm.cmd" if sys.platform == "win32" else "npm")
    npm.write_text("bundled npm")
    monkeypatch.setenv("PATH", "")
    assert find_node_executable("npm") == str(npm)
    assert resolve_node_command("npm", ["--version"]) == [str(npm), "--version"]
    assert with_work4you_node_path({"PATH": ""})["PATH"].split(os.pathsep)[0] == str(node_dir)
    assert _find_bash() == str(bash)


def test_browser_harness_state_uses_effective_profile_home(bundle, monkeypatch, tmp_path):
    from tools import browser_tool, browser_use_cli

    monkeypatch.setattr(browser_tool, "_build_browser_env", lambda: {"PYTHONPATH": "wrong-abi", "PYTHONHOME": "wrong-python"})
    profile = tmp_path / "custom-home" / "profiles" / "writer"
    monkeypatch.setenv("WORK4YOU_HOME", str(profile))
    env = browser_use_cli._base_subprocess_env()
    assert env["BH_HOME"] == str(profile / "cache" / "browser-harness")
    assert env["BH_CHROME_PATH"] == str(bundle / "browsers" / "chrome")
    assert "PYTHONPATH" not in env and "PYTHONHOME" not in env


def test_private_browser_reuses_named_session_and_cleans_last_owner(bundle, monkeypatch, tmp_path):
    from tools import bundled_browser

    # Exercise real child lifetime and DevToolsActivePort discovery using a
    # stand-in for the Chrome executable; the release smoke uses real Chrome.
    child = tmp_path / "chrome_fixture.py"
    child.write_text(
        "import pathlib, sys, time\n"
        "directory = pathlib.Path(next(a.split('=', 1)[1] for a in sys.argv if a.startswith('--user-data-dir=')))\n"
        "(directory / 'DevToolsActivePort').write_text('43891\\n/devtools/browser/fixture\\n')\n"
        "time.sleep(60)\n"
    )
    original_popen = subprocess.Popen
    original_run = subprocess.run
    processes = []
    def launch(argv, **kwargs):
        if argv[0] != str(bundle / "browsers" / "chrome"):
            return original_popen(argv, **kwargs)
        process = original_popen([sys.executable, str(child), *argv[1:]], **kwargs)
        processes.append(process)
        return process
    monkeypatch.setattr(bundled_browser.subprocess, "Popen", launch)
    daemon_stops = []
    def run(argv, **kwargs):
        if "browser_harness.run" in argv:
            daemon_stops.append(kwargs["env"]["BU_NAME"])
            return subprocess.CompletedProcess(argv, 0)
        return original_run(argv, **kwargs)
    monkeypatch.setattr(bundled_browser.subprocess, "run", run)
    first, second, isolated = (dict(os.environ) for _ in range(3))
    try:
        bundled_browser.connect_bundled_browser(first, task_id="one", session_name="shared")
        bundled_browser.release_bundled_browser(first)
        bundled_browser.connect_bundled_browser(second, task_id="two", session_name="shared")
        bundled_browser.release_bundled_browser(second)
        assert len(processes) == 1
        assert first["BU_NAME"] == second["BU_NAME"]
        assert first["BU_CDP_WS"] == "ws://127.0.0.1:43891/devtools/browser/fixture"
        assert Path(first["BH_RUNTIME_DIR"]).is_dir()
        if os.name == "posix":
            assert len(os.fsencode(Path(first["BH_RUNTIME_DIR"]).resolve() / "bu.sock")) < 104
        monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path / "other-profile"))
        bundled_browser.connect_bundled_browser(isolated, task_id="one", session_name="shared")
        bundled_browser.release_bundled_browser(isolated)
        assert len(processes) == 2
        assert first["BU_NAME"] != isolated["BU_NAME"]
        bundled_browser.cleanup_bundled_browser("one")
        assert processes[0].poll() is None  # second task still owns the shared session
        assert processes[1].poll() is not None
        bundled_browser.cleanup_bundled_browser("two")
        assert processes[0].poll() is not None
        assert set(daemon_stops) == {first["BU_NAME"], isolated["BU_NAME"]}
        assert not list(tmp_path.rglob("DevToolsActivePort"))
        assert not Path(first["BH_RUNTIME_DIR"]).exists()
        assert not Path(isolated["BH_RUNTIME_DIR"]).exists()
    finally:
        bundled_browser.cleanup_bundled_browser()
        for process in processes:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)


def test_missing_bundled_chromium_does_not_trigger_setup_download(bundle, monkeypatch):
    from work4you_cli import tools_config

    (bundle / "browsers" / "chrome").unlink()
    monkeypatch.setattr(tools_config.subprocess, "run", lambda *a, **k: pytest.fail("runtime download attempted"))
    tools_config._run_post_setup("agent_browser")


def test_extension_install_uses_shipped_uv_and_writable_target(bundle, monkeypatch):
    from tools import lazy_deps

    uv = bundle / "bin" / ("uv.exe" if sys.platform == "win32" else "uv")
    uv.parent.mkdir()
    uv.write_text("uv")
    calls = []
    def run(argv, **kwargs):
        calls.append((argv, kwargs))
        return subprocess.CompletedProcess(argv, 0, "installed", "")
    monkeypatch.setattr(lazy_deps.subprocess, "run", run)
    monkeypatch.setattr("work4you_cli.managed_uv.resolve_uv", lambda: pytest.fail("used unrelated package installer"))
    result = lazy_deps._venv_pip_install(("example==1.0",))
    assert result.success
    argv, options = calls[0]
    assert argv[:5] == [str(uv), "pip", "install", "--python", sys.executable]
    assert Path(argv[argv.index("--target") + 1]) == runtime.extension_packages_dir()
    assert "VIRTUAL_ENV" not in options["env"]
    command = runtime.extension_install_command(["example==1.0"])
    assert str(uv) in command and "--target" in command


def test_managed_voice_default_is_local_and_alternate_downloads_to_user_cache(bundle, monkeypatch):
    from tools import transcription_tools

    model_file = bundle / "voice" / "whisper-base" / "model.bin"
    model_file.parent.mkdir(parents=True)
    model_file.write_bytes(b"model fixture")
    manifest = runtime.bundled_runtime_manifest()
    manifest["capabilities"]["voice"] = {"model": "base", "modelFile": "voice/whisper-base/model.bin"}
    (bundle / "manifest.json").write_text(json.dumps(manifest))
    calls = []
    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=lambda *a, **k: calls.append((a, k))))
    transcription_tools._load_local_whisper_model("base", device="cpu", compute_type="int8")
    transcription_tools._load_local_whisper_model("small", device="cpu", compute_type="int8")
    assert calls[0][0] == (str(model_file.parent),)
    assert calls[0][1]["local_files_only"] is True
    assert calls[1][0] == ("small",)
    assert calls[1][1]["download_root"] == str(Path(os.environ["WORK4YOU_HOME"]) / "cache" / "whisper")


def test_managed_default_wake_uses_shipped_features_without_install(bundle, monkeypatch):
    from tools import wake_word

    manifest = runtime.bundled_runtime_manifest()
    features = {}
    for suffix, extension in (("Onnx", "onnx"), ("Tflite", "tflite")):
        for key in ("melspectrogram", "embedding"):
            relative = f"voice/wake/{key}.{extension}"
            path = bundle / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"feature fixture")
            features[key + suffix] = relative
    manifest["capabilities"]["wake"] = features
    (bundle / "manifest.json").write_text(json.dumps(manifest))
    calls = []
    def model(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(models={"hey_work4you": object()})
    monkeypatch.setitem(sys.modules, "openwakeword", SimpleNamespace(utils=SimpleNamespace(download_models=lambda *a, **k: pytest.fail("download attempted"))))
    monkeypatch.setitem(sys.modules, "openwakeword.model", SimpleNamespace(Model=model))
    monkeypatch.setattr("tools.lazy_deps.ensure", lambda *a, **k: pytest.fail("package install attempted"))
    # Runtime bridging is a library boundary; exercise the platform's actual framework.
    monkeypatch.setattr(wake_word, "ensure_tflite_runtime", lambda: True)
    wake_word._OpenWakeWordEngine({})
    framework = wake_word.default_inference_framework()
    assert calls[0]["melspec_model_path"] == str(bundle / "voice" / "wake" / f"melspectrogram.{framework}")
    assert calls[0]["embedding_model_path"] == str(bundle / "voice" / "wake" / f"embedding.{framework}")
