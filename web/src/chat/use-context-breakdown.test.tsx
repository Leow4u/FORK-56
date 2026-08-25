// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useContextBreakdown } from "./use-context-breakdown";

function HookProbe({
  gateway,
  sessionId,
  busy,
}: {
  gateway: { request: ReturnType<typeof vi.fn> };
  sessionId: string;
  busy: boolean;
}) {
  const { breakdown, loading } = useContextBreakdown({
    busy,
    enabled: true,
    gateway: gateway as never,
    sessionId,
  });
  return (
    <div>
      <span data-testid="loading">{loading ? "yes" : "no"}</span>
      <span data-testid="used">{breakdown?.context_used ?? "none"}</span>
    </div>
  );
}

describe("useContextBreakdown", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("fetches session.context_breakdown when idle", async () => {
    const request = vi.fn().mockResolvedValue({
      categories: [],
      context_max: 1000,
      context_percent: 10,
      context_used: 100,
      estimated_total: 100,
    });
    const gateway = { request };

    await act(async () => {
      root.render(
        <HookProbe gateway={gateway} sessionId="live-1" busy={false} />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(request).toHaveBeenCalledWith("session.context_breakdown", {
      session_id: "live-1",
    });
    expect(container.querySelector("[data-testid='used']")?.textContent).toBe(
      "100",
    );
  });

  it("skips fetch while busy", async () => {
    const request = vi.fn();
    const gateway = { request };

    await act(async () => {
      root.render(<HookProbe gateway={gateway} sessionId="live-1" busy />);
    });

    expect(request).not.toHaveBeenCalled();
  });
});
