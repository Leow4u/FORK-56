import { describe, expect, it } from "vitest";

import {
  effortMenuOptions,
  menuReasoningEffort,
  visibleReasoningEfforts,
} from "./reasoning-effort";

describe("effort menu", () => {
  it("offers four levels, and Max only on Claude", () => {
    expect(visibleReasoningEfforts("x-ai/grok-4.7")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(visibleReasoningEfforts("anthropic/claude-sonnet-5")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    expect(effortMenuOptions("openai/gpt-5.5").map((option) => option.label)).toEqual([
      "Off (no thinking)",
      "Low",
      "Medium",
      "High",
      "Extra High",
    ]);
    expect(effortMenuOptions("anthropic/claude-opus-5").map((option) => option.value)).toContain(
      "max",
    );
  });

  it("keeps a stored Claude Max and folds aliases onto the visible choice", () => {
    expect(menuReasoningEffort("minimal", "x-ai/grok-4.7")).toBe("low");
    expect(menuReasoningEffort("max", "x-ai/grok-4.7")).toBe("xhigh");
    expect(menuReasoningEffort("ultra", "anthropic/claude-sonnet-5")).toBe("max");
    expect(menuReasoningEffort("max", "claude-fable-5")).toBe("max");
    expect(menuReasoningEffort("xhigh", "anthropic/claude-sonnet-5")).toBe("xhigh");
  });
});
