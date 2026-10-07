"""Persist platform home channels from dashboard / onboarding writes."""

from __future__ import annotations

from gateway.config import HomeChannel, Platform, persist_home_channel
from gateway.run import _home_target_env_var, _home_thread_env_var
from work4you_cli.config import save_env_value


def save_messaging_home_channel(
    platform_id: str,
    *,
    chat_id: str,
    name: str | None = None,
    user_id: str | None = None,
    thread_id: str | None = None,
) -> None:
    """Write config.yaml home_channel and the legacy *_HOME_* env mirror."""
    normalized_id = str(chat_id or "").strip()
    if not normalized_id:
        raise ValueError("home channel chat_id is required")
    try:
        platform = Platform(platform_id)
    except ValueError as exc:
        raise ValueError(f"Unknown platform: {platform_id}") from exc

    display = (name or "").strip() or normalized_id
    home = HomeChannel(
        platform=platform,
        chat_id=normalized_id,
        name=display,
        thread_id=str(thread_id).strip() if thread_id else None,
        user_id=str(user_id).strip() if user_id else None,
    )
    persist_home_channel(home, enabled_if_new=True)

    save_env_value(_home_target_env_var(platform_id), normalized_id)
    if thread_id:
        save_env_value(_home_thread_env_var(platform_id), str(thread_id).strip())

    if platform_id == "email" and name:
        save_env_value("EMAIL_HOME_ADDRESS_NAME", display)
