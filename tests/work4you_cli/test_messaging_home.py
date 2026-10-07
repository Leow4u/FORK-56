"""Tests for dashboard messaging home-channel persistence."""

import pytest
from fastapi import HTTPException

from work4you_cli.messaging_home import save_messaging_home_channel


def test_save_messaging_home_channel_writes_config_and_env(monkeypatch):
    persisted = []
    saved_env = {}

    monkeypatch.setattr(
        "work4you_cli.messaging_home.persist_home_channel",
        lambda home, **kwargs: persisted.append((home, kwargs)),
    )
    monkeypatch.setattr(
        "work4you_cli.messaging_home.save_env_value",
        lambda key, value: saved_env.__setitem__(key, value),
    )

    save_messaging_home_channel(
        "telegram",
        chat_id="4242",
        name="Carla",
        user_id="4242",
    )

    assert len(persisted) == 1
    home, kwargs = persisted[0]
    assert home.chat_id == "4242"
    assert home.name == "Carla"
    assert kwargs.get("enabled_if_new") is True
    assert saved_env.get("TELEGRAM_HOME_CHANNEL") == "4242"


def test_persist_messaging_home_rejects_email_outside_allowlist():
    from work4you_cli import web_server as ws
    from work4you_cli.web_models import MessagingHomeChannelWrite

    home = MessagingHomeChannelWrite(chat_id="other@example.com", name="other@example.com")

    with pytest.raises(HTTPException) as exc:
        ws._persist_messaging_home_from_setup(
            "email",
            home,
            allowed_emails=["ana@example.com"],
        )

    assert exc.value.status_code == 400


def test_persist_messaging_home_accepts_allowed_email(monkeypatch):
    from work4you_cli import web_server as ws
    from work4you_cli.web_models import MessagingHomeChannelWrite

    calls = []
    monkeypatch.setattr(
        "work4you_cli.messaging_home.save_messaging_home_channel",
        lambda *args, **kwargs: calls.append((args, kwargs)),
    )

    home = MessagingHomeChannelWrite(chat_id="Ana@Example.com", name="Ana")
    ws._persist_messaging_home_from_setup(
        "email",
        home,
        allowed_emails=["ana@example.com"],
    )

    assert len(calls) == 1
    assert calls[0][0][0] == "email"
    assert calls[0][1]["chat_id"] == "Ana@Example.com"
