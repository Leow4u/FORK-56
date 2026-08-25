import { describe, expect, it } from "vitest";

import {
  contextMeterLabel,
  mergeGaugeUsage,
  parseContextBreakdown,
} from "./context-breakdown";

describe("context-breakdown", () => {
  it("parses gateway payload", () => {
    const parsed = parseContextBreakdown({
      categories: [
        { id: "conversation", label: "Conversation", color: "teal", tokens: 100 },
      ],
      context_max: 200_000,
      context_percent: 50,
      context_used: 100_000,
      estimated_total: 110_000,
    });
    expect(parsed?.context_percent).toBe(50);
    expect(parsed?.categories).toHaveLength(1);
  });

  it("prefers breakdown for gauge merge", () => {
    const gauge = mergeGaugeUsage(
      { total: 10, contextMax: 1, contextUsed: 1, contextPercent: 1 },
      {
        categories: [],
        context_max: 272_000,
        context_percent: 47,
        context_used: 128_200,
        estimated_total: 128_200,
      },
    );
    expect(gauge.contextPercent).toBe(47);
    expect(contextMeterLabel(gauge)).toBe("47%");
  });
});
