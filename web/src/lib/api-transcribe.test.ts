// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api.transcribeAudio", () => {
  // The dashboard has no dictation-language setting, so its UI language is
  // only a hint: it replaces the backend's shipped English default but not
  // an stt.language the user set in config.yaml.
  it("sends the UI language as a hint, not as a binding language", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, transcript: "olá" }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    await api.transcribeAudio("data:audio/webm;base64,AA==", "audio/webm", "pt");

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/audio/transcribe");
    expect(JSON.parse(String(init.body))).toEqual({
      data_url: "data:audio/webm;base64,AA==",
      mime_type: "audio/webm",
      ui_language: "pt",
    });
  });
});
