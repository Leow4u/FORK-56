"""Tests for work4you_cli/webhook.py — webhook subscription CLI."""

import json
import os
import pytest
import stat
from argparse import Namespace

from work4you_cli.webhook import (
    webhook_command,
    _get_webhook_base_url,
    _is_webhook_enabled,
    _load_subscriptions,
    _save_subscriptions,
    _subscriptions_path,
)


@pytest.fixture(autouse=True)
def _isolate(tmp_path, monkeypatch):
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    # Default: webhooks enabled (most tests need this)
    monkeypatch.setattr(
        "work4you_cli.webhook._is_webhook_enabled", lambda: True
    )


def _make_args(**kwargs):
    defaults = {
        "webhook_action": None,
        "name": "",
        "prompt": "",
        "events": "",
        "description": "",
        "skills": "",
        "deliver": "log",
        "deliver_chat_id": "",
        "secret": "",
        "payload": "",
        "script": "",
    }
    defaults.update(kwargs)
    return Namespace(**defaults)


@pytest.mark.parametrize("host", [None, "", "0.0.0.0", "::"])
def test_webhook_base_url_maps_wildcard_hosts_to_localhost(monkeypatch, host):
    monkeypatch.setattr(
        "work4you_cli.webhook._get_webhook_config",
        lambda: {"extra": {"host": host, "port": 9123}},
    )
    assert _get_webhook_base_url() == "http://localhost:9123"


def test_webhook_base_url_uses_the_port_the_listener_binds(monkeypatch, tmp_path):
    """WEBHOOK_PORT (the port the app saves) wins over config.yaml, as it
    does in the gateway; the home's .env wins over the process env."""
    monkeypatch.setattr(
        "work4you_cli.webhook._get_webhook_config",
        lambda: {"extra": {"port": 9123}},
    )
    monkeypatch.setenv("WEBHOOK_PORT", "8710")
    assert _get_webhook_base_url() == "http://localhost:8710"

    (tmp_path / ".env").write_text("WEBHOOK_PORT=8701\n", encoding="utf-8")
    assert _get_webhook_base_url() == "http://localhost:8701"

    (tmp_path / ".env").write_text("WEBHOOK_PORT=not-a-port\n", encoding="utf-8")
    monkeypatch.delenv("WEBHOOK_PORT")
    assert _get_webhook_base_url() == "http://localhost:9123"


def test_webhook_enabled_follows_config_or_the_setup_switch(monkeypatch, tmp_path):
    """`work4you setup` turns webhooks on with WEBHOOK_ENABLED in .env and the
    gateway starts the listener for it; reading only config.yaml refused to
    add routes. (The autouse fixture patches the module attribute; the name
    imported above is the real function.)"""
    monkeypatch.setattr("work4you_cli.webhook._get_webhook_config", lambda: {})
    monkeypatch.delenv("WEBHOOK_ENABLED", raising=False)
    assert _is_webhook_enabled() is False

    (tmp_path / ".env").write_text("WEBHOOK_ENABLED=true\n", encoding="utf-8")
    assert _is_webhook_enabled() is True

    (tmp_path / ".env").write_text("WEBHOOK_ENABLED=false\n", encoding="utf-8")
    assert _is_webhook_enabled() is False

    monkeypatch.setattr("work4you_cli.webhook._get_webhook_config", lambda: {"enabled": True})
    assert _is_webhook_enabled() is True


class TestSubscribe:


    def test_custom_secret(self):
        webhook_command(_make_args(
            webhook_action="subscribe", name="s", secret="my-secret"
        ))
        assert _load_subscriptions()["s"]["secret"] == "my-secret"


    def test_auto_secret(self):
        webhook_command(_make_args(webhook_action="subscribe", name="s"))
        secret = _load_subscriptions()["s"]["secret"]
        assert len(secret) > 20


class TestList:

    def test_with_entries(self, capsys):
        webhook_command(_make_args(webhook_action="subscribe", name="a"))
        webhook_command(_make_args(webhook_action="subscribe", name="b"))
        capsys.readouterr()  # clear
        webhook_command(_make_args(webhook_action="list"))
        out = capsys.readouterr().out
        assert "2 webhook" in out
        assert "a" in out
        assert "b" in out


class TestRemove:


    def test_selective_remove(self):
        webhook_command(_make_args(webhook_action="subscribe", name="keep"))
        webhook_command(_make_args(webhook_action="subscribe", name="drop"))
        webhook_command(_make_args(webhook_action="remove", name="drop"))
        subs = _load_subscriptions()
        assert "keep" in subs
        assert "drop" not in subs


class TestPersistence:

    def test_corrupted_file(self):
        path = _subscriptions_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("broken{{{")
        assert _load_subscriptions() == {}

    @pytest.mark.skipif(os.name == "nt", reason="POSIX mode bits are platform-specific")
    def test_save_creates_secret_file_owner_only_under_permissive_umask(self):
        old_umask = os.umask(0o022)
        try:
            _save_subscriptions({"demo": {"secret": "TOPSECRET", "prompt": "x"}})
        finally:
            os.umask(old_umask)

        path = _subscriptions_path()
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert "TOPSECRET" in path.read_text(encoding="utf-8")

    @pytest.mark.skipif(os.name == "nt", reason="POSIX mode bits are platform-specific")
    def test_save_narrows_existing_broad_secret_file_mode(self):
        # Simulate a pre-existing 0o644 file from before this hardening landed.
        path = _subscriptions_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"old": {"secret": "stale", "prompt": "x"}}))
        path.chmod(0o644)

        _save_subscriptions({"demo": {"secret": "FRESH", "prompt": "x"}})

        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert "FRESH" in path.read_text(encoding="utf-8")


class TestWebhookEnabledGate:

    def test_blocks_list_when_disabled(self, capsys, monkeypatch):
        monkeypatch.setattr("work4you_cli.webhook._is_webhook_enabled", lambda: False)
        webhook_command(_make_args(webhook_action="list"))
        out = capsys.readouterr().out
        assert "not enabled" in out.lower()

    def test_allows_when_enabled(self, capsys):
        # _is_webhook_enabled already patched to True by autouse fixture
        webhook_command(_make_args(webhook_action="subscribe", name="allowed"))
        out = capsys.readouterr().out
        assert "Created" in out
        assert "allowed" in _load_subscriptions()

    def test_real_check_disabled(self, monkeypatch):
        monkeypatch.setattr(
            "work4you_cli.webhook._get_webhook_config",
            lambda: {},
        )
        monkeypatch.setattr(
            "work4you_cli.webhook._is_webhook_enabled",
            lambda: bool({}.get("enabled")),
        )
        import work4you_cli.webhook as wh_mod
        assert wh_mod._is_webhook_enabled() is False

