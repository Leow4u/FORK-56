// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getAuxiliaryModels: vi.fn(async () => ({
    main: { provider: "work4you", model: "z-ai/glm-5.2" },
    tasks: [],
  })),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

const panelProps = vi.hoisted(() => ({ calls: [] as unknown[] }));

vi.mock("@/pages/ModelsPage", () => ({
  ModelSettingsPanel: (props: Record<string, unknown>) => {
    panelProps.calls.push(props);
    return <div data-testid="model-settings-panel">model settings</div>;
  },
}));

vi.mock("@/pages/PluginsPage", () => ({
  ProvidersCard: () => (
    <div data-testid="providers-card">memory and context providers</div>
  ),
}));

vi.mock("@/components/SettingsConfigSection", () => ({
  SettingsConfigSection: ({ keys }: { keys: readonly string[] }) => (
    <div data-testid="settings-config-section">{keys.join(",")}</div>
  ),
}));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setTitle: vi.fn(), setEnd: vi.fn() }),
}));

vi.mock("@/plugins", () => ({
  PluginSlot: ({ name }: { name: string }) => (
    <div data-plugin-slot={name} />
  ),
}));

let container: HTMLDivElement;
let root: Root;

async function renderPage(path = "/settings") {
  const { default: SettingsPage } = await import("./SettingsPage");
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <SettingsPage />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("SettingsPage", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getAuxiliaryModels.mockClear();
    panelProps.calls.length = 0;
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

  it("renders the section nav with Model active and the moved panel", async () => {
    await renderPage();
    const nav = container.querySelector('nav[aria-label="Settings sections"]');
    expect(nav).toBeTruthy();
    const active = nav!.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Model");
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeTruthy();
    // The section loads auxiliary models through the same API the Models
    // page used.
    expect(apiMocks.getAuxiliaryModels).toHaveBeenCalled();
  });

  it("resolves an unknown ?section= back to the default section", async () => {
    await renderPage("/settings?section=nope");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Model");
  });

  it("renders the Memory & Context section with the providers card", async () => {
    await renderPage("/settings?section=memory");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Memory & Context");
    expect(
      container.querySelector('[data-testid="providers-card"]'),
    ).toBeTruthy();
    // Model panel is not mounted on this section.
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeNull();
  });

  it("renders the Chat section with the curated config keys", async () => {
    await renderPage("/settings?section=chat");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Chat");
    const section = container.querySelector(
      '[data-testid="settings-config-section"]',
    );
    expect(section).toBeTruthy();
    expect(section?.textContent).toContain("display.personality");
    expect(section?.textContent).toContain("agent.image_input_mode");
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeNull();
  });

  it("renders the Workspace section with the curated config keys", async () => {
    await renderPage("/settings?section=workspace");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Workspace");
    const section = container.querySelector(
      '[data-testid="settings-config-section"]',
    );
    expect(section).toBeTruthy();
    expect(section?.textContent).toContain("terminal.cwd");
    expect(section?.textContent).toContain("code_execution.mode");
    expect(section?.textContent).toContain("file_read_max_chars");
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeNull();
  });
});
