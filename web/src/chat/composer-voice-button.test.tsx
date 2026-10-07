// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestLocalStorage } from "@/chat/test-local-storage";

const transcribeAudio = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  api: { transcribeAudio: (...args: unknown[]) => transcribeAudio(...args) },
}));

import { I18nProvider } from "@/i18n";

import { ComposerVoiceButton } from "./composer-voice-button";

/** Records one chunk of "speech" and hands it over on stop. */
class FakeRecorder {
  static isTypeSupported() {
    return true;
  }

  mimeType = "audio/webm";
  stream = { getTracks: () => [] };
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;

  start() {}

  stop() {
    this.ondataavailable?.({
      data: new Blob(["x".repeat(64)], { type: "audio/webm" }),
    });
    this.onstop?.();
  }
}

beforeEach(() => {
  resetTestLocalStorage();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [] })) },
  });
  transcribeAudio.mockResolvedValue({ transcript: "olá, tudo bem?" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  transcribeAudio.mockReset();
});

describe("ComposerVoiceButton", () => {
  // Without a language the backend assumed English, and Whisper turned
  // Portuguese speech into English text.
  it("tells transcription the language of the interface", async () => {
    window.localStorage.setItem("work4you-locale", "pt");
    const onTranscript = vi.fn();

    render(
      <I18nProvider>
        <ComposerVoiceButton onTranscript={onTranscript} />
      </I18nProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Dictate with microphone" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    });

    await vi.waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith("olá, tudo bem?");
    });
    expect(transcribeAudio).toHaveBeenCalledWith(
      expect.stringMatching(/^data:audio\/webm/),
      "audio/webm",
      "pt",
    );
  });
});
