#!/usr/bin/env python3
"""Stage the desktop's standard local voice models on the build host."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


WHISPER_REPOSITORY = "Systran/faster-whisper-base"
WHISPER_REVISION = "ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66"
WHISPER_MODEL_SHA256 = "d01c3014881c9c6f3133c182f3d2887eb6ca1c789a7538c5c007196857a0a6a9"
WHISPER_FILES = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt", "README.md")
WAKE_MODELS = {
    "melspectrogram.onnx": "ba2b0e0f8b7b875369a2c89cb13360ff53bac436f2895cced9f479fa65eb176f",
    "embedding_model.onnx": "70d164290c1d095d1d4ee149bc5e00543250a7316b59f31d056cff7bd3075c1f",
    "melspectrogram.tflite": "96fa0adccb6e8cf95cb14465409a1a2898ee4a96a85bb9ed3c7eb0e68bf163e8",
    "embedding_model.tflite": "c0aea21eb84a4ce90a08c870da41b7a7173b45269e6a3207c71d67c40f3a59d8",
}
SHERPA_MODEL = "sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01"
SHERPA_SHA256 = "f170013b4716e41b62b9bfd809687c207cef798ef9bc6534d524e17af9b6561a"


def artifact_helpers():
    spec = importlib.util.spec_from_file_location("desktop_capability_build", Path(__file__).with_name("build-desktop-capabilities.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_whisper_model(directory: Path) -> None:
    for name in WHISPER_FILES:
        if not (directory / name).is_file():
            raise RuntimeError(f"Incomplete bundled voice model: {name}")
    with (directory / "model.bin").open("rb") as stream:
        checksum = hashlib.file_digest(stream, "sha256").hexdigest()
    if checksum != WHISPER_MODEL_SHA256:
        raise RuntimeError("Bundled Whisper model checksum differs from the pinned release")
    for name in ("config.json", "tokenizer.json"):
        json.loads((directory / name).read_text(encoding="utf-8"))


def bundle_wake_models(runtime: Path) -> dict:
    helpers = artifact_helpers()
    destination = runtime / "voice/wake"
    destination.mkdir(parents=True, exist_ok=True)
    for name, digest in WAKE_MODELS.items():
        helpers.checked_download(
            f"https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/{name}",
            destination / name, digest,
        )
    with tempfile.TemporaryDirectory(prefix="work4you-wake-build-") as temporary:
        archive = Path(temporary) / (SHERPA_MODEL + ".tar.bz2")
        helpers.checked_download(
            f"https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/{archive.name}",
            archive, SHERPA_SHA256,
        )
        helpers.extract_archive(archive, destination)
    sherpa = destination / SHERPA_MODEL
    if not (sherpa / "tokens.txt").is_file():
        raise RuntimeError("Bundled keyword model is incomplete")
    relative = lambda file: file.relative_to(runtime).as_posix()
    return {
        "melspectrogramOnnx": relative(destination / "melspectrogram.onnx"),
        "embeddingOnnx": relative(destination / "embedding_model.onnx"),
        "melspectrogramTflite": relative(destination / "melspectrogram.tflite"),
        "embeddingTflite": relative(destination / "embedding_model.tflite"),
        "sherpaTokens": relative(sherpa / "tokens.txt"),
    }


def build_voice(runtime: Path) -> dict:
    python = runtime / ("python/python.exe" if os.name == "nt" else "python/bin/python3")
    env = dict(os.environ)
    for name in ("PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV"):
        env.pop(name, None)
    env.update(PYTHONNOUSERSITE="1", PYTHONDONTWRITEBYTECODE="1", HF_HUB_DISABLE_TELEMETRY="1")
    wake = bundle_wake_models(runtime)
    destination = runtime / "voice/whisper-base"
    # An immutable upstream revision pins all tokenizer/configuration files.
    # The large model additionally has its upstream SHA-256 checked below.
    script = (
        "import sys,json; from huggingface_hub import snapshot_download; "
        "snapshot_download(repo_id=sys.argv[1], revision=sys.argv[2], "
        "local_dir=sys.argv[3], allow_patterns=json.loads(sys.argv[4]))"
    )
    subprocess.run([str(python), "-s", "-B", "-c", script, WHISPER_REPOSITORY, WHISPER_REVISION,
                    str(destination), json.dumps(WHISPER_FILES)], env=env, check=True, timeout=1200)
    validate_whisper_model(destination)
    shutil.rmtree(destination / ".cache", ignore_errors=True)
    # Prove the pinned model and tokenizer load with downloads forbidden.
    probe = r'''
import sys
from pathlib import Path
from faster_whisper import WhisperModel
WhisperModel(sys.argv[1], device='cpu', compute_type='int8', local_files_only=True)
if sys.platform == 'win32':
    import ctypes
    from ctypes import wintypes
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetModuleHandleW.restype = wintypes.HMODULE
    kernel32.GetModuleFileNameW.argtypes = [wintypes.HMODULE, wintypes.LPWSTR, wintypes.DWORD]
    kernel32.GetModuleFileNameW.restype = wintypes.DWORD
    expected = (Path(sys.argv[2]) / 'python').resolve()
    for name in ('MSVCP140.dll', 'VCRUNTIME140.dll'):
        handle = kernel32.GetModuleHandleW(name)
        if not handle:
            raise RuntimeError(f'Native voice dependency was not loaded: {name}')
        buffer = ctypes.create_unicode_buffer(32768)
        size = kernel32.GetModuleFileNameW(handle, buffer, len(buffer))
        if not size or size >= len(buffer):
            raise ctypes.WinError(ctypes.get_last_error())
        loaded = Path(buffer.value).resolve()
        if loaded.parent != expected:
            raise RuntimeError(f'Voice depends on the build host instead of app-local {name}: {loaded}')
    print('Native voice uses app-local Microsoft C++ runtime DLLs')
'''
    subprocess.run([str(python), "-s", "-B", "-c", probe, str(destination), str(runtime)],
                   env={**env, "HF_HUB_OFFLINE": "1"}, check=True, timeout=180)
    result = {"voice": {"model": "base", "modelFile": "voice/whisper-base/model.bin", "revision": WHISPER_REVISION},
              "wake": wake}
    manifest_path = runtime / "capabilities.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.update(result)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-dir", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    args = parser.parse_args()
    build_voice(args.runtime_dir.resolve())


if __name__ == "__main__":
    main()
