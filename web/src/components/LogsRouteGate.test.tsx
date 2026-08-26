// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/pages/LogsPage", () => ({
  default: () => <div data-testid="logs-page">logs</div>,
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

let container: HTMLDivElement;
let root: Root;

async function renderGate() {
  const { LogsRouteGate } = await import("./LogsRouteGate");
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/logs"]}>
        <Routes>
          <Route path="/logs" element={<LogsRouteGate />} />
          <Route path="/" element={<div data-testid="home">home</div>} />
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

describe("LogsRouteGate", () => {
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

  it("redirects /logs to the home route when the gate is off (default)", async () => {
    apiMocks.getConfig.mockResolvedValue({ dashboard: {} });
    await renderGate();
    expect(container.querySelector('[data-testid="logs-page"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/");
  });

  it("redirects when the config fetch fails (fail closed)", async () => {
    apiMocks.getConfig.mockRejectedValue(new Error("boom"));
    await renderGate();
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/");
  });

  it("renders the Logs page when dashboard.show_logs_admin is true", async () => {
    apiMocks.getConfig.mockResolvedValue({
      dashboard: { show_logs_admin: true },
    });
    await renderGate();
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/logs");
    expect(container.querySelector('[data-testid="logs-page"]')).toBeTruthy();
  });
});
