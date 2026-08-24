#!/usr/bin/env python3
"""Apply WORK4YOU_DEFAULT_MODEL to config.yaml on hosted Cloud VMs.

Runs during docker/stage2-hook.sh after first-boot seed + migration. Only
patches when WORK4YOU_CLOUD_INSTANCE_ID is set (NAS-provisioned agent) and the
on-disk default is still the factory example — never clobber a user-changed model.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import yaml

_FACTORY_DEFAULT = "anthropic/claude-opus-4.6"


def _config_path() -> Path:
    home = os.environ.get("WORK4YOU_HOME", "").strip()
    if not home:
        from work4you_constants import get_work4you_home

        home = str(get_work4you_home())
    return Path(home) / "config.yaml"


def _should_patch(cfg: dict, requested: str) -> bool:
    if not requested:
        return False
    model = cfg.get("model")
    if not isinstance(model, dict):
        return True
    default = model.get("default") or model.get("model") or ""
    return not default or default == _FACTORY_DEFAULT


def main() -> int:
    if not os.environ.get("WORK4YOU_CLOUD_INSTANCE_ID", "").strip():
        return 0
    requested = os.environ.get("WORK4YOU_DEFAULT_MODEL", "").strip()
    if not requested:
        return 0

    path = _config_path()
    if not path.is_file():
        return 0

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except OSError:
        return 0
    if not isinstance(raw, dict):
        raw = {}

    if not _should_patch(raw, requested):
        return 0

    model = raw.get("model")
    if not isinstance(model, dict):
        model = {}
        raw["model"] = model
    model["provider"] = "work4you"
    model["default"] = requested
    model.pop("model", None)

    path.write_text(yaml.safe_dump(raw, sort_keys=False, default_flow_style=False), encoding="utf-8")
    print(f"[seed-model] Set model.provider=work4you model.default={requested!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
