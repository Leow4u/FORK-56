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






