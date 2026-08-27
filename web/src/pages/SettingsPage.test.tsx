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

vi.mock("@/components/appearance-panels", () => ({
  AppearanceSettingsSection: () => (
    <div data-testid="appearance-settings-section">appearance settings</div>
  ),
}));

vi.mock("@/pages/PluginsPage", () => ({
  ProvidersCard: () => (
    <div data-testid="providers-card">memory and context providers</div>
  ),
}));

vi.mock("@/components/env-settings-panels", () => ({
  EnvCredentialsPanel: ({ view }: { view: string }) => (
    <div data-testid="env-credentials-panel" data-view={view} />
  ),
}));

vi.mock("@/components/custom-endpoints-settings", () => ({
  CustomEndpointsSettingsSection: () => (
    <div data-testid="custom-endpoints-section">custom endpoints</div>
  ),
}));

vi.mock("@/components/cloud-computer-panel", () => ({
  CloudComputerPanel: () => (
    <div data-testid="cloud-computer-panel">my computer</div>
  ),
}));

vi.mock("@/components/portal-accounts-panel", () => ({
  PortalAccountsPanel: () => (
    <div data-testid="portal-accounts-panel">portal accounts</div>
  ),
}));

vi.mock("@/components/SettingsConfigSection", () => ({
  SettingsConfigSection: ({
    keys,
    visibleKey,
    guardToolsetsWipe,
  }: {
    keys: readonly string[];
    visibleKey?: (key: string, config: Record<string, unknown>) => boolean;
    guardToolsetsWipe?: boolean;
  }) => (
    <div
      data-testid="settings-config-section"
      data-has-visible-filter={visibleKey ? "true" : "false"}
      data-guard-toolsets-wipe={guardToolsetsWipe ? "true" : "false"}
    >
      {keys.join(",")}
    </div>
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

  it("renders the section nav with Model active, the moved panel, and config keys", async () => {
    await renderPage();
    const nav = container.querySelector('nav[aria-label="Settings sections"]');
    expect(nav).toBeTruthy();
    const active = nav!.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Model");
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeTruthy();
    const section = container.querySelector(
      '[data-testid="settings-config-section"]',
    );
    expect(section).toBeTruthy();
    expect(section?.textContent).toContain("model_context_length");
    expect(section?.textContent).toContain("fallback_providers");
    // The section loads auxiliary models through the same API the Models
    // page used.
    expect(apiMocks.getAuxiliaryModels).toHaveBeenCalled();
  });

  it("resolves an unknown ?section= back to the default section", async () => {
    await renderPage("/settings?section=nope");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Model");
  });

  it("renders the Memory & Context section with providers card and config keys", async () => {
    await renderPage("/settings?section=memory");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Memory & Context");
    expect(
      container.querySelector('[data-testid="providers-card"]'),
    ).toBeTruthy();
    const sections = container.querySelectorAll(
      '[data-testid="settings-config-section"]',
    );
    expect(sections.length).toBe(2);
    const keysText = [...sections].map((el) => el.textContent ?? "").join(",");
    expect(keysText).toContain("memory.memory_enabled");
    expect(keysText).toContain("memory.user_char_limit");
    expect(keysText).toContain("compression.enabled");
    expect(keysText).toContain("compression.protect_last_n");
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeNull();
  });

  it("renders the Appearance section with the theme and language panels", async () => {
    await renderPage("/settings?section=appearance");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Appearance");
    expect(
      container.querySelector('[data-testid="appearance-settings-section"]'),
    ).toBeTruthy();
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

  it("renders the Safety section with the curated config keys", async () => {
    await renderPage("/settings?section=safety");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Safety");
    const section = container.querySelector(
      '[data-testid="settings-config-section"]',
    );
    expect(section).toBeTruthy();
    expect(section?.textContent).toContain("approvals.mode");
    expect(section?.textContent).toContain("command_allowlist");
    expect(section?.textContent).toContain("checkpoints.enabled");
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeNull();
  });

  it("renders the Voice section with keys and provider visibility filter", async () => {
    await renderPage("/settings?section=voice");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Voice");
    const section = container.querySelector(
      '[data-testid="settings-config-section"]',
    );
    expect(section).toBeTruthy();
    expect(section?.getAttribute("data-has-visible-filter")).toBe("true");
    expect(section?.textContent).toContain("tts.provider");
    expect(section?.textContent).toContain("stt.provider");
    expect(section?.textContent).toContain("voice.auto_tts");
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeNull();
  });

  it("renders the Advanced section with the curated config keys", async () => {
    await renderPage("/settings?section=advanced");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Advanced");
    const section = container.querySelector(
      '[data-testid="settings-config-section"]',
    );
    expect(section).toBeTruthy();
    expect(section?.getAttribute("data-guard-toolsets-wipe")).toBe("true");
    expect(section?.textContent).toContain("toolsets");
    expect(section?.textContent).toContain("terminal.backend");
    expect(section?.textContent).toContain("delegation.max_iterations");
    expect(section?.textContent).toContain(
      "updates.non_interactive_local_changes",
    );
    expect(
      container.querySelector('[data-testid="model-settings-panel"]'),
    ).toBeNull();
  });

  it("renders the Providers section with accounts credentials panel", async () => {
    await renderPage("/settings?section=providers");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Providers");
    expect(
      container.querySelector('[data-testid="portal-accounts-panel"]'),
    ).toBeTruthy();
    const panel = container.querySelector('[data-testid="env-credentials-panel"]');
    expect(panel?.getAttribute("data-view")).toBe("providers-accounts");
  });

  it("renders the My Computer section with cloud host metrics", async () => {
    await renderPage("/settings?section=my-computer");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("My Computer");
    expect(
      container.querySelector('[data-testid="cloud-computer-panel"]'),
    ).toBeTruthy();
  });

  it("renders the Tools & Keys section with tools credentials panel", async () => {
    await renderPage("/settings?section=keys&view=tools&key=OPENAI_API_KEY");
    const active = container.querySelector('[aria-current="true"]');
    expect(active?.textContent).toContain("Tools & Keys");
    const panel = container.querySelector('[data-testid="env-credentials-panel"]');
    expect(panel?.getAttribute("data-view")).toBe("keys-tools");
  });
});
