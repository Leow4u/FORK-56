import { describe, expect, it } from "vitest";

import { displayModelName, formatModelStatusLabel } from "./model-status-label";

describe("model-status-label", () => {
  it("maps the house model id to Operis 4.0 Flash", () => {
    expect(displayModelName("deepseek/deepseek-v4-flash-0731")).toBe(
      "Operis 4.0 Flash",
    );
    expect(
      displayModelName("work4you/deepseek/deepseek-v4-flash-0731"),
    ).toBe("Operis 4.0 Flash");
    expect(
      formatModelStatusLabel("deepseek/deepseek-v4-flash-0731", {
        reasoningEffort: "medium",
      }),
    ).toBe("Operis 4.0 Flash · Med");
  });

  it("does not treat paid DeepSeek siblings as Operis", () => {
    expect(displayModelName("deepseek/deepseek-v4-flash")).not.toBe(
      "Operis 4.0 Flash",
    );
  });
});
