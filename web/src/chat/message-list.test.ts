// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { textPart } from "@/lib/chat-messages";

import { shouldShowThinking } from "./thinking";
import type { ChatMessage } from "./types";

describe("thin chat thinking indicator", () => {
  it("shows while waiting after a user message", () => {
    expect(
      shouldShowThinking(
        [{ id: "1", role: "user", parts: [textPart("hi")] }],
        true,
      ),
    ).toBe(true);
  });

  it("hides when assistant is streaming text", () => {
    expect(
      shouldShowThinking(
        [
          {
            id: "1",
            role: "assistant",
            parts: [textPart("Hello")],
            pending: true,
          },
        ],
        true,
      ),
    ).toBe(false);
  });

  it("shows for an empty streaming assistant shell", () => {
    expect(
      shouldShowThinking(
        [{ id: "1", role: "assistant", parts: [], pending: true }],
        true,
      ),
    ).toBe(true);
  });

  it("hides when idle", () => {
    expect(
      shouldShowThinking(
        [
          {
            id: "1",
            role: "assistant",
            parts: [textPart("Done")],
          } satisfies ChatMessage,
        ],
        false,
      ),
    ).toBe(false);
  });
});
