"""Tests for build_work4you_credits_snapshot (L6-A, magnitudes-only)."""

from __future__ import annotations

from agent.account_usage import build_work4you_credits_snapshot
from work4you_cli.work4you_account import (
    Work4YouPaidServiceAccessInfo,
    Work4YouPortalAccountInfo,
    Work4YouPortalSubscriptionInfo,
)


def _account(**kwargs) -> Work4YouPortalAccountInfo:
    kwargs.setdefault("logged_in", True)
    kwargs.setdefault("source", "account_api")
    kwargs.setdefault("fresh", True)
    return Work4YouPortalAccountInfo(**kwargs)


def _all_lines(snapshot) -> list[str]:
    return list(snapshot.details)


def test_healthy():
    info = _account(
        paid_service_access=True,
        paid_service_access_info=Work4YouPaidServiceAccessInfo(
            subscription_credits_remaining=18.0,
            purchased_credits_remaining=12.34,
            total_usable_credits=30.34,
        ),
        subscription=Work4YouPortalSubscriptionInfo(
            plan="Pro",
            current_period_end="2026-07-01",
        ),
    )
    snap = build_work4you_credits_snapshot(info)
    assert snap is not None
    assert snap.available is True
    assert snap.plan == "Pro"
    assert snap.provider == "work4you"
    assert snap.title == "Work4You credits"
    blob = "\n".join(_all_lines(snap))
    assert "$18.00" in blob
    assert "$12.34" in blob
    assert "$30.34" in blob
    assert "Renews: 2026-07-01" in blob
    assert "/billing" in blob
    # money-rule: magnitudes-only, never a percentage
    assert "%" not in blob








def test_free_plan_hides_dollar_grant():
    info = _account(
        paid_service_access=True,
        paid_service_access_info=Work4YouPaidServiceAccessInfo(
            subscription_tier=0,
            active_subscription_is_paid=False,
            subscription_credits_remaining=3.0,
            purchased_credits_remaining=0,
            total_usable_credits=3.0,
        ),
        subscription=Work4YouPortalSubscriptionInfo(
            plan="Free",
            tier=0,
            monthly_credits=5.0,
            credits_remaining=3.0,
            current_period_end="2026-09-15",
        ),
    )
    snap = build_work4you_credits_snapshot(info)
    assert snap is not None
    assert snap.plan == "Free"
    blob = "\n".join(list(snap.details) + [w.detail or "" for w in snap.windows])
    assert "$" not in blob
    assert "topup" not in blob.lower()
    assert "Top up" not in blob
    assert any(w.label == "This month's allowance" for w in snap.windows)
    assert any("Resets: 2026-09-15" in line for line in snap.details)


def test_logged_out():
    info = _account(
        logged_in=False,
        paid_service_access=True,
        paid_service_access_info=Work4YouPaidServiceAccessInfo(
            total_usable_credits=10.0,
        ),
    )
    assert build_work4you_credits_snapshot(info) is None


def test_none():
    assert build_work4you_credits_snapshot(None) is None






