import { describe, expect, it } from "vitest";

import { voiceFieldVisible } from "./voice-settings";

describe("voiceFieldVisible", () => {
  it("shows OpenAI voice and model when TTS is Work4You Subscription", () => {
    const config = {
      tts: { provider: "work4you", openai: { model: "gpt-4o-mini-tts", voice: "alloy" } },
    };
    expect(voiceFieldVisible("tts.openai.model", config)).toBe(true);
    expect(voiceFieldVisible("tts.openai.voice", config)).toBe(true);
    expect(voiceFieldVisible("tts.edge.voice", config)).toBe(false);
    expect(voiceFieldVisible("tts.elevenlabs.voice_id", config)).toBe(false);
  });

  it("shows OpenAI STT model when STT is Work4You Subscription", () => {
    const config = {
      stt: { enabled: true, provider: "work4you", openai: { model: "whisper-1" } },
    };
    expect(voiceFieldVisible("stt.openai.model", config)).toBe(true);
    expect(voiceFieldVisible("stt.local.model", config)).toBe(false);
  });

  it("still shows Edge fields when Edge is selected", () => {
    const config = { tts: { provider: "edge", edge: { voice: "en-US-AriaNeural" } } };
    expect(voiceFieldVisible("tts.edge.voice", config)).toBe(true);
    expect(voiceFieldVisible("tts.openai.voice", config)).toBe(false);
  });
});
