"""A client that knows the spoken language passes it with the audio.

The configured hint (``stt.language``) defaults to English, and Whisper told
to expect English translates other speech into English: the desktop's
Portuguese dictation came back as English text, and the agent answered (and
spoke) in English. The caller's language wins over the configured hint.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import yaml

from tools import transcription_tools


def _openai_wire_language(tmp_path, monkeypatch, **kwargs):
    """The ``language`` the OpenAI SDK call carries (config hint: English)."""
    audio = tmp_path / "voice.ogg"
    audio.write_bytes(b"fake audio data")
    monkeypatch.setenv("VOICE_TOOLS_OPENAI_KEY", "sk-test")
    monkeypatch.setattr("work4you_cli.plugins.has_hook", lambda name: False)

    client = MagicMock()
    client.audio.transcriptions.create.return_value = "olá"
    stt_config = {"provider": "openai", "language": "en"}

    with patch("tools.transcription_tools._load_stt_config", return_value=stt_config), \
         patch("tools.transcription_tools._get_provider", return_value="openai"), \
         patch("tools.transcription_tools._HAS_OPENAI", True), \
         patch("openai.OpenAI", return_value=client):
        result = transcription_tools.transcribe_audio(str(audio), **kwargs)

    assert result["success"] is True
    return client.audio.transcriptions.create.call_args.kwargs.get("language")


def test_the_callers_language_wins_over_the_configured_hint(tmp_path, monkeypatch):
    assert _openai_wire_language(tmp_path, monkeypatch, language="pt") == "pt"


def test_without_one_the_configured_hint_still_applies(tmp_path, monkeypatch):
    assert _openai_wire_language(tmp_path, monkeypatch) == "en"


def test_a_voice_recording_carries_it_to_the_provider_call():
    import tools.voice_mode as voice_mode

    transcribe = MagicMock(return_value={"success": True, "transcript": "olá, tudo bem?"})
    with patch("tools.transcription_tools.transcribe_audio", transcribe):
        result = voice_mode.transcribe_recording("/tmp/fake.wav", language="pt")

    assert result["transcript"] == "olá, tudo bem?"
    assert transcribe.call_args.kwargs["language"] == "pt"


def _write_config(config):
    from work4you_constants import get_work4you_home

    home = get_work4you_home()
    home.mkdir(parents=True, exist_ok=True)
    (home / "config.yaml").write_text(yaml.safe_dump(config), encoding="utf-8")


@pytest.mark.parametrize(
    "stt",
    [
        {"language": "pt"},
        {"language": ""},  # asks every provider to auto-detect
        {"openai": {"language": "de"}},
        {"elevenlabs": {"language_code": "por"}},
        {"providers": {"whisper-cli": {"type": "command", "language": "pt"}}},
    ],
)
def test_a_language_the_user_set_beats_the_app_language(stt):
    _write_config({"stt": stt})

    assert transcription_tools.client_stt_language(None, "pt") is None
    # One picked in the app is still binding.
    assert transcription_tools.client_stt_language("es", "pt") == "es"


@pytest.mark.parametrize(
    "config",
    [
        {},
        {"stt": {"provider": "openai"}},
        {"stt": {"openai": {"language": ""}}},  # blank defers to stt.language
    ],
)
def test_the_app_language_replaces_the_shipped_default(config):
    _write_config(config)

    assert transcription_tools.client_stt_language(None, "pt") == "pt"
    assert transcription_tools.client_stt_language("es", "pt") == "es"
    assert transcription_tools.client_stt_language(None, None) is None


def test_a_settings_save_does_not_make_the_shipped_default_a_choice():
    """The desktop's settings page saves the whole merged record, which
    carries ``stt.language: en``; that must not read as the user's pick."""
    from work4you_cli.config import load_config, save_config

    _write_config({"stt": {"echo_transcripts": False}})
    config = load_config()
    assert config["stt"]["language"] == "en"

    save_config(config)

    assert transcription_tools.client_stt_language(None, "pt") == "pt"


def test_a_language_an_administrator_pinned_beats_the_app(tmp_path, monkeypatch):
    from work4you_cli import managed_scope

    managed = tmp_path / "managed"
    managed.mkdir()
    (managed / "config.yaml").write_text(
        yaml.safe_dump({"stt": {"language": "de"}}), encoding="utf-8"
    )
    monkeypatch.setenv("WORK4YOU_MANAGED_DIR", str(managed))
    managed_scope.invalidate_managed_cache()
    _write_config({})

    assert transcription_tools.client_stt_language("es", "pt") is None
    assert transcription_tools.client_stt_language(None, "pt") is None
