// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useContextBreakdown } from "./use-context-breakdown";

describe("useContextBreakdown", () => {
  it("fetches session.context_breakdown when idle", async () => {
    const request = vi.fn().mockResolvedValue({
      categories: [],
      context_max: 1000,
      context_percent: 10,
      context_used: 100,
      estimated_total: 100,
    });
    const gateway = { request } as never;

    const { result } = renderHook(() =>
      useContextBreakdown({
        busy: false,
        enabled: true,
        gateway,
        sessionId: "live-1",
      }),
    );

    await waitFor(() => expect(result.current.breakdown?.context_used).toBe(100));
    expect(request).toHaveBeenCalledWith("session.context_breakdown", {
      session_id: "live-1",
    });
  });

  it("skips fetch while busy", () => {
    const request = vi.fn();
    const gateway = { request } as never;

    renderHook(() =>
      useContextBreakdown({
        busy: true,
        enabled: true,
        gateway,
        sessionId: "live-1",
      }),
    );

    expect(request).not.toHaveBeenCalled();
  });
});
