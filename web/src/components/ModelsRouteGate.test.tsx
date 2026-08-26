// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/pages/ModelsPage", () => ({
  default: () => <div data-testid="models-page">models analytics</div>,
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

let container: HTMLDivElement;
let root: Root;

async function renderGate() {
  const { ModelsRouteGate } = await import("./ModelsRouteGate");
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/models"]}>
        <Routes>
          <Route path="/models" element={<ModelsRouteGate />} />
          <Route
            path="/settings"
            element={<div data-testid="settings">settings</div>}
          />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ModelsRouteGate", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getConfig.mockReset();
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

  it("redirects /models to /settings when token analytics are off (default)", async () => {
    apiMocks.getConfig.mockResolvedValue({ dashboard: {} });
    await renderGate();
    expect(container.querySelector('[data-testid="models-page"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/settings");
  });

  it("redirects when the config fetch fails (fail closed)", async () => {
    apiMocks.getConfig.mockRejectedValue(new Error("boom"));
    await renderGate();
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/settings");
  });

  it("renders the operator analytics page when show_token_analytics is true", async () => {
    apiMocks.getConfig.mockResolvedValue({
      dashboard: { show_token_analytics: true },
    });
    await renderGate();
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/models");
    expect(
      container.querySelector('[data-testid="models-page"]'),
    ).toBeTruthy();
  });
});
