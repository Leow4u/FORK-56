"""Picker search aliases for brand-less wire model ids."""

from work4you_cli.curses_ui import _filter_indices
from work4you_cli.model_search import model_search_text


def test_model_search_text_keeps_ordinary_ids():
    assert model_search_text("kimi-k2.6") == "kimi-k2.6"
    assert model_search_text("glm-5.2") == "glm-5.2"


def test_filter_indices_surfaces_k3_for_kimi_query():
    models = ["kimi-k2.6", "kimi-k2.5", "k3", "kimi-for-coding"]
    haystacks = [model_search_text(m) for m in models]
    ranked = [models[i] for i in _filter_indices(haystacks, "kimi")]
    assert "k3" in ranked


def test_filter_indices_surfaces_house_model_for_operis_query():
    from work4you_cli.models import WORK4YOU_HOUSE_MODEL_ID

    models = [WORK4YOU_HOUSE_MODEL_ID, "z-ai/glm-5.2", "deepseek/deepseek-v4-flash-0731"]
    haystacks = [model_search_text(m) for m in models]
    ranked = [models[i] for i in _filter_indices(haystacks, "operis")]
    assert WORK4YOU_HOUSE_MODEL_ID in ranked
    assert "deepseek/deepseek-v4-flash-0731" in ranked
