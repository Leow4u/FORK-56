"""House model (Operis) contracts: id, Free-tier unlock, silent default."""

from work4you_cli.models import (
    PREFERRED_SILENT_DEFAULT_MODEL,
    WORK4YOU_HOUSE_MODEL_DISPLAY,
    WORK4YOU_HOUSE_MODEL_ID,
    canonical_work4you_house_model_id,
    is_work4you_house_model,
    pick_silent_default_model,
)


def test_official_catalog_is_curated_without_openrouter_free():
    from work4you_cli.models import _PROVIDER_MODELS

    ids = _PROVIDER_MODELS["work4you"]
    assert ids[0] == WORK4YOU_HOUSE_MODEL_ID
    assert "openrouter/free" not in ids
    assert "deepseek/deepseek-v4-pro" not in ids
    assert "deepseek/deepseek-v4-pro-0813" not in ids
    assert "deepseek/deepseek-v4-flash" not in ids
    assert "deepseek/deepseek-v4-flash-0731" not in ids
    assert "google/gemini-3.7-flash" in ids
    assert ids.count("google/gemini-3.8-flash") == 1


def test_house_model_id_is_gemini_38_flash():
    assert WORK4YOU_HOUSE_MODEL_ID == "google/gemini-3.8-flash"
    assert WORK4YOU_HOUSE_MODEL_DISPLAY == "Operis 4.0 Flash"
    assert is_work4you_house_model(WORK4YOU_HOUSE_MODEL_ID)
    assert is_work4you_house_model("gemini-3.8-flash")
    assert is_work4you_house_model("openrouter/gemini-3.8-flash")
    assert is_work4you_house_model("work4you/google/gemini-3.8-flash")
    assert is_work4you_house_model("deepseek/deepseek-v4-flash-0731")
    assert is_work4you_house_model("openrouter/deepseek-v4-flash-0731")
    assert is_work4you_house_model("deepseek-v4-flash-0731")
    assert is_work4you_house_model("work4you/deepseek/deepseek-v4-flash-0731")
    assert not is_work4you_house_model("deepseek/deepseek-v4-flash")
    assert not is_work4you_house_model("google/gemini-3.7-flash")
    assert not is_work4you_house_model("gemini-3.7-flash")
    assert not is_work4you_house_model("openrouter/free")


def test_legacy_house_id_canonicalizes_to_gemini_38():
    assert canonical_work4you_house_model_id("deepseek/deepseek-v4-flash-0731") == WORK4YOU_HOUSE_MODEL_ID
    assert canonical_work4you_house_model_id("deepseek-v4-flash-0731") == WORK4YOU_HOUSE_MODEL_ID
    assert canonical_work4you_house_model_id(WORK4YOU_HOUSE_MODEL_ID) == WORK4YOU_HOUSE_MODEL_ID
    assert canonical_work4you_house_model_id("google/gemini-3.7-flash") == "google/gemini-3.7-flash"
    assert canonical_work4you_house_model_id("deepseek/deepseek-v4-flash") == "deepseek/deepseek-v4-flash"


def test_house_model_display_hides_upstream_wire_id():
    """Splash/status chrome must show Operis, never Gemini or DeepSeek slugs."""
    from work4you_cli.model_switch import format_model_for_display

    assert format_model_for_display(WORK4YOU_HOUSE_MODEL_ID) == WORK4YOU_HOUSE_MODEL_DISPLAY
    assert format_model_for_display("gemini-3.8-flash") == WORK4YOU_HOUSE_MODEL_DISPLAY
    assert format_model_for_display("deepseek-v4-flash-0731") == WORK4YOU_HOUSE_MODEL_DISPLAY
    assert format_model_for_display("openrouter/deepseek-v4-flash-0731") == WORK4YOU_HOUSE_MODEL_DISPLAY
    assert "gemini" not in format_model_for_display(WORK4YOU_HOUSE_MODEL_ID).lower()
    assert "deepseek" not in format_model_for_display(WORK4YOU_HOUSE_MODEL_ID).lower()
    assert format_model_for_display("deepseek/deepseek-v4-flash") == "deepseek/deepseek-v4-flash"
    assert format_model_for_display("google/gemini-3.7-flash") == "google/gemini-3.7-flash"
    assert format_model_for_display("anthropic/claude-opus-4.8") == "anthropic/claude-opus-4.8"


def test_silent_default_is_house_model():
    assert PREFERRED_SILENT_DEFAULT_MODEL == WORK4YOU_HOUSE_MODEL_ID
    ids = [
        "anthropic/claude-fable-5",
        "openrouter/free",
        WORK4YOU_HOUSE_MODEL_ID,
    ]
    assert pick_silent_default_model(ids, provider="work4you") == WORK4YOU_HOUSE_MODEL_ID
    assert pick_silent_default_model(ids, provider="openrouter") == WORK4YOU_HOUSE_MODEL_ID
    assert pick_silent_default_model(
        ["anthropic/claude-fable-5", "deepseek/deepseek-v4-flash-0731"],
        provider="work4you",
    ) == WORK4YOU_HOUSE_MODEL_ID


def test_house_model_is_not_zero_price_free():
    """Operis is billed. Zero-price helper must not treat the id as free."""
    from work4you_cli.models import _is_model_free

    pricing = {
        WORK4YOU_HOUSE_MODEL_ID: {"prompt": "0.00075", "completion": "0.00375"},
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
        "google/gemini-3.7-flash",
    ]
    pricing = {
        "anthropic/claude-fable-5": {"prompt": "0.003", "completion": "0.015"},
        "openrouter/free": {"prompt": "0", "completion": "0"},
        WORK4YOU_HOUSE_MODEL_ID: {"prompt": "0.00075", "completion": "0.00375"},
        "z-ai/glm-5.2": {"prompt": "0.0014", "completion": "0.0044"},
        "google/gemini-3.7-flash": {"prompt": "0.0005", "completion": "0.003"},
    }
    selectable, unavailable = partition_work4you_models_by_tier(models, pricing, free_tier=True)
    assert selectable == [WORK4YOU_HOUSE_MODEL_ID]
    assert "openrouter/free" in unavailable
    assert "google/gemini-3.7-flash" in unavailable
    assert pick_silent_default_model(selectable, provider="work4you") == WORK4YOU_HOUSE_MODEL_ID


def test_free_tier_collapses_legacy_and_canonical_house_ids():
    from work4you_cli.models import partition_work4you_models_by_tier

    models = [
        "deepseek/deepseek-v4-flash-0731",
        WORK4YOU_HOUSE_MODEL_ID,
        "google/gemini-3.7-flash",
    ]
    selectable, unavailable = partition_work4you_models_by_tier(models, {}, free_tier=True)
    assert selectable == [WORK4YOU_HOUSE_MODEL_ID]
    assert "google/gemini-3.7-flash" in unavailable
    assert "deepseek/deepseek-v4-flash-0731" not in selectable
