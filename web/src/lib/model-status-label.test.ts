import { describe, expect, it } from "vitest";

import { displayModelName, formatModelStatusLabel } from "./model-status-label";

describe("model-status-label", () => {
  it("maps the house model id to Operis 4.0 Flash", () => {
    expect(displayModelName("google/gemini-3.8-flash")).toBe("Operis 4.0 Flash");
    expect(displayModelName("gemini-3.8-flash")).toBe("Operis 4.0 Flash");
    expect(displayModelName("deepseek/deepseek-v4-flash-0731")).toBe(
      "Operis 4.0 Flash",
    );
    expect(
      displayModelName("work4you/deepseek/deepseek-v4-flash-0731"),
    ).toBe("Operis 4.0 Flash");
    expect(displayModelName("deepseek-v4-flash-0731")).toBe(
      "Operis 4.0 Flash",
    );
    expect(
      formatModelStatusLabel("google/gemini-3.8-flash", {
        reasoningEffort: "medium",
      }),
    ).toBe("Operis 4.0 Flash · Med");
    expect(
      formatModelStatusLabel("deepseek/deepseek-v4-flash-0731", {
        reasoningEffort: "medium",
      }),
    ).toBe("Operis 4.0 Flash · Med");
  });

  it("does not treat paid DeepSeek or Gemini 3.7 siblings as Operis", () => {
    expect(displayModelName("deepseek/deepseek-v4-flash")).not.toBe(
      "Operis 4.0 Flash",
    );
    expect(displayModelName("google/gemini-3.7-flash")).not.toBe(
      "Operis 4.0 Flash",
    );
  });
});
