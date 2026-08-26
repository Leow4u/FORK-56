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
});
