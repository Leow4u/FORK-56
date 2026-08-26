// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/context";

const apiMocks = vi.hoisted(() => ({
  getSkills: vi.fn(async () => [
    {
      name: "learned-skill",
      description: "An agent-authored skill",
      category: "research",
      enabled: true,
      usage: 4,
      provenance: "agent",
    },
    {
      name: "hub-skill",
      description: "Installed from the hub",
      category: "research",
      enabled: true,
      usage: 0,
      provenance: "hub",
    },
  ]),
  getToolsets: vi.fn(async () => [
    {
      name: "browser",
      label: "Browser",
      description: "Drive a real browser",
      enabled: true,
      configured: true,
      tools: ["browser_navigate"],
    },
  ]),
  toggleSkill: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setAfterTitle: vi.fn(), setEnd: vi.fn() }),
}));

vi.mock("@/contexts/useProfileScope", () => ({
  useProfileScope: () => ({ profile: "" }),
}));

vi.mock("@/plugins", () => ({
  PluginSlot: ({ name }: { name: string }) => (
    <div data-plugin-slot={name} />
  ),
}));

vi.mock("@/components/ToolsetConfigDrawer", () => ({
  ToolsetConfigDrawer: () => null,
}));

vi.mock("@/components/SkillEditorDialog", () => ({
  SkillEditorDialog: () => null,
}));

vi.mock("@/pages/McpPage", () => ({
  default: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="mcp-page" data-embedded={String(Boolean(embedded))}>
      mcp servers
    </div>
  ),
}));

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

let container: HTMLDivElement;
let root: Root;

async function renderPage(path = "/skills") {
  const { default: SkillsPage } = await import("./SkillsPage");
  act(() => {
    root.render(
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <SkillsPage />
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("SkillsPage (Capabilities)", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    apiMocks.getSkills.mockClear();
    apiMocks.getToolsets.mockClear();
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

  it("defaults to the Skills tab with provenance and usage badges", async () => {
    await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("learned-skill");
    expect(text).toContain("Learned");
    expect(text).toContain("Hub");
    expect(text).toContain("×4");
    // Cache-awareness note (desktop parity).
    expect(text).toContain("Changes apply to new sessions.");
  });

  it("renders the toolsets grid under ?tab=tools", async () => {
    await renderPage("/skills?tab=tools");
    const text = container.textContent ?? "";
    expect(text).toContain("Browser");
    expect(text).toContain("Drive a real browser");
    // Skills list is not shown on the Tools tab.
    expect(text).not.toContain("learned-skill");
  });

  it("renders the embedded MCP page under ?tab=mcp", async () => {
    await renderPage("/skills?tab=mcp");
    const mcp = container.querySelector('[data-testid="mcp-page"]');
    expect(mcp).toBeTruthy();
    expect(mcp?.getAttribute("data-embedded")).toBe("true");
  });

  it("Learn a skill seeds the /learn slash command into the chat", async () => {
    await renderPage();
    const learnButton = Array.from(
      container.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Learn a skill")) as
      | HTMLButtonElement
      | undefined;
    expect(learnButton).toBeTruthy();
    act(() => {
      learnButton!.click();
    });
    const textarea = document.body.querySelector(
      "textarea",
    ) as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(textarea, "how I file an expense report");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const learnIt = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Learn it")) as
      | HTMLButtonElement
      | undefined;
    expect(learnIt).toBeTruthy();
    act(() => {
      learnIt!.click();
    });
    const location = container.querySelector(
      '[data-testid="location"]',
    )?.textContent;
    expect(location).toBe(
      `/chat?learn=${encodeURIComponent("/learn how I file an expense report")}`,
    );
  });
});
