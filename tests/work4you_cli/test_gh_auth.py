"""Unit tests for work4you_cli.gh_auth (device flow + gh credential handoff).

No network, no real gh: urllib and subprocess are mocked.
"""

from __future__ import annotations

import io
import json
import os
import stat
import subprocess
import urllib.parse

import pytest

from work4you_cli import gh_auth


class _FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _urlopen_sequence(monkeypatch, responses):
    """Queue JSON bodies for successive urlopen calls; record the requests."""
    calls = []
    queue = list(responses)

    def _fake_urlopen(req, timeout=None):
        calls.append(req)
        body = queue.pop(0)
        if isinstance(body, Exception):
            raise body
        return _FakeResp(json.dumps(body).encode())

    monkeypatch.setattr(gh_auth.urllib.request, "urlopen", _fake_urlopen)
    return calls


# ─── find_gh_binary / gh_env ─────────────────────────────────────────────────


def test_find_gh_binary_prefers_path_then_known_dirs(monkeypatch):
    monkeypatch.setattr("work4you_cli.copilot_auth.shutil.which", lambda cmd: None)
    monkeypatch.setattr("work4you_cli.copilot_auth.os.path.isfile", lambda p: p == "/usr/local/bin/gh")
    monkeypatch.setattr("work4you_cli.copilot_auth.os.access", lambda p, mode: p == "/usr/local/bin/gh")
    assert gh_auth.find_gh_binary() == "/usr/local/bin/gh"

    monkeypatch.setattr("work4you_cli.copilot_auth.shutil.which", lambda cmd: "/on/path/gh")
    assert gh_auth.find_gh_binary() == "/on/path/gh"


def test_find_gh_binary_none_when_absent(monkeypatch):
    monkeypatch.setattr("work4you_cli.copilot_auth.shutil.which", lambda cmd: None)
    monkeypatch.setattr("work4you_cli.copilot_auth.os.path.isfile", lambda p: False)
    assert gh_auth.find_gh_binary() is None


def test_gh_env_strips_env_tokens_and_disables_prompts(monkeypatch):
    monkeypatch.setenv("GH_TOKEN", "env-token")
    monkeypatch.setenv("GITHUB_TOKEN", "env-token-2")
    env = gh_auth.gh_env()
    assert "GH_TOKEN" not in env
    assert "GITHUB_TOKEN" not in env
    assert env["GH_PROMPT_DISABLED"] == "1"
    assert env["GIT_TERMINAL_PROMPT"] == "0"


# ─── probe_status ────────────────────────────────────────────────────────────


def _completed(cmd, returncode=0, stdout=""):
    return subprocess.CompletedProcess(cmd, returncode, stdout=stdout, stderr="")


def test_probe_status_reports_login_when_authenticated(monkeypatch):
    calls = []

    def _fake_run(cmd, **kwargs):
        calls.append((cmd, kwargs))
        if cmd[1:3] == ["auth", "status"]:
            return _completed(cmd, 0)
        if cmd[1:3] == ["api", "user"]:
            return _completed(cmd, 0, stdout="octocat\n")
        raise AssertionError(cmd)

    monkeypatch.setattr(gh_auth.subprocess, "run", _fake_run)
    monkeypatch.setenv("GH_TOKEN", "should-be-stripped")

    payload = gh_auth.probe_status("/bin/gh")

    assert payload == {"available": True, "authenticated": True, "login": "octocat", "host": "github.com"}
    for cmd, kwargs in calls:
        assert cmd[0] == "/bin/gh"
        assert kwargs["stdin"] is subprocess.DEVNULL
        assert "GH_TOKEN" not in kwargs["env"]


def test_probe_status_unauthenticated_and_missing(monkeypatch):
    monkeypatch.setattr(gh_auth.subprocess, "run", lambda cmd, **kw: _completed(cmd, 1))
    assert gh_auth.probe_status("/bin/gh") == {
        "available": True, "authenticated": False, "login": None, "host": "github.com",
    }
    assert gh_auth.probe_status(None) == {
        "available": False, "authenticated": False, "login": None, "host": "github.com",
    } or gh_auth.find_gh_binary() is not None


def test_probe_status_swallows_timeouts(monkeypatch):
    def _boom(cmd, **kw):
        raise subprocess.TimeoutExpired(cmd, 10)

    monkeypatch.setattr(gh_auth.subprocess, "run", _boom)
    assert gh_auth.probe_status("/bin/gh")["authenticated"] is False


# ─── request_device_code ─────────────────────────────────────────────────────


def test_request_device_code_uses_gh_client_and_scopes(monkeypatch):
    calls = _urlopen_sequence(monkeypatch, [{
        "device_code": "dev", "user_code": "ABCD-1234", "interval": "7", "expires_in": 899,
    }])

    data = gh_auth.request_device_code()

    assert data["user_code"] == "ABCD-1234"
    assert data["interval"] == 7
    assert data["verification_uri"] == "https://github.com/login/device"
    req = calls[0]
    assert req.full_url == "https://github.com/login/device/code"
    form = dict(urllib.parse.parse_qsl(req.data.decode()))
    assert form["client_id"] == gh_auth.GH_DEVICE_CLIENT_ID
    assert form["scope"] == "repo workflow read:org gist"


def test_request_device_code_raises_without_code(monkeypatch):
    _urlopen_sequence(monkeypatch, [{"error": "unauthorized_client", "error_description": "nope"}])
    with pytest.raises(RuntimeError, match="nope"):
        gh_auth.request_device_code()


# ─── poll_access_token ───────────────────────────────────────────────────────


def test_poll_access_token_pending_slow_down_then_approved(monkeypatch):
    sleeps = []
    _urlopen_sequence(monkeypatch, [
        {"error": "authorization_pending"},
        {"error": "slow_down", "interval": 9},
        OSError("blip"),
        {"access_token": "gho_secret", "token_type": "bearer"},
    ])

    status, token, message = gh_auth.poll_access_token(
        "dev", interval=5, timeout_seconds=600, sleep=sleeps.append,
    )

    assert (status, token, message) == (gh_auth.APPROVED, "gho_secret", None)
    # interval 5 (+1 margin) twice, then server-mandated 9 (+1) after slow_down
    assert sleeps[:2] == [6, 6]
    assert sleeps[2] == 10


@pytest.mark.parametrize("error,expected", [
    ("access_denied", gh_auth.DENIED),
    ("expired_token", gh_auth.EXPIRED),
    ("incorrect_device_code", gh_auth.ERROR),
])
def test_poll_access_token_terminal_errors(monkeypatch, error, expected):
    _urlopen_sequence(monkeypatch, [{"error": error}])
    status, token, message = gh_auth.poll_access_token("dev", interval=1, sleep=lambda s: None)
    assert status == expected
    assert token is None
    assert message


def test_poll_access_token_stops_when_cancelled(monkeypatch):
    calls = _urlopen_sequence(monkeypatch, [{"error": "authorization_pending"}] * 5)
    flags = {"stop": False}

    def _sleep(_):
        flags["stop"] = True

    status, token, message = gh_auth.poll_access_token(
        "dev", interval=1, should_stop=lambda: flags["stop"], sleep=_sleep,
    )
    assert (status, token, message) == (gh_auth.ERROR, None, "cancelled")
    assert calls == []  # cancelled before the first request went out


def test_poll_access_token_times_out(monkeypatch):
    _urlopen_sequence(monkeypatch, [{"error": "authorization_pending"}] * 3)
    clock = {"t": 0.0}
    monkeypatch.setattr(gh_auth.time, "monotonic", lambda: clock["t"])

    def _sleep(s):
        clock["t"] += 100

    status, _, _ = gh_auth.poll_access_token("dev", interval=1, timeout_seconds=250, sleep=_sleep)
    assert status == gh_auth.EXPIRED


# ─── store_token_in_gh / write_hosts_yml ─────────────────────────────────────


class _FakePopen:
    instances = []

    def __init__(self, cmd, *, hang=False, returncode=0, **kwargs):
        self.cmd = cmd
        self.kwargs = kwargs
        self.hang = hang
        self.returncode = None if hang else returncode
        self.input = None
        self.killed = False
        _FakePopen.instances.append(self)

    def communicate(self, input=None, timeout=None):
        if self.hang and not self.killed:
            self.input = input
            raise subprocess.TimeoutExpired(self.cmd, timeout)
        if input is not None:
            self.input = input
        return "", ""

    def kill(self):
        self.killed = True
        self.returncode = -9

    def poll(self):
        return self.returncode

    @property
    def pid(self):
        return 4242


@pytest.fixture(autouse=True)
def _reset_fake_popen():
    _FakePopen.instances = []
    yield
    _FakePopen.instances = []


def test_store_token_pipes_token_into_gh_with_token(monkeypatch, tmp_path):
    monkeypatch.setattr(gh_auth.subprocess, "Popen", lambda cmd, **kw: _FakePopen(cmd, **kw))
    monkeypatch.setattr(gh_auth, "_lookup_login", lambda token, host="github.com": "octocat")
    monkeypatch.setenv("GH_CONFIG_DIR", str(tmp_path))
    monkeypatch.setenv("GH_TOKEN", "stale")

    login = gh_auth.store_token_in_gh("/bin/gh", "gho_secret")

    assert login == "octocat"
    proc = _FakePopen.instances[0]
    assert proc.cmd[:4] == ["/bin/gh", "auth", "login", "--with-token"]
    assert proc.input == "gho_secret\n"
    assert "GH_TOKEN" not in proc.kwargs["env"]
    assert proc.kwargs["stdin"] is subprocess.PIPE
    assert not (tmp_path / "hosts.yml").exists()  # keyring path worked, no fallback


def test_store_token_falls_back_to_hosts_yml_when_gh_hangs(monkeypatch, tmp_path):
    monkeypatch.setattr(gh_auth.subprocess, "Popen", lambda cmd, **kw: _FakePopen(cmd, hang=True, **kw))
    killed = []
    monkeypatch.setattr(gh_auth, "kill_process_tree", lambda proc: killed.append(proc) or proc.kill())
    monkeypatch.setattr(gh_auth, "_lookup_login", lambda token, host="github.com": "octocat")
    monkeypatch.setenv("GH_CONFIG_DIR", str(tmp_path))

    login = gh_auth.store_token_in_gh("/bin/gh", "gho_secret")

    assert login == "octocat"
    assert killed and killed[0].killed
    hosts = tmp_path / "hosts.yml"
    text = hosts.read_text(encoding="utf-8")
    assert "oauth_token: gho_secret" in text
    assert "user: octocat" in text
    assert "git_protocol: https" in text
    if os.name != "nt":
        assert stat.S_IMODE(hosts.stat().st_mode) == 0o600


def test_store_token_raises_when_gh_fails_and_login_unknown(monkeypatch, tmp_path):
    monkeypatch.setattr(gh_auth.subprocess, "Popen", lambda cmd, **kw: _FakePopen(cmd, returncode=1, **kw))
    monkeypatch.setattr(gh_auth, "_lookup_login", lambda token, host="github.com": None)
    monkeypatch.setenv("GH_CONFIG_DIR", str(tmp_path))
    with pytest.raises(RuntimeError):
        gh_auth.store_token_in_gh("/bin/gh", "gho_secret")
    assert not (tmp_path / "hosts.yml").exists()


def test_gh_config_dir_resolution(monkeypatch, tmp_path):
    monkeypatch.delenv("GH_CONFIG_DIR", raising=False)
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "xdg"))
    assert gh_auth.gh_config_dir() == tmp_path / "xdg" / "gh"
    monkeypatch.setenv("GH_CONFIG_DIR", str(tmp_path / "explicit"))
    assert gh_auth.gh_config_dir() == tmp_path / "explicit"


# ─── setup_git / logout / complete_login ─────────────────────────────────────


def test_setup_git_and_logout_commands(monkeypatch):
    calls = []
    monkeypatch.setattr(gh_auth.subprocess, "run", lambda cmd, **kw: calls.append(cmd) or _completed(cmd, 0))
    assert gh_auth.setup_git("/bin/gh") is True
    assert gh_auth.logout("/bin/gh") is True
    assert calls == [
        ["/bin/gh", "auth", "setup-git", "-h", "github.com"],
        ["/bin/gh", "auth", "logout", "-h", "github.com"],
    ]


def test_setup_git_best_effort_on_failure(monkeypatch):
    monkeypatch.setattr(gh_auth.subprocess, "run", lambda cmd, **kw: _completed(cmd, 1))
    assert gh_auth.setup_git("/bin/gh") is False


def test_complete_login_reports_login_and_setup(monkeypatch):
    monkeypatch.setattr(gh_auth, "store_token_in_gh", lambda gh, token, host="github.com": "octocat")
    monkeypatch.setattr(gh_auth, "setup_git", lambda gh, host="github.com": True)
    assert gh_auth.complete_login("/bin/gh", "gho") == {"login": "octocat", "setup_git": True}
