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
        brand: "Work4You",
        footer: { org: "Work4You" },
        nav: { settings: "Settings", documentation: "Documentation" },
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

function menuItems(): string[] {
  const menu = document.body.querySelector('[role="menu"]');
  if (!menu) return [];
  return Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
    (b) => b.textContent?.trim() ?? "",
  );
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
    document.body
      .querySelectorAll('[role="menu"]')
      .forEach((node) => node.remove());
    delete (window as { __WORK4YOU_AUTH_REQUIRED__?: boolean })
      .__WORK4YOU_AUTH_REQUIRED__;
  });

  it("loopback (ungated): account row opens Settings and Documentation menu items", async () => {
    await renderWidget();
    const trigger = container.querySelector(
      'button[aria-haspopup="menu"]',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain("Work4You");
    expect(trigger.textContent).not.toContain("Settings");

    act(() => {
      trigger.click();
    });
    expect(menuItems()).toEqual(["Settings", "Documentation"]);

    act(() => {
      (
        document.body.querySelectorAll('[role="menuitem"]')[0] as HTMLButtonElement
      ).click();
    });
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/settings");
  });

  it("loopback (ungated): Documentation menu item navigates to /docs", async () => {
    await renderWidget();
    const trigger = container.querySelector(
      'button[aria-haspopup="menu"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    act(() => {
      (
        document.body.querySelectorAll('[role="menuitem"]')[1] as HTMLButtonElement
      ).click();
    });
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/docs");
  });

  it("gated: clicking the identity opens Settings, Documentation, and Log out", async () => {
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
    expect(identity.textContent).toContain("did:privy:cmt2…");

    act(() => {
      identity.click();
    });
    expect(menuItems()).toEqual(["Settings", "Documentation", "Log out"]);

    act(() => {
      (
        document.body.querySelectorAll('[role="menuitem"]')[2] as HTMLButtonElement
      ).click();
    });
    expect(apiMocks.logout).toHaveBeenCalled();
  });
});
