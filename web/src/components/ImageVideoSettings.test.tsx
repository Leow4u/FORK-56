// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/context";

const apiMocks = vi.hoisted(() => ({
  getToolsets: vi.fn(),
  getToolsetConfig: vi.fn(),
  toggleToolset: vi.fn(),
  selectToolsetProvider: vi.fn(),
  saveToolsetEnv: vi.fn(),
  runToolsetPostSetup: vi.fn(),
  getActionStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setAfterTitle: vi.fn(), setEnd: vi.fn() }),
}));

function toolset(
  name: string,
  label: string,
  extra: Record<string, unknown> = {},
) {
  return {
    name,
    label,
    description: label,
    platform: "cli",
    platform_label: "CLI",
    enabled: true,
    configured: true,
    tools: [],
    ...extra,
  };
}

function provider(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    badge: "paid",
    tag: "",
    env_vars: [],
    post_setup: null,
    requires_work4you_auth: false,
    is_active: false,
    ...extra,
  };
}

let container: HTMLDivElement;
let root: Root;

async function renderSettings() {
  const { ImageVideoSettings } = await import("./ImageVideoSettings");
  act(() => {
    root.render(
      <I18nProvider>
        <MemoryRouter>
          <ImageVideoSettings />
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

describe("ImageVideoSettings", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getToolsets.mockResolvedValue([
      toolset("image_gen", "Image Generation"),
      toolset("video_gen", "Video Generation"),
      toolset("web", "Web Search"),
    ]);
    apiMocks.getToolsetConfig.mockImplementation(async (name: string) => {
      if (name === "video_gen") {
        return {
          name: "video_gen",
          has_category: true,
          active_provider: "Work4You Subscription",
          providers: [
            provider("Work4You Subscription", {
              badge: "subscription",
              requires_work4you_auth: true,
              is_active: true,
            }),
            provider("DeepInfra"),
            provider("FAL"),
            provider("xAI Grok Imagine"),
          ],
        };
      }
      return {
        name: "image_gen",
        has_category: true,
        active_provider: "Work4You Subscription",
        providers: [
          provider("Work4You Subscription", {
            badge: "subscription",
            requires_work4you_auth: true,
            is_active: true,
          }),
          provider("FAL.ai"),
          provider("DeepInfra"),
          provider("OpenAI"),
        ],
      };
    });
    apiMocks.toggleToolset.mockResolvedValue({
      ok: true,
      name: "image_gen",
      enabled: false,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    container?.remove();
    vi.clearAllMocks();
  });

  it("hosts Image and Video Generation inline with Subscription only", async () => {
    await renderSettings();
    const text = container.textContent ?? "";
    expect(text).toContain("Image Generation");
    expect(text).toContain("Video Generation");
    expect(text).toContain("Work4You Subscription");
    expect(text).not.toContain("Web Search");
    expect(text).not.toContain("DeepInfra");
    expect(text).not.toContain("FAL.ai");
    expect(text).not.toContain("xAI Grok Imagine");
    expect(container.querySelector('[aria-label="Close"]')).toBeNull();
  });

  it("toggles Image Generation through the existing toolset API", async () => {
    await renderSettings();
    const sw = container.querySelector(
      'button[aria-label="Enable toolset for CLI"]',
    ) as HTMLButtonElement | null;
    expect(sw).toBeTruthy();
    act(() => {
      sw!.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiMocks.toggleToolset).toHaveBeenCalled();
    expect(apiMocks.toggleToolset.mock.calls[0].slice(0, 2)).toEqual([
      "image_gen",
      false,
    ]);
  });
});
