// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestLocalStorage } from "@/chat/test-local-storage";
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
      name: "google_meet",
      label: "Google Meet",
      description: "meet scheduling",
      enabled: true,
      configured: true,
      tools: ["google_meet_schedule"],
    },
    {
      name: "image_gen",
      label: "Image Generation",
      description: "Generate images",
      enabled: true,
      configured: true,
      tools: ["image_generate"],
    },
    {
      name: "browser",
      label: "Browser Automation",
      description: "Drive a real browser",
      enabled: true,
      configured: true,
      tools: ["browser_navigate"],
    },
    {
      name: "web",
      label: "Web Search & Scraping",
      description: "Search and extract public pages",
      enabled: true,
      configured: true,
      tools: ["web_search", "web_extract"],
    },
    {
      name: "memory",
      label: "Memory",
      description: "Persistent memory across sessions",
      enabled: true,
      configured: true,
      tools: ["memory_search"],
    },
    {
      name: "terminal",
      label: "Terminal & Processes",
      description: "Run shell commands",
      enabled: true,
      configured: true,
      tools: ["terminal"],
    },
    {
      name: "file",
      label: "File Operations",
      description: "Read and write files",
      enabled: true,
      configured: true,
      tools: ["read_file"],
    },
    {
      name: "code_execution",
      label: "Code Execution",
      description: "Run code in a sandbox",
      enabled: true,
      configured: true,
      tools: ["execute_code"],
    },
    {
      name: "skills",
      label: "Skills",
      description: "Manage installed skills as a toolset",
      enabled: true,
      configured: true,
      tools: ["skill_manage"],
    },
    {
      name: "computer_use",
      label: "Computer Use",
      description: "Drive the desktop with cua-driver",
      enabled: true,
      configured: true,
      tools: ["computer_use"],
    },
    {
      name: "vision",
      label: "Vision / Image Analysis",
      description: "vision_analyze",
      enabled: true,
      configured: true,
      tools: ["vision_analyze"],
    },
    {
      name: "clarify",
      label: "Clarifying Questions",
      description: "Ask the user a clarifying question",
      enabled: true,
      configured: true,
      tools: ["clarify"],
    },
    {
      name: "a2a",
      label: "A2A",
      description: "Agent-to-Agent protocol",
      enabled: true,
      configured: true,
      tools: ["a2a_call"],
    },
    {
      name: "video_gen",
      label: "Video Generation",
      description: "video_generate (text/image/reference)",
      enabled: true,
      configured: true,
      tools: ["video_generate"],
    },
    {
      name: "stt",
      label: "Speech-to-Text",
      description: "voice transcription (gateway voice messages + voice mode)",
      enabled: true,
      configured: true,
      tools: [],
    },
    {
      name: "tts",
      label: "Text-to-Speech",
      description: "text_to_speech",
      enabled: true,
      configured: true,
      tools: ["text_to_speech"],
    },
    {
      name: "bfl",
      label: "BFL FLUX 3 Video",
      description: "bfl_flux3_*",
      enabled: true,
      configured: true,
      tools: ["bfl_flux3_text_to_video"],
    },
    {
      name: "cronjob",
      label: "Cron Jobs",
      description: "create/list/update/pause/resume/run, with optional attached skills",
      enabled: true,
      configured: true,
      tools: ["cronjob"],
    },
    {
      name: "homeassistant",
      label: "Home Assistant",
      description: "smart home device control",
      enabled: true,
      configured: true,
      tools: ["ha_list_entities", "ha_get_state", "ha_list_services", "ha_call_service"],
    },
    {
      name: "session_search",
      label: "Session Search",
      description: "search past conversations",
      enabled: true,
      configured: true,
      tools: ["session_search_recall"],
    },
    {
      name: "spotify",
      label: "Spotify",
      description: "playback, search, playlists, library",
      enabled: true,
      configured: true,
      tools: ["spotify_playback"],
    },
    {
      name: "delegation",
      label: "Task Delegation",
      description: "delegate_task",
      enabled: true,
      configured: true,
      tools: ["delegate_task"],
    },
    {
      name: "todo",
      label: "Task Planning",
      description: "todo",
      enabled: true,
      configured: true,
      tools: ["todo"],
    },
    {
      name: "video",
      label: "Video Analysis",
      description: "video_analyze (requires video-capable model)",
      enabled: true,
      configured: true,
      tools: ["video_analyze"],
    },
    {
      name: "x_search",
      label: "X (Twitter) Search",
      description: "x_search (requires xAI OAuth or XAI_API_KEY)",
      enabled: true,
      configured: true,
      tools: ["x_search"],
    },
    {
      name: "discord",
      label: "Discord",
      description: "Platform-coupled; not a dashboard toggle",
      enabled: true,
      configured: true,
      tools: ["discord_send"],
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

vi.mock("@/components/env-settings-panels", () => ({
  EnvCredentialsPanel: ({ view }: { view: string }) => (
    <div data-testid="custom-keys-panel" data-view={view} />
  ),
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
    // Node 26 CI exposes a broken experimental localStorage that jsdom does
    // not always replace — install the in-memory Storage the fork ships for
    // exactly this (see chat/test-local-storage.ts).
    resetTestLocalStorage();
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
    expect(text).toContain("Skills are playbooks.");
    expect(container.querySelector('[aria-label="Edit learned-skill"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Edit hub-skill"]')).toBeNull();
  });

  it("renders the toolsets grid under ?tab=tools", async () => {
    await renderPage("/skills?tab=tools");
    const text = container.textContent ?? "";
    expect(text).toContain("Google Meet");
    expect(text).toContain("meet scheduling");
    expect(text).not.toContain("Image Generation");
    expect(text).not.toContain("Generate images");
    expect(text).not.toContain("Video Generation");
    expect(text).not.toContain("video_generate (text/image/reference)");
    expect(text).not.toContain("Browser Automation");
    expect(text).not.toContain("Drive a real browser");
    expect(text).not.toContain("Web Search & Scraping");
    expect(text).not.toContain("Persistent memory across sessions");
    expect(text).not.toContain("Terminal & Processes");
    expect(text).not.toContain("File Operations");
    expect(text).not.toContain("Code Execution");
    expect(text).not.toContain("Manage installed skills as a toolset");
    expect(text).not.toContain("Computer Use");
    expect(text).not.toContain("Vision / Image Analysis");
    expect(text).not.toContain("vision_analyze");
    expect(text).not.toContain("Clarifying Questions");
    expect(text).not.toContain("Ask the user a clarifying question");
    expect(text).not.toContain("Agent-to-Agent protocol");
    expect(text).not.toContain("BFL FLUX 3 Video");
    expect(text).not.toContain("bfl_flux3_");
    expect(text).not.toContain("Cron Jobs");
    expect(text).not.toContain("create/list/update/pause/resume/run");
    expect(text).not.toContain("Home Assistant");
    expect(text).not.toContain("smart home device control");
    expect(text).not.toContain("ha_list_entities");
    expect(text).not.toContain("Session Search");
    expect(text).not.toContain("search past conversations");
    expect(text).not.toContain("playback, search, playlists, library");
    expect(text).not.toContain("Spotify");
    expect(text).not.toContain("Task Delegation");
    expect(text).not.toContain("delegate_task");
    expect(text).not.toContain("Task Planning");
    expect(text).not.toContain("Video Analysis");
    expect(text).not.toContain("video_analyze");
    expect(text).not.toContain("X (Twitter) Search");
    expect(text).not.toContain("Speech-to-Text");
    expect(text).not.toContain("voice transcription (gateway voice messages + voice mode)");
    expect(text).not.toContain("Text-to-Speech");
    expect(text).not.toContain("text_to_speech");
    expect(text).not.toContain("Platform-coupled; not a dashboard toggle");
    // Skills list is not shown on the Tools tab.
    expect(text).not.toContain("learned-skill");
    const configureButtons = Array.from(container.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("Configure"),
    );
    expect(configureButtons).toHaveLength(1);
  });

  it("hides the Tools tab when every remaining toolset is already hidden", async () => {
    apiMocks.getToolsets.mockResolvedValue([
      {
        name: "image_gen",
        label: "Image Generation",
        description: "Generate images",
        enabled: true,
        configured: true,
        tools: ["image_generate"],
      },
      {
        name: "web",
        label: "Web Search & Scraping",
        description: "Search and extract public pages",
        enabled: true,
        configured: true,
        tools: ["web_search", "web_extract"],
      },
      {
        name: "stt",
        label: "Speech-to-Text",
        description: "voice transcription",
        enabled: true,
        configured: true,
        tools: ["stt_transcribe"],
      },
    ]);
    await renderPage("/skills?tab=tools");
    const radios = Array.from(container.querySelectorAll('[role="radio"]')).map(
      (el) => el.textContent,
    );
    expect(radios).toEqual(["Skills", "MCP"]);
    expect(container.textContent).toContain("learned-skill");
    expect(container.textContent).not.toContain("Google Meet");
    expect(container.textContent).not.toContain("Image Generation");
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/skills",
    );
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
