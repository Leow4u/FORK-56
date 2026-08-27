/**
 * Voice settings helpers — mirrors apps/desktop/src/app/settings/helpers.ts
 * (voiceFieldVisible) and constants.ts (Voice section keys + stt.provider
 * schema fallback from work4you_cli/web_server.py _SCHEMA_OVERRIDES).
 */

import { getNestedValue } from "@/lib/nested";

/** Desktop Settings → Voice keys (apps/desktop/src/app/settings/constants.ts). */
export const VOICE_CONFIG_KEYS = [
  "tts.provider",
  "stt.enabled",
  "stt.echo_transcripts",
  "stt.provider",
  "voice.auto_tts",
  "tts.edge.voice",
  "tts.openai.model",
  "tts.openai.voice",
  "tts.elevenlabs.voice_id",
  "tts.elevenlabs.model_id",
  "tts.xai.voice_id",
  "tts.xai.language",
  "tts.xai.speed",
  "tts.xai.auto_speech_tags",
  "tts.xai.optimize_streaming_latency",
  "tts.xai.sample_rate",
  "tts.xai.bit_rate",
  "tts.minimax.model",
  "tts.minimax.voice_id",
  "tts.mistral.model",
  "tts.mistral.voice_id",
  "tts.gemini.model",
  "tts.gemini.voice",
  "tts.neutts.model",
  "tts.neutts.device",
  "tts.kittentts.model",
  "tts.kittentts.voice",
  "tts.piper.voice",
  "tts.deepinfra.model",
  "tts.deepinfra.voice",
  "stt.local.model",
  "stt.local.language",
  "stt.openai.model",
  "stt.groq.model",
  "stt.mistral.model",
  "stt.elevenlabs.model_id",
  "stt.elevenlabs.language_code",
  "stt.elevenlabs.tag_audio_events",
  "stt.elevenlabs.diarize",
  "voice.record_key",
  "voice.max_recording_seconds",
] as const;

/**
 * stt.provider is declared in _SCHEMA_OVERRIDES but omitted from the flat
 * schema walk because DEFAULT_CONFIG intentionally does not seed it.
 */
export const VOICE_SCHEMA_FALLBACKS: Record<string, Record<string, unknown>> = {
  "stt.provider": {
    type: "select",
    description: "Speech-to-text provider",
    options: ["local", "groq", "openai", "xai", "elevenlabs"],
  },
};

/** Show only the active TTS/STT provider sub-fields (desktop parity). */
export function voiceFieldVisible(
  key: string,
  config: Record<string, unknown>,
): boolean {
  const match = /^(tts|stt)\.([^.]+)\./.exec(key);

  if (!match) {
    return true;
  }

  const [, domain, provider] = match;

  if (domain === "stt" && !getNestedValue(config, "stt.enabled")) {
    return false;
  }

  return provider === String(getNestedValue(config, `${domain}.provider`) ?? "");
}

export function inferFieldSchema(value: unknown): Record<string, unknown> {
  if (typeof value === "boolean") {
    return { type: "boolean" };
  }
  if (typeof value === "number") {
    return { type: "number" };
  }
  if (Array.isArray(value)) {
    return { type: "list" };
  }
  return { type: "string" };
}
