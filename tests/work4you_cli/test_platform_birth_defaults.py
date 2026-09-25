"""House-model birth: blank reasoning and Fast fill in; explicit choices stay."""

import os
from unittest.mock import patch

import yaml

from work4you_cli.config import load_config


def _load(tmp_path, payload):
    home = tmp_path / "home"
    home.mkdir()
    (home / "config.yaml").write_text(yaml.safe_dump(payload), encoding="utf-8")
    with patch.dict(os.environ, {"WORK4YOU_HOME": str(home)}):
        return load_config()


def test_blank_reasoning_and_tier_become_high_and_fast(tmp_path):
    config = _load(
        tmp_path,
        {"agent": {"reasoning_effort": "", "service_tier": "  "}},
    )
    assert config["agent"]["reasoning_effort"] == "high"
    assert config["agent"]["service_tier"] == "fast"


def test_missing_file_uses_high_and_fast(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    with patch.dict(os.environ, {"WORK4YOU_HOME": str(home)}):
        config = load_config()
    assert config["agent"]["reasoning_effort"] == "high"
    assert config["agent"]["service_tier"] == "fast"


def test_explicit_medium_normal_and_thinking_off_stay(tmp_path):
    config = _load(
        tmp_path,
        {"agent": {"reasoning_effort": "medium", "service_tier": "normal"}},
    )
    assert config["agent"]["reasoning_effort"] == "medium"
    assert config["agent"]["service_tier"] == "normal"

    off_root = tmp_path / "off"
    off_root.mkdir()
    off = _load(
        off_root,
        {"agent": {"reasoning_effort": False, "service_tier": "normal"}},
    )
    assert off["agent"]["reasoning_effort"] is False
    assert off["agent"]["service_tier"] == "normal"
