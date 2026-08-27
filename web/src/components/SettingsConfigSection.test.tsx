// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getConfig: vi.fn(async () => ({
    display: { personality: "default", show_reasoning: true },
    timezone: "UTC",
    agent: { image_input_mode: "auto" },
  })),
  getSchema: vi.fn(async () => ({
    fields: {
      "display.personality": {
        type: "string",
        category: "display",
        description: "Default assistant style for new sessions.",
      },
      timezone: {
        type: "string",
        category: "general",
        description: "IANA timezone identifier.",
      },
      "display.show_reasoning": {
        type: "boolean",
        category: "display",
        description: "Show reasoning sections when available.",
      },
      "agent.image_input_mode": {
        type: "string",
        category: "agent",
        description: "How image attachments are sent to the model.",
        options: ["auto", "native", "text"],
      },
    },
    category_order: ["general", "display", "agent"],
  })),
  saveConfig: vi.fn(async () => ({})),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@work4you/ui/hooks/use-toast", () => ({
  useToast: () => ({
    toast: null,
    showToast: vi.fn(),
  }),
}));

vi.mock("@work4you/ui/ui/components/toast", () => ({
  Toast: () => null,
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: {
      common: { loading: "Loading…", save: "Save", saving: "Saving…" },
      config: { configSaved: "Saved", failedToSave: "Failed to save" },
      skills: { cacheNote: "Changes apply to new sessions." },
    },
  }),
}));

let container: HTMLDivElement;
let root: Root;

const KEYS = [
  "display.personality",
  "timezone",
  "display.show_reasoning",
  "agent.image_input_mode",
] as const;

async function renderSection() {
  const { SettingsConfigSection } = await import("./SettingsConfigSection");
  act(() => {
    root.render(<SettingsConfigSection keys={KEYS} />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("SettingsConfigSection", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getConfig.mockClear();
    apiMocks.getSchema.mockClear();
    apiMocks.saveConfig.mockClear();
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

  it("loads config + schema and renders the curated fields", async () => {
    await renderSection();
    expect(apiMocks.getConfig).toHaveBeenCalled();
    expect(apiMocks.getSchema).toHaveBeenCalled();
    expect(container.textContent).toContain("Changes apply to new sessions.");
    expect(container.textContent).toContain("display.personality");
    expect(container.textContent).toContain("timezone");
    expect(container.textContent).toContain("display.show_reasoning");
    expect(container.textContent).toContain("agent.image_input_mode");
  });
});
