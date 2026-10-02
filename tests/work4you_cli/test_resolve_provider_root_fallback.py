"""``resolve_provider("auto")`` and the global-root ``active_provider`` fallback.

In profile mode a profile's provider STATE already falls back to the
global-root ``auth.json`` (``_load_provider_state``); the selection key
``active_provider`` did not, so a fresh profile under a signed-in root failed
with "No inference provider configured". These tests drive the real stores on
disk — only the network-bound status probe and the AWS credential chain are
stubbed.
"""

import json
from pathlib import Path

import pytest

from work4you_cli.auth import PROVIDER_REGISTRY, AuthError, resolve_provider

_EXTRA_ENV = (
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_BASE_URL",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_PROFILE",
    "AWS_DEFAULT_REGION",
    "AWS_REGION",
)


@pytest.fixture(autouse=True)
def _quiet_environment(monkeypatch):
    for cfg in PROVIDER_REGISTRY.values():
        for var in cfg.api_key_env_vars:
            monkeypatch.delenv(var, raising=False)
    for var in _EXTRA_ENV:
        monkeypatch.delenv(var, raising=False)
    try:
        import agent.bedrock_adapter as bedrock

        monkeypatch.setattr(bedrock, "has_aws_credentials", lambda: False)
    except Exception:
        pass
    # The real status probe refreshes Portal tokens over the network.
    monkeypatch.setattr(
        "work4you_cli.auth.get_auth_status",
        lambda provider_id=None: {"logged_in": provider_id in {"work4you", "xai-oauth"}},
    )


def _write_store(path: Path, active: str | None, providers: dict | None = None) -> None:
    store = {"version": 1, "providers": providers or {}}
    if active:
        store["active_provider"] = active
    path.write_text(json.dumps(store), encoding="utf-8")


@pytest.fixture
def profile_home(tmp_path, monkeypatch):
    """A ``<root>/profiles/<name>`` layout, which is what makes it profile mode."""
    root = tmp_path / "root"
    profile = root / "profiles" / "fresh"
    profile.mkdir(parents=True)
    monkeypatch.setenv("WORK4YOU_HOME", str(profile))
    return root, profile


def test_fresh_profile_resolves_the_root_login(profile_home):
    root, _profile = profile_home
    _write_store(root / "auth.json", "work4you", {"work4you": {"access_token": "tok"}})

    assert resolve_provider("auto") == "work4you"


def test_the_profile_own_active_provider_wins_over_the_root(profile_home):
    root, profile = profile_home
    _write_store(root / "auth.json", "work4you", {"work4you": {"access_token": "tok"}})
    _write_store(profile / "auth.json", "xai-oauth", {"xai-oauth": {"access_token": "x"}})

    assert resolve_provider("auto") == "xai-oauth"


def test_a_root_without_active_provider_still_reports_no_provider(profile_home):
    root, _profile = profile_home
    _write_store(root / "auth.json", None, {"work4you": {"access_token": "tok"}})

    with pytest.raises(AuthError) as excinfo:
        resolve_provider("auto")
    assert getattr(excinfo.value, "code", None) == "no_provider_configured"


def test_classic_mode_has_no_root_to_fall_back_to(tmp_path, monkeypatch):
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("WORK4YOU_HOME", str(home))

    with pytest.raises(AuthError) as excinfo:
        resolve_provider("auto")
    assert getattr(excinfo.value, "code", None) == "no_provider_configured"
