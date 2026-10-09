"""A desktop voice payload cannot be accepted incomplete or corrupted."""

import importlib.util
import json
from pathlib import Path

import pytest


spec = importlib.util.spec_from_file_location(
    "desktop_voice_build", Path(__file__).resolve().parents[1] / "scripts/ci/build-desktop-voice.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def test_voice_payload_requires_tokenizer_and_configuration(tmp_path):
    (tmp_path / "model.bin").write_bytes(b"model")
    with pytest.raises(RuntimeError, match="Incomplete bundled voice model"):
        builder.validate_whisper_model(tmp_path)


def test_voice_payload_rejects_corrupt_model_before_loading(tmp_path):
    for filename in builder.WHISPER_FILES:
        (tmp_path / filename).write_text(json.dumps({}), encoding="utf-8")
    with pytest.raises(RuntimeError, match="checksum"):
        builder.validate_whisper_model(tmp_path)
