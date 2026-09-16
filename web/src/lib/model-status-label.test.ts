import { describe, expect, it } from "vitest";

import { displayModelName, formatModelStatusLabel } from "./model-status-label";

describe("model-status-label", () => {
  it("maps the house model id to Operis 4.0", () => {
    expect(displayModelName("openai/gpt-5.6-luna")).toBe("Operis 4.0");
    expect(displayModelName("gpt-5.6-luna")).toBe("Operis 4.0");
    expect(displayModelName("google/gemini-3.8-flash")).toBe("Operis 4.0");
    expect(displayModelName("gemini-3.8-flash")).toBe("Operis 4.0");
    expect(displayModelName("deepseek/deepseek-v4-flash-0731")).toBe(
      "Operis 4.0",
    );
    expect(
      displayModelName("work4you/deepseek/deepseek-v4-flash-0731"),
    ).toBe("Operis 4.0");
    expect(displayModelName("deepseek-v4-flash-0731")).toBe("Operis 4.0");
    expect(
      formatModelStatusLabel("openai/gpt-5.6-luna", {
        reasoningEffort: "medium",
      }),
    ).toBe("Operis 4.0 · Med");
    expect(
      formatModelStatusLabel("deepseek/deepseek-v4-flash-0731", {
        reasoningEffort: "medium",
      }),
    ).toBe("Operis 4.0 · Med");
  });

  it("does not treat paid Luna, DeepSeek, or Gemini siblings as Operis", () => {
    expect(displayModelName("openai/gpt-5.6-luna-pro")).not.toBe("Operis 4.0");
    expect(displayModelName("deepseek/deepseek-v4-flash")).not.toBe(
      "Operis 4.0",
    );
    expect(displayModelName("google/gemini-3.7-flash")).not.toBe("Operis 4.0");
  });
});
