"""Tests for inventory._apply_pricing — the pricing/tier enrichment that

feeds the desktop GUI model picker (and onboarding) so it can show $/Mtok
columns + Free/Pro badges and gate paid models on free Work4You accounts, the
same way the `work4you model` CLI picker does.
"""

import work4you_cli.inventory as inv
import work4you_cli.models as models_mod


def _patch_pricing(monkeypatch, *, free_tier, pricing, unavailable=None):
    monkeypatch.setattr(models_mod, "get_pricing_for_provider", lambda slug, **kw: pricing.get(slug, {}))
    monkeypatch.setattr(models_mod, "check_work4you_free_tier", lambda *, force_fresh=False: free_tier)
    monkeypatch.setattr(
        models_mod, "partition_work4you_models_by_tier",
        lambda ids, pr, free_tier: (
            [m for m in ids if m not in (unavailable or [])],
            list(unavailable or []),
        ),
    )


def test_apply_pricing_formats_per_model_prices(monkeypatch):
    """Each model gets formatted input/output/cache + a free flag."""
    _patch_pricing(
        monkeypatch,
        free_tier=False,
        pricing={
            "openrouter": {
                "a/paid": {"prompt": "0.000003", "completion": "0.000015", "input_cache_read": "0.0000003"},
                "b/free": {"prompt": "0", "completion": "0"},
            }
        },
    )
    rows = [{"slug": "openrouter", "models": ["a/paid", "b/free"]}]
    inv._apply_pricing(rows)

    pricing = rows[0]["pricing"]
    assert pricing["a/paid"] == {"input": "$3.00", "output": "$15.00", "cache": "$0.30", "free": False}
    assert pricing["b/free"]["free"] is True
    assert pricing["b/free"]["input"] == "free"


def test_apply_pricing_omits_sale_for_free_models_even_with_original(monkeypatch):
    """Free models must not get was_*/discount_percent even if original leaked."""
    _patch_pricing(
        monkeypatch,
        free_tier=False,
        pricing={
            "work4you": {
                "a/free": {
                    "prompt": "0",
                    "completion": "0",
                    "original": {
                        "prompt": "0.000002",
                        "completion": "0.00001",
                    },
                },
            }
        },
    )
    rows = [{"slug": "work4you", "models": ["a/free"]}]
    inv._apply_pricing(rows)
    free = rows[0]["pricing"]["a/free"]
    assert free["free"] is True
    assert "discount_percent" not in free
    assert "was_input" not in free
    assert "was_output" not in free


def test_apply_pricing_omits_sale_when_original_not_cheaper(monkeypatch):
    _patch_pricing(
        monkeypatch,
        free_tier=False,
        pricing={
            "work4you": {
                "a/eq": {
                    "prompt": "0.000002",
                    "completion": "0.00001",
                    "original": {
                        "prompt": "0.000002",
                        "completion": "0.00001",
                    },
                },
            }
        },
    )
    rows = [{"slug": "work4you", "models": ["a/eq"]}]
    inv._apply_pricing(rows)
    assert "discount_percent" not in rows[0]["pricing"]["a/eq"]


def test_apply_pricing_gates_work4you_without_live_prices(monkeypatch):
    """Free-plan lock uses the house-model partition even when pricing is empty."""
    monkeypatch.setattr(models_mod, "get_pricing_for_provider", lambda slug, **kw: {})
    monkeypatch.setattr(models_mod, "check_work4you_free_tier", lambda *, force_fresh=False: True)
    from work4you_cli.models import WORK4YOU_HOUSE_MODEL_ID
    house = WORK4YOU_HOUSE_MODEL_ID
    rows = [{"slug": "work4you", "models": [house, "z-ai/glm-5.2"]}]
    inv._apply_pricing(rows)
    assert rows[0]["free_tier"] is True
    assert house not in rows[0]["unavailable_models"]
    assert "z-ai/glm-5.2" in rows[0]["unavailable_models"]


def test_apply_pricing_gates_free_plan_even_with_credits(monkeypatch):
    """Beta Free + credits must still populate unavailable_models."""
    from work4you_cli.models import WORK4YOU_HOUSE_MODEL_ID
    from work4you_cli.work4you_account import (
        Work4YouPaidServiceAccessInfo,
        Work4YouPortalAccountInfo,
        Work4YouPortalSubscriptionInfo,
    )

    monkeypatch.setattr(models_mod, "get_pricing_for_provider", lambda slug, **kw: {})
    monkeypatch.setattr(
        "work4you_cli.work4you_account.get_work4you_portal_account_info",
        lambda *, force_fresh=False: Work4YouPortalAccountInfo(
            logged_in=True,
            source="account_api",
            fresh=True,
            subscription=Work4YouPortalSubscriptionInfo(
                plan="Free", tier=0, monthly_charge=0, monthly_credits=5
            ),
            paid_service_access=True,
            paid_service_access_info=Work4YouPaidServiceAccessInfo(
                subscription_tier=0,
                active_subscription_is_paid=False,
                subscription_monthly_charge=0,
            ),
        ),
    )
    house = WORK4YOU_HOUSE_MODEL_ID
    rows = [{"slug": "work4you", "models": [house, "anthropic/claude-opus-4.6"]}]
    models_mod._free_tier_cache = None
    inv._apply_pricing(rows)
    assert rows[0]["free_tier"] is True
    assert house not in rows[0]["unavailable_models"]
    assert "anthropic/claude-opus-4.6" in rows[0]["unavailable_models"]


def test_apply_pricing_does_not_gate_depleted_plus(monkeypatch):
    """Depleted Plus is still a paid plan — picker stays unlocked."""
    from work4you_cli.models import WORK4YOU_HOUSE_MODEL_ID
    from work4you_cli.work4you_account import (
        Work4YouPaidServiceAccessInfo,
        Work4YouPortalAccountInfo,
        Work4YouPortalSubscriptionInfo,
    )

    monkeypatch.setattr(models_mod, "get_pricing_for_provider", lambda slug, **kw: {})
    monkeypatch.setattr(
        "work4you_cli.work4you_account.get_work4you_portal_account_info",
        lambda *, force_fresh=False: Work4YouPortalAccountInfo(
            logged_in=True,
            source="account_api",
            fresh=True,
            subscription=Work4YouPortalSubscriptionInfo(
                plan="Plus", tier=1, monthly_charge=20, monthly_credits=0
            ),
            paid_service_access=False,
            paid_service_access_info=Work4YouPaidServiceAccessInfo(
                subscription_tier=1,
                active_subscription_is_paid=True,
                subscription_monthly_charge=20,
            ),
        ),
    )
    house = WORK4YOU_HOUSE_MODEL_ID
    rows = [{"slug": "work4you", "models": [house, "anthropic/claude-opus-4.6"]}]
    models_mod._free_tier_cache = None
    inv._apply_pricing(rows)
    assert rows[0]["free_tier"] is False
    assert rows[0]["unavailable_models"] == []


