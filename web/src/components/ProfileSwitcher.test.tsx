// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/context";

const profileMocks = vi.hoisted(() => ({
  profile: "",
  currentProfile: "default",
  profiles: ["default"],
  setProfile: vi.fn(),
}));

vi.mock("@/contexts/useProfileScope", () => ({
  useProfileScope: () => profileMocks,
}));

let container: HTMLDivElement;
let root: Root;

async function renderSwitcher() {
  const { ProfileSwitcher } = await import("./ProfileSwitcher");
  act(() => {
    root.render(
      <I18nProvider>
        <MemoryRouter>
          <ProfileSwitcher />
        </MemoryRouter>
      </I18nProvider>,
    );
  });
}

describe("ProfileSwitcher", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    profileMocks.profiles = ["default"];
    profileMocks.profile = "";
    profileMocks.currentProfile = "default";
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

  it("keeps Manage profiles reachable with a single profile", async () => {
    await renderSwitcher();
    const link = container.querySelector('a[href="/profiles"]');
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain("Manage profiles");
    expect(container.querySelector("#work4you-profile-switcher")).toBeNull();
  });

  it("shows the write-target switcher when multiple profiles exist", async () => {
    profileMocks.profiles = ["default", "coder"];
    await renderSwitcher();
    expect(container.querySelector("#work4you-profile-switcher")).toBeTruthy();
    expect(container.querySelector('a[href="/profiles"]')).toBeTruthy();
  });
});
