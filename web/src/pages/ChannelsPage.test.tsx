// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestLocalStorage } from "@/chat/test-local-storage";
import { SystemActionsProvider } from "@/contexts/SystemActions";
import { I18nProvider } from "@/i18n/context";

const apiMocks = vi.hoisted(() => ({
  getMessagingPlatforms: vi.fn(async () => ({
    env_path: "~/.work4you/.env",
    gateway_start_command: "work4you gateway start",
    platforms: [
      {
        id: "slack",
        name: "Slack",
        description: "Workspace bot",
        docs_url: "",
        enabled: true,
        configured: true,
        gateway_running: true,
        state: "connected",
        error_code: null,
        error_message: null,
        updated_at: null,
        home_channel: null,
        env_vars: [],
      },
    ],
  })),
  getPairing: vi.fn(async () => ({
    pending: [
      {
        platform: "telegram",
        user_id: "7712345",
        user_name: "Bee",
        request_id: "aaaaaaaaaaaaaaaa",
      },
    ],
    approved: [],
  })),
  restartGateway: vi.fn(async () => ({
    ok: true,
    name: "gateway-restart",
    pid: 1,
  })),
  getActionStatus: vi.fn(async () => ({
    running: false,
    exit_code: 0,
    lines: [],
    name: "gateway-restart",
    pid: 1,
  })),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setAfterTitle: vi.fn(), setEnd: vi.fn() }),
}));

vi.mock("@/pages/PairingPage", () => ({
  default: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="pairing-page" data-embedded={String(Boolean(embedded))}>
      pairing requests
    </div>
  ),
}));

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

let container: HTMLDivElement;
let root: Root;

async function renderPage(path = "/channels") {
  const { default: ChannelsPage } = await import("./ChannelsPage");
  act(() => {
    root.render(
      <I18nProvider>
        <SystemActionsProvider>
          <MemoryRouter initialEntries={[path]}>
            <ChannelsPage />
            <LocationProbe />
          </MemoryRouter>
        </SystemActionsProvider>
      </I18nProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ChannelsPage (Messaging)", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    resetTestLocalStorage();
    localStorage.clear();
    apiMocks.getMessagingPlatforms.mockClear();
    apiMocks.getPairing.mockClear();
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

  it("defaults to the Channels tab with the existing platform list", async () => {
    await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("Slack");
    expect(text).toContain("Workspace bot");
    expect(text).toContain("Channels");
    expect(text).toContain("Pairing (1)");
    expect(container.querySelector('[data-testid="pairing-page"]')).toBeNull();
  });

  it("renders the embedded Pairing page under ?tab=pairing", async () => {
    await renderPage("/channels?tab=pairing");
    const pairing = container.querySelector('[data-testid="pairing-page"]');
    expect(pairing).toBeTruthy();
    expect(pairing?.getAttribute("data-embedded")).toBe("true");
    expect(container.textContent ?? "").not.toContain("Workspace bot");
  });
});
