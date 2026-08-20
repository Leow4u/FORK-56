"""Tests for the Work4You-Work4You-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"work4you"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``work4you-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "work4you" tag namespace.

``is_work4you_work4you_non_agentic`` should only match the actual Work4You
Work4You-3 / Work4You-4 chat family.
"""

from __future__ import annotations

import pytest

from work4you_cli.model_switch import (
    _WORK4YOU_MODEL_WARNING,
    _check_work4you_model_warning,
    is_work4you_work4you_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "Work4You/Work4You-3-Llama-3.1-70B",
        "Work4You/Work4You-3-Llama-3.1-405B",
        "work4you-3",
        "Work4You-3",
        "work4you-4",
        "work4you-4-405b",
        "work4you_4_70b",
        "openrouter/work4you3:70b",
        "openrouter/work4you/work4you-4-405b",
        "Work4You/Work4You3",
        "work4you-3.1",
    ],
)
def test_matches_real_work4you_work4you_chat_models(model_name: str) -> None:
    assert is_work4you_work4you_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as Work4You Work4You 3/4"
    )
    assert _check_work4you_model_warning(model_name) == _WORK4YOU_MODEL_WARNING


