"""``work4you.anthropic_wire`` selects the Portal route for ``anthropic/*``: ``chat`` (default) rides
/v1/chat/completions, ``native`` rides /v1/messages. Read through the real config loader against a
temp WORK4YOU_HOME (the loader is keyed on config path + mtime, so a fresh home is a fresh read), and
through ``resolve_runtime_provider`` so the api_mode a live agent gets is what is asserted."""
from __future__ import annotations

import pytest

from work4you_cli import providers as _providers
from work4you_cli import runtime_provider as rp

PORTAL = "https://inference-api.work4you.ai/v1"


def _cfg(tmp_path, body: str, monkeypatch):
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    (tmp_path / "config.yaml").write_text(body, encoding="utf-8")


def _portal_creds(monkeypatch):
    monkeypatch.setattr(rp, "resolve_work4you_runtime_credentials",
                        lambda **kw: {"base_url": PORTAL, "api_key": "jwt", "source": "portal", "expires_at": None})
    monkeypatch.setattr(rp, "_get_model_config", lambda: {"provider": "work4you"})


def test_default_is_chat_for_anthropic_and_unchanged_for_everything_else(tmp_path, monkeypatch):
    _cfg(tmp_path, "model:\n  default: anthropic/claude-fable-5\n", monkeypatch)
    assert _providers.work4you_api_mode("anthropic/claude-fable-5") == "chat_completions"
    assert _providers.work4you_api_mode("openai/gpt-5.6-sol") == "chat_completions"
    assert _providers.determine_api_mode("work4you", PORTAL, "anthropic/claude-fable-5") == "chat_completions"


def test_native_opt_in_restores_the_messages_wire_for_anthropic_only(tmp_path, monkeypatch):
    _cfg(tmp_path, "work4you:\n  anthropic_wire: native\n", monkeypatch)
    assert _providers.work4you_api_mode("anthropic/claude-fable-5") == "anthropic_messages"
    assert _providers.work4you_api_mode("openai/gpt-5.6-sol") == "chat_completions"


@pytest.mark.parametrize("raw", ["''", "CHAT", "messages", "true", "1", "auto"])
def test_anything_but_native_reads_as_chat(tmp_path, monkeypatch, raw):
    _cfg(tmp_path, f"work4you:\n  anthropic_wire: {raw}\n", monkeypatch)
    assert _providers.work4you_api_mode("anthropic/claude-fable-5") == "chat_completions"


def test_runtime_resolution_hands_a_live_agent_the_selected_wire(tmp_path, monkeypatch):
    """The path an AIAgent takes: provider=work4you + anthropic model -> api_mode, both settings."""
    _portal_creds(monkeypatch)
    _cfg(tmp_path, "model:\n  provider: work4you\n", monkeypatch)
    resolved = rp.resolve_runtime_provider(requested="work4you", target_model="anthropic/claude-fable-5")
    assert (resolved["api_mode"], resolved["base_url"]) == ("chat_completions", PORTAL)

    _cfg(tmp_path, "model:\n  provider: work4you\nwork4you:\n  anthropic_wire: native\n", monkeypatch)
    resolved = rp.resolve_runtime_provider(requested="work4you", target_model="anthropic/claude-fable-5")
    assert resolved["api_mode"] == "anthropic_messages"
