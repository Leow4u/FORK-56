"""GUI model picker must persist provider + model like the CLI."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from work4you_cli.tools_config import (  # noqa: E402
    TOOL_CATEGORIES,
    persist_toolset_model_selection,
)
from tools.tool_backend_helpers import WORK4YOU_MANAGED_PROVIDER  # noqa: E402


def _managed_row(ts_key: str):
    cat = TOOL_CATEGORIES[ts_key]
    return next(
        p for p in cat["providers"] if p.get("name") == "Work4You Subscription"
    )


class TestPersistToolsetModelSelection:
    def test_video_model_selection_sets_work4you_provider(self):
        config = {"video_gen": {"provider": "fal"}}
        with patch(
            "work4you_cli.tools_config.get_work4you_subscription_features"
        ) as feats:
            feats.return_value = MagicMock(
                features={
                    "video_gen": MagicMock(managed_by_nous=True),
                }
            )
            persist_toolset_model_selection(
                "video_gen",
                "veo3.1",
                config,
                provider_name="Work4You Subscription",
            )
        assert config["video_gen"]["provider"] == WORK4YOU_MANAGED_PROVIDER
        assert config["video_gen"]["model"] == "veo3.1"
        assert "use_gateway" not in config["video_gen"]

    def test_image_model_selection_sets_work4you_provider(self):
        config = {}
        with patch(
            "work4you_cli.tools_config.get_work4you_subscription_features"
        ) as feats:
            feats.return_value = MagicMock(
                features={
                    "image_gen": MagicMock(managed_by_nous=True),
                }
            )
            persist_toolset_model_selection(
                "image_gen",
                "fal-ai/flux-2-pro",
                config,
                provider_name="Work4You Subscription",
            )
        assert config["image_gen"]["provider"] == WORK4YOU_MANAGED_PROVIDER
        assert config["image_gen"]["model"] == "fal-ai/flux-2-pro"

    def test_model_only_write_without_provider_name(self):
        config = {"video_gen": {"provider": "work4you"}}
        persist_toolset_model_selection("video_gen", "flux-3", config)
        assert config["video_gen"]["provider"] == "work4you"
        assert config["video_gen"]["model"] == "flux-3"
