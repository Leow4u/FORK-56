"""Tests for normalized Work4You Portal account entitlement helpers."""

from __future__ import annotations

import base64
import json
import time
import urllib.error
from typing import Any

import pytest

from work4you_cli.work4you_account import (
    Work4YouPaidServiceAccessInfo,
    Work4YouPortalAccountInfo,
    Work4YouPortalSubscriptionInfo,
    format_work4you_portal_entitlement_message,
    get_work4you_portal_account_info,
    get_work4you_portal_identity,
    is_work4you_free_plan,
    work4you_portal_topup_url,
    reset_work4you_portal_account_info_cache,
    reset_work4you_portal_identity_cache,
)


def _jwt(claims: dict[str, Any]) -> str:
    def _part(payload: dict[str, Any]) -> str:
        raw = json.dumps(payload, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    return f"{_part({'alg': 'none', 'typ': 'JWT'})}.{_part(claims)}.sig"


def _state(token: str) -> dict[str, Any]:
    return {
        "access_token": token,
        "portal_base_url": "https://portal.example.test",
        "client_id": "work4you-cli",
    }


def _account_payload(
    *,
    allowed: bool,
    subscription: dict[str, Any] | None,
    subscription_credits: float,
    purchased_credits: float,
    member_spend_cap_exceeded: bool | None = None,
    member_spend_cap_usd: float | str | None = None,
    member_spend_usd: float | str | None = None,
    member_spend_cap_remaining_usd: float | str | None = None,
) -> dict[str, Any]:
    psa: dict[str, Any] = {
        "allowed": allowed,
        "paid_access": allowed,
        "reason": "usable_credits" if allowed else "no_usable_credits",
        "organisation_id": "org_123",
        "effective_at_ms": 123456789,
        "has_active_subscription": subscription is not None,
        "active_subscription_is_paid": bool(
            subscription and subscription.get("monthly_charge", 0) > 0
        ),
        "subscription_tier": subscription.get("tier") if subscription else None,
        "subscription_monthly_charge": (
            subscription.get("monthly_charge") if subscription else None
        ),
        "subscription_credits_remaining": subscription_credits,
        "purchased_credits_remaining": purchased_credits,
        "total_usable_credits": subscription_credits + purchased_credits,
    }
    if member_spend_cap_exceeded is not None:
        psa["member_spend_cap_exceeded"] = member_spend_cap_exceeded
        psa["reason"] = "member_spend_cap_exceeded"
    if member_spend_cap_usd is not None:
        psa["member_spend_cap_usd"] = member_spend_cap_usd
    if member_spend_usd is not None:
        psa["member_spend_usd"] = member_spend_usd
    if member_spend_cap_remaining_usd is not None:
        psa["member_spend_cap_remaining_usd"] = member_spend_cap_remaining_usd
    return {
        "user": {
            "email": "alice@example.test",
            "privy_did": "did:privy:alice",
        },
        "organisation": {
            "id": "org_123",
        },
        "subscription": subscription,
        "purchased_credits_remaining": purchased_credits,
        "paid_service_access": psa,
    }


@pytest.fixture(autouse=True)
def _reset_cache():
    reset_work4you_portal_account_info_cache()
    yield
    reset_work4you_portal_account_info_cache()






@pytest.mark.parametrize(
    ("payload", "expected_paid"),
    [
        (
            _account_payload(
                allowed=True,
                subscription={
                    "plan": "Tier 2",
                    "tier": 2,
                    "monthly_charge": 20,
                    "current_period_end": "2026-05-01T00:00:00.000Z",
                    "credits_remaining": 12.25,
                    "rollover_credits": 3.5,
                },
                subscription_credits=12.25,
                purchased_credits=7.75,
            ),
            True,
        ),
        (
            _account_payload(
                allowed=False,
                subscription={
                    "plan": "Tier 2",
                    "tier": 2,
                    "monthly_charge": 20,
                    "current_period_end": "2026-05-01T00:00:00.000Z",
                    "credits_remaining": 0,
                    "rollover_credits": 0,
                },
                subscription_credits=0,
                purchased_credits=0,
            ),
            False,
        ),
        (
            _account_payload(
                allowed=True,
                subscription=None,
                subscription_credits=0,
                purchased_credits=7.75,
            ),
            True,
        ),
        (
            _account_payload(
                allowed=False,
                subscription=None,
                subscription_credits=0,
                purchased_credits=0,
            ),
            False,
        ),
    ],
)
def test_fresh_account_payload_normalization(monkeypatch, payload, expected_paid):
    token = _jwt({"sub": "user_123", "org_id": "org_123", "exp": int(time.time()) + 900})
    monkeypatch.setattr("work4you_cli.auth.get_provider_auth_state", lambda provider: _state(token))
    monkeypatch.setattr("work4you_cli.auth.resolve_work4you_access_token", lambda: "fresh-token")
    monkeypatch.setattr("work4you_cli.work4you_account._fetch_work4you_account_info", lambda *a, **kw: payload)

    info = get_work4you_portal_account_info(force_fresh=True)

    assert isinstance(info, Work4YouPortalAccountInfo)
    assert info.source == "account_api"
    assert info.fresh is True
    assert info.email == "alice@example.test"
    assert info.privy_did == "did:privy:alice"
    assert info.org_id == "org_123"
    assert info.paid_service_access is expected_paid
    assert info.is_paid is expected_paid
    assert info.is_free_tier is (not expected_paid)


def test_no_oauth_token_reports_inference_key_present(monkeypatch):
    monkeypatch.setattr("work4you_cli.auth.get_provider_auth_state", lambda provider: {})

    class _Entry:
        label = "manual-work4you"
        access_token = ""
        agent_key = "opaque-runtime-key"
        agent_key_expires_at = "2099-01-01T00:00:00+00:00"
        expires_at = None
        inference_base_url = "https://inference.example.test/v1"
        base_url = "https://inference.example.test/v1"
        priority = 0

        @property
        def runtime_api_key(self):
            return self.agent_key

        @property
        def runtime_base_url(self):
            return self.inference_base_url

    class _Pool:
        def has_credentials(self):
            return True

        def entries(self):
            return [_Entry()]

    monkeypatch.setattr("agent.credential_pool.load_pool", lambda provider: _Pool())

    info = get_work4you_portal_account_info()

    assert info.logged_in is False
    assert info.source == "inference_key"
    assert info.inference_credential_present is True
    assert info.credential_source == "pool:manual-work4you"
    assert info.paid_service_access is None


def test_pool_oauth_entry_force_fresh_uses_account_api(monkeypatch):
    token = _jwt(
        {
            "sub": "user_123",
            "org_id": "org_123",
            "exp": int(time.time()) + 900,
            "paid_access": False,
        }
    )
    payload = _account_payload(
        allowed=True,
        subscription=None,
        subscription_credits=0,
        purchased_credits=3,
    )
    monkeypatch.setattr("work4you_cli.auth.get_provider_auth_state", lambda provider: {})
    monkeypatch.setattr("work4you_cli.work4you_account._fetch_work4you_account_info", lambda *a, **kw: payload)

    class _Entry:
        label = "dashboard device_code"
        auth_type = "oauth"
        access_token = token
        refresh_token = "refresh-token"
        agent_key = "opaque-runtime-key"
        agent_key_expires_at = "2099-01-01T00:00:00+00:00"
        expires_at = "2099-01-01T00:00:00+00:00"
        portal_base_url = "https://portal.example.test"
        inference_base_url = "https://inference.example.test/v1"
        base_url = "https://inference.example.test/v1"
        priority = 0

        @property
        def runtime_api_key(self):
            return self.agent_key

        @property
        def runtime_base_url(self):
            return self.inference_base_url

    class _Pool:
        def has_credentials(self):
            return True

        def entries(self):
            return [_Entry()]

    monkeypatch.setattr("agent.credential_pool.load_pool", lambda provider: _Pool())

    info = get_work4you_portal_account_info(force_fresh=True)

    assert info.logged_in is True
    assert info.source == "account_api"
    assert info.fresh is True
    assert info.paid_service_access is True
    assert info.credential_source == "pool:dashboard device_code"


def test_is_work4you_free_plan_positive_and_paid():
    free = Work4YouPortalAccountInfo(
        logged_in=True,
        source="account_api",
        fresh=True,
        subscription=Work4YouPortalSubscriptionInfo(plan="Free", tier=0, monthly_charge=0, monthly_credits=5),
        paid_service_access=True,
        paid_service_access_info=Work4YouPaidServiceAccessInfo(
            subscription_tier=0,
            active_subscription_is_paid=False,
            subscription_monthly_charge=0,
        ),
    )
    plus = Work4YouPortalAccountInfo(
        logged_in=True,
        source="account_api",
        fresh=True,
        subscription=Work4YouPortalSubscriptionInfo(plan="Plus", tier=1, monthly_charge=20, monthly_credits=22),
        paid_service_access=True,
        paid_service_access_info=Work4YouPaidServiceAccessInfo(
            subscription_tier=1,
            active_subscription_is_paid=True,
            subscription_monthly_charge=20,
        ),
    )
    assert is_work4you_free_plan(free) is True
    assert is_work4you_free_plan(plus) is False
    assert is_work4you_free_plan(None) is False


def test_free_plan_entitlement_message_hides_dollars():
    info = Work4YouPortalAccountInfo(
        logged_in=True,
        source="account_api",
        fresh=True,
        portal_base_url="https://portal.example.test",
        subscription=Work4YouPortalSubscriptionInfo(plan="Free", tier=0, monthly_credits=5),
        paid_service_access=False,
        paid_service_access_info=Work4YouPaidServiceAccessInfo(
            allowed=False,
            reason="no_usable_credits",
            has_active_subscription=False,
            active_subscription_is_paid=False,
            subscription_tier=0,
            subscription_credits_remaining=0,
            purchased_credits_remaining=0,
            total_usable_credits=0,
        ),
    )
    msg = format_work4you_portal_entitlement_message(info, capability="Work4You model access")
    assert msg is not None
    assert "Free allowance is used for this cycle" in msg
    assert "resumes next month" in msg
    assert "$" not in msg
    assert "top up" not in msg.lower()


# ── member spend cap exceeded ───────────────────────────────────────────────


def test_member_spend_cap_exceeded_message(monkeypatch):
    """When the Portal returns member_spend_cap_exceeded, the entitlement
    message should explain the cap — not say 'no credits'."""
    payload = _account_payload(
        allowed=False,
        subscription=None,
        subscription_credits=0,
        purchased_credits=222990.17,
        member_spend_cap_exceeded=True,
        member_spend_cap_usd="500",
        member_spend_usd="520.51",
        member_spend_cap_remaining_usd="0",
    )
    token = _jwt({"sub": "user_123", "org_id": "org_123", "exp": int(time.time()) + 900})
    monkeypatch.setattr("work4you_cli.auth.get_provider_auth_state", lambda provider: _state(token))
    monkeypatch.setattr("work4you_cli.auth.resolve_work4you_access_token", lambda: "fresh-token")
    monkeypatch.setattr("work4you_cli.work4you_account._fetch_work4you_account_info", lambda *a, **kw: payload)

    info = get_work4you_portal_account_info(force_fresh=True)

    assert info.paid_service_access is False
    assert info.paid_service_access_info is not None
    assert info.paid_service_access_info.member_spend_cap_exceeded is True
    assert info.paid_service_access_info.member_spend_cap_usd == 500.0
    assert info.paid_service_access_info.member_spend_usd == 520.51

    msg = format_work4you_portal_entitlement_message(info, capability="Work4You model access")
    assert msg is not None
    # Must mention spend cap, not "no active subscription or usable credits"
    assert "spend cap" in msg
    assert "$500.00" in msg
    assert "$520.51" in msg
    # Should NOT say "no active subscription"
    assert "no active subscription" not in msg
    # Should still show available credits
    assert "$222990.17" in msg


def test_member_spend_cap_exceeded_without_amounts(monkeypatch):
    """Even if the Portal doesn't include cap/spend amounts, the message
    should still mention the spend cap rather than credits."""
    payload = _account_payload(
        allowed=False,
        subscription=None,
        subscription_credits=0,
        purchased_credits=100,
        member_spend_cap_exceeded=True,
    )
    token = _jwt({"sub": "user_123", "org_id": "org_123", "exp": int(time.time()) + 900})
    monkeypatch.setattr("work4you_cli.auth.get_provider_auth_state", lambda provider: _state(token))
    monkeypatch.setattr("work4you_cli.auth.resolve_work4you_access_token", lambda: "fresh-token")
    monkeypatch.setattr("work4you_cli.work4you_account._fetch_work4you_account_info", lambda *a, **kw: payload)

    info = get_work4you_portal_account_info(force_fresh=True)
    msg = format_work4you_portal_entitlement_message(info, capability="Work4You model access")
    assert msg is not None
    assert "spend cap" in msg
    assert "no active subscription" not in msg




# ── org slug/name parsing + top-up URL builder ──────────────────────────────


# ── account menu identity (one login for agent and menu) ────────────────────


@pytest.fixture
def identity_cache():
    reset_work4you_portal_identity_cache()
    yield
    reset_work4you_portal_identity_cache()


def _local_login(token: str) -> dict[str, Any]:
    return {
        "logged_in": True,
        "access_token": token,
        "portal_base_url": "https://portal.example.test",
    }


def test_identity_reads_name_and_email_with_the_agent_login(monkeypatch, identity_cache):
    token = _jwt({"sub": "did:privy:ada", "exp": int(time.time()) + 900})
    calls: list[tuple[str, Any]] = []

    def profile(access_token, portal_base_url=None):
        calls.append((access_token, portal_base_url))
        return {"firstName": " Ada ", "lastName": "Lovelace", "email": "ada@example.test"}

    monkeypatch.setattr("work4you_cli.auth.get_work4you_auth_status_local", lambda: _local_login(token))
    monkeypatch.setattr("work4you_cli.auth.resolve_work4you_access_token", lambda: "agent-token")
    monkeypatch.setattr("work4you_cli.work4you_account._fetch_work4you_account_profile", profile)

    assert get_work4you_portal_identity() == {
        "logged_in": True,
        "email": "ada@example.test",
        "name": "Ada Lovelace",
        "first_name": "Ada",
        "last_name": "Lovelace",
        "portal_url": "https://portal.example.test",
    }
    assert calls == [("agent-token", "https://portal.example.test")]


def test_identity_name_needs_both_cadastro_parts(monkeypatch, identity_cache):
    token = _jwt({"sub": "did:privy:ada"})
    monkeypatch.setattr("work4you_cli.auth.get_work4you_auth_status_local", lambda: _local_login(token))
    monkeypatch.setattr("work4you_cli.auth.resolve_work4you_access_token", lambda: "agent-token")
    monkeypatch.setattr(
        "work4you_cli.work4you_account._fetch_work4you_account_profile",
        lambda *a, **kw: {"firstName": "Ada", "lastName": " ", "email": "ada@example.test"},
    )

    identity = get_work4you_portal_identity()
    assert identity["name"] is None
    assert identity["first_name"] is None
    assert identity["last_name"] is None


def test_identity_cache_hit_never_resolves_a_token(monkeypatch, identity_cache):
    """Polling the menu must not refresh: a refreshed token for the same
    person still hits the cache, even when the stored token has expired."""
    stored = iter(
        [
            _jwt({"sub": "did:privy:ada", "jti": "first", "exp": int(time.time()) + 900}),
            _jwt({"sub": "did:privy:ada", "jti": "refreshed", "exp": int(time.time()) - 60}),
        ]
    )
    resolves: list[int] = []

    def resolve():
        resolves.append(1)
        return "agent-token"

    monkeypatch.setattr("work4you_cli.auth.get_work4you_auth_status_local", lambda: _local_login(next(stored)))
    monkeypatch.setattr("work4you_cli.auth.resolve_work4you_access_token", resolve)
    monkeypatch.setattr(
        "work4you_cli.work4you_account._fetch_work4you_account_profile",
        lambda *a, **kw: {"email": "ada@example.test"},
    )

    first = get_work4you_portal_identity()
    second = get_work4you_portal_identity()

    assert first == second == {
        "logged_in": True,
        "email": "ada@example.test",
        "name": None,
        "first_name": None,
        "last_name": None,
        "portal_url": "https://portal.example.test",
    }
    assert len(resolves) == 1


def test_identity_falls_back_to_the_login_email(monkeypatch, identity_cache):
    """A Portal that refuses the agent login on /api/account still maps the
    same login to its email on /api/oauth/account."""
    token = _jwt({"sub": "did:privy:ada"})

    def refuse(*a, **kw):
        raise urllib.error.HTTPError("https://portal.example.test/api/account", 401, "unauthorized", None, None)

    monkeypatch.setattr("work4you_cli.auth.get_work4you_auth_status_local", lambda: _local_login(token))
    monkeypatch.setattr("work4you_cli.auth.resolve_work4you_access_token", lambda: "agent-token")
    monkeypatch.setattr("work4you_cli.work4you_account._fetch_work4you_account_profile", refuse)
    monkeypatch.setattr(
        "work4you_cli.work4you_account._fetch_work4you_account_info",
        lambda *a, **kw: {"user": {"email": "ada@example.test", "privy_did": "did:privy:ada"}},
    )

    assert get_work4you_portal_identity() == {
        "logged_in": True,
        "email": "ada@example.test",
        "name": None,
        "first_name": None,
        "last_name": None,
        "portal_url": "https://portal.example.test",
    }


def test_identity_without_a_login_makes_no_portal_call(monkeypatch, identity_cache):
    def no_call(*a, **kw):
        raise AssertionError("no Portal call without a login")

    monkeypatch.setattr("work4you_cli.auth.get_work4you_auth_status_local", lambda: {"logged_in": False})
    monkeypatch.setattr("work4you_cli.auth.resolve_work4you_access_token", no_call)
    monkeypatch.setattr("work4you_cli.work4you_account._fetch_work4you_account_profile", no_call)

    assert get_work4you_portal_identity() == {"logged_in": False, "email": None, "name": None}
