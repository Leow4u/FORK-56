// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FooterPlan } from "@/app/account/use-account-footer";
import type { PortalAccountIdentity } from "@/lib/api";

const apiMocks = vi.hoisted(() => ({
  getAuthMe: vi.fn(),
  logout: vi.fn(async () => new Response()),
}));

const footer = vi.hoisted(() => ({
  identity: null as PortalAccountIdentity | null,
  plan: null as FooterPlan | null,
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/app/account/use-account-footer", async () => {
  const { accountCopyFor } = await import("@/app/account/copy");
  return {
    useAccountFooter: () => ({
      copy: accountCopyFor("en"),
      identity: footer.identity,
      plan: footer.plan,
    }),
  };
});

vi.mock("@/plugins", () => ({
  usePlugins: () => ({
    manifests: [
      {
        name: "work4you-achievements",
        label: "Achievements",
        tab: { path: "/achievements", hidden: true },
      },
    ],
    plugins: [],
    loading: false,
  }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    locale: "en",
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
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
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

function trigger(): HTMLButtonElement {
  return container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
}

function openMenu() {
  act(() => {
    trigger().click();
  });
}

function menuItems(): string[] {
  const menu = document.body.querySelector('[role="menu"]');
  if (!menu) return [];
  return Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
    (b) => b.textContent?.trim() ?? "",
  );
}

function clickItem(label: string) {
  const item = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
  ).find((b) => b.textContent?.trim() === label);
  expect(item, `menu item ${label}`).toBeTruthy();
  act(() => {
    item!.click();
  });
}

function location(): string | null | undefined {
  return container.querySelector('[data-testid="location"]')?.textContent;
}

describe("AuthWidget footer account area", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getAuthMe.mockReset();
    apiMocks.logout.mockClear();
    footer.identity = null;
    footer.plan = null;
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

  it("loopback (ungated): the menu reaches Account, Settings, Profile, Docs and plugins", async () => {
    await renderWidget();
    expect(trigger().textContent).toContain("Work4You");
    expect(trigger().textContent).not.toContain("Settings");

    openMenu();
    expect(menuItems()).toEqual([
      "Account",
      "Settings",
      "Profile",
      "Documentation",
      "Achievements",
    ]);

    clickItem("Settings");
    expect(location()).toBe("/settings");
  });

  it("Account and Profile open the account surface on the right section", async () => {
    await renderWidget();
    openMenu();
    clickItem("Account");
    expect(location()).toBe("/account");

    openMenu();
    clickItem("Profile");
    expect(location()).toBe("/account?section=profile");
  });

  it("Documentation and plugin items navigate to their routes", async () => {
    await renderWidget();
    openMenu();
    clickItem("Documentation");
    expect(location()).toBe("/docs");

    openMenu();
    clickItem("Achievements");
    expect(location()).toBe("/achievements");
  });

  it("shows the portal person and plan instead of the opaque user id", async () => {
    (window as { __WORK4YOU_AUTH_REQUIRED__?: boolean }).__WORK4YOU_AUTH_REQUIRED__ =
      true;
    apiMocks.getAuthMe.mockResolvedValue({
      user_id: "did:privy:cmt2abcdef",
      display_name: "",
      email: "",
      provider: "work4you",
    });
    footer.identity = { email: "ana@example.com", logged_in: true, name: "Ana Souza" };
    footer.plan = { isFree: false, label: "Plus", upgradable: false };
    await renderWidget();

    expect(trigger().textContent).toContain("Ana Souza");
    expect(trigger().textContent).toContain("Plus");
    expect(trigger().textContent).not.toContain("did:privy");
  });

  it("Free plan: Upgrade leads with the plans grid", async () => {
    footer.plan = { isFree: true, label: "Free plan", upgradable: true };
    await renderWidget();
    expect(trigger().textContent).toContain("Free plan");

    openMenu();
    expect(menuItems()[0]).toBe("Upgrade plan");
    clickItem("Upgrade plan");
    expect(location()).toBe("/account?section=billing&view=plans");
  });

  it("paid plan: no Upgrade item", async () => {
    footer.plan = { isFree: false, label: "Plus", upgradable: false };
    await renderWidget();
    openMenu();
    expect(menuItems()).not.toContain("Upgrade plan");
  });

  it("gated: the identity menu ends with Log out", async () => {
    (window as { __WORK4YOU_AUTH_REQUIRED__?: boolean }).__WORK4YOU_AUTH_REQUIRED__ =
      true;
    apiMocks.getAuthMe.mockResolvedValue({
      user_id: "did:privy:cmt2abcdef",
      display_name: "",
      email: "",
      provider: "work4you",
    });
    await renderWidget();

    expect(trigger().textContent).toContain("did:privy:cmt2…");

    openMenu();
    expect(menuItems().at(-1)).toBe("Log out");
    clickItem("Log out");
    expect(apiMocks.logout).toHaveBeenCalled();
  });
});
