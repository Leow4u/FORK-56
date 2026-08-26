// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getAuthMe: vi.fn(),
  logout: vi.fn(async () => new Response()),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: {
      app: {
        nav: { settings: "Settings" },
        logOut: "Log out",
      },
    },
  }),
}));

function LocationProbe() {
  const { pathname } = useLocation();
  return <span data-testid="location">{pathname}</span>;
}

let container: HTMLDivElement;
let root: Root;

async function renderWidget() {
  const { AuthWidget } = await import("./AuthWidget");
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/chat"]}>
        <AuthWidget />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AuthWidget footer user area", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getAuthMe.mockReset();
    apiMocks.logout.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete (window as { __WORK4YOU_AUTH_REQUIRED__?: boolean })
      .__WORK4YOU_AUTH_REQUIRED__;
  });

  it("loopback (ungated): renders a Settings gear that navigates to /settings", async () => {
    await renderWidget();
    const gear = container.querySelector(
      'button[aria-label="Settings"]',
    ) as HTMLButtonElement;
    expect(gear).toBeTruthy();
    act(() => {
      gear.click();
    });
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/settings");
  });

  it("gated: clicking the identity opens a menu with Settings and Log out", async () => {
    (window as { __WORK4YOU_AUTH_REQUIRED__?: boolean }).__WORK4YOU_AUTH_REQUIRED__ =
      true;
    apiMocks.getAuthMe.mockResolvedValue({
      user_id: "did:privy:cmt2abcdef",
      display_name: "",
      email: "",
      provider: "work4you",
    });
    await renderWidget();

    const identity = container.querySelector(
      'button[aria-haspopup="menu"]',
    ) as HTMLButtonElement;
    expect(identity).toBeTruthy();
    expect(identity.textContent).toContain("did:privy:cmt2…");

    act(() => {
      identity.click();
    });
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();
    const items = Array.from(
      menu!.querySelectorAll('[role="menuitem"]'),
    ).map((b) => b.textContent);
    expect(items).toEqual(["Settings", "Log out"]);

    // Log out goes through the existing api.logout flow.
    act(() => {
      (menu!.querySelectorAll('[role="menuitem"]')[1] as HTMLButtonElement).click();
    });
    expect(apiMocks.logout).toHaveBeenCalled();
  });

  it("gated: the Settings menu item navigates to /settings", async () => {
    (window as { __WORK4YOU_AUTH_REQUIRED__?: boolean }).__WORK4YOU_AUTH_REQUIRED__ =
      true;
    apiMocks.getAuthMe.mockResolvedValue({
      user_id: "u1",
      display_name: "Leo",
      email: "",
      provider: "work4you",
    });
    await renderWidget();
    const identity = container.querySelector(
      'button[aria-haspopup="menu"]',
    ) as HTMLButtonElement;
    act(() => {
      identity.click();
    });
    const settingsItem = document.body.querySelector(
      '[role="menu"] [role="menuitem"]',
    ) as HTMLButtonElement;
    act(() => {
      settingsItem.click();
    });
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/settings");
    // Menu closes after navigating.
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });
});
