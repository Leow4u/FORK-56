"""Behavior tests for cloud default model seeding."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml

import scripts.docker_seed_default_model as seed


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path))
    monkeypatch.setenv("WORK4YOU_CLOUD_INSTANCE_ID", "agent-test")
    return tmp_path


class TestShouldPatch:
    def test_empty_model_section(self):
        assert seed._should_patch({}, "openrouter/free") is True

    def test_factory_default_is_replaced(self):
        cfg = {"model": {"default": seed._FACTORY_DEFAULT, "provider": "auto"}}
        assert seed._should_patch(cfg, "openrouter/free") is True

    def test_user_choice_preserved(self):
        cfg = {"model": {"default": "openrouter/free", "provider": "work4you"}}
        assert seed._should_patch(cfg, "openrouter/free") is False

    def test_blank_requested_skips(self):
        assert seed._should_patch({"model": {}}, "") is False


class TestMain:
    def test_writes_work4you_default_on_cloud_vm(self, home, monkeypatch):
        monkeypatch.setenv("WORK4YOU_DEFAULT_MODEL", "openrouter/free")
        path = home / "config.yaml"
        path.write_text(
            yaml.safe_dump({"model": {"default": seed._FACTORY_DEFAULT}}),
            encoding="utf-8",
        )
        assert seed.main() == 0
        cfg = yaml.safe_load(path.read_text(encoding="utf-8"))
        assert cfg["model"]["provider"] == "work4you"
        assert cfg["model"]["default"] == "openrouter/free"

    def test_no_op_without_cloud_marker(self, home, monkeypatch):
        monkeypatch.delenv("WORK4YOU_CLOUD_INSTANCE_ID", raising=False)
        monkeypatch.setenv("WORK4YOU_DEFAULT_MODEL", "openrouter/free")
        path = home / "config.yaml"
        path.write_text("model:\n  default: x\n", encoding="utf-8")
        before = path.read_text(encoding="utf-8")
        assert seed.main() == 0
        assert path.read_text(encoding="utf-8") == before

    def test_no_op_on_non_factory_user_model(self, home, monkeypatch):
        monkeypatch.setenv("WORK4YOU_DEFAULT_MODEL", "openai/gpt-4o-mini")
        path = home / "config.yaml"
        path.write_text(
            yaml.safe_dump(
                {"model": {"provider": "work4you", "default": "openrouter/free"}},
            ),
            encoding="utf-8",
        )
        before = path.read_text(encoding="utf-8")
        assert seed.main() == 0
        assert path.read_text(encoding="utf-8") == before
