"""House model (Operis) contracts: id, Free-tier unlock, silent default."""

from work4you_cli.models import (
    PREFERRED_SILENT_DEFAULT_MODEL,
    WORK4YOU_HOUSE_MODEL_DISPLAY,
    WORK4YOU_HOUSE_MODEL_ID,
    is_work4you_house_model,
    pick_silent_default_model,
)


def test_house_model_id_is_dated_deepseek_flash():
    assert WORK4YOU_HOUSE_MODEL_ID == "deepseek/deepseek-v4-flash-0731"
    assert WORK4YOU_HOUSE_MODEL_DISPLAY == "Operis 4.0 Flash"
    assert is_work4you_house_model(WORK4YOU_HOUSE_MODEL_ID)
    assert is_work4you_house_model("openrouter/deepseek-v4-flash-0731")
    assert not is_work4you_house_model("deepseek/deepseek-v4-flash")
    assert not is_work4you_house_model("openrouter/free")


def test_silent_default_is_house_model():
    assert PREFERRED_SILENT_DEFAULT_MODEL == WORK4YOU_HOUSE_MODEL_ID
    ids = [
        "anthropic/claude-fable-5",
        "openrouter/free",
        WORK4YOU_HOUSE_MODEL_ID,
    ]
    assert pick_silent_default_model(ids, provider="work4you") == WORK4YOU_HOUSE_MODEL_ID
    assert pick_silent_default_model(ids, provider="openrouter") == WORK4YOU_HOUSE_MODEL_ID


def test_house_model_is_not_zero_price_free():
    """Operis is billed. Zero-price helper must not treat the id as free."""
    from work4you_cli.models import _is_model_free

    pricing = {
        WORK4YOU_HOUSE_MODEL_ID: {"prompt": "0.00014", "completion": "0.00028"},
    }
    assert _is_model_free(WORK4YOU_HOUSE_MODEL_ID, pricing) is False
    assert is_work4you_house_model(WORK4YOU_HOUSE_MODEL_ID)


def test_free_tier_recommended_default_prefers_house():
    """After Free-tier partition, silent default must land on Operis."""
    from work4you_cli.models import partition_work4you_models_by_tier

    models = [
        "anthropic/claude-fable-5",
        "openrouter/free",
        WORK4YOU_HOUSE_MODEL_ID,
        "z-ai/glm-5.2",
    ]
    pricing = {
        "anthropic/claude-fable-5": {"prompt": "0.003", "completion": "0.015"},
        "openrouter/free": {"prompt": "0", "completion": "0"},
        WORK4YOU_HOUSE_MODEL_ID: {"prompt": "0.00014", "completion": "0.00028"},
        "z-ai/glm-5.2": {"prompt": "0.0014", "completion": "0.0044"},
    }
    selectable, _ = partition_work4you_models_by_tier(models, pricing, free_tier=True)
    assert pick_silent_default_model(selectable, provider="work4you") == WORK4YOU_HOUSE_MODEL_ID
