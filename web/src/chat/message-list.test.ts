// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { shouldShowThinking } from "./thinking";

describe("thin chat thinking indicator", () => {
  it("shows while waiting after a user message", () => {
    expect(
      shouldShowThinking([{ id: "1", role: "user", text: "hi" }], true),
    ).toBe(true);
  });

  it("hides when assistant is streaming text", () => {
    expect(
      shouldShowThinking(
        [{ id: "1", role: "assistant", text: "Hello", streaming: true }],
        true,
      ),
    ).toBe(false);
  });

  it("shows for an empty streaming assistant shell", () => {
    expect(
      shouldShowThinking(
        [{ id: "1", role: "assistant", text: "", streaming: true }],
        true,
      ),
    ).toBe(true);
  });

  it("hides when idle", () => {
    expect(
      shouldShowThinking(
        [{ id: "1", role: "assistant", text: "Done" }],
        false,
      ),
    ).toBe(false);
  });
});
