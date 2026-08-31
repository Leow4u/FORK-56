// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/context";

const apiMocks = vi.hoisted(() => ({
  getSessions: vi.fn(async () => ({
    sessions: [
      {
        id: "sess-1",
        title: "Demo session",
        preview: null,
        last_active: 1_781_774_001,
        started_at: 1_781_774_000,
      },
    ],
  })),
  getSessionMessages: vi.fn(async () => ({
    session_id: "sess-1",
    messages: [
      {
        role: "assistant",
        content: "Reference: https://example.com/docs/getting-started",
        timestamp: 1_781_774_002,
      },
      {
        role: "tool",
        tool_name: "image_generate",
        content: JSON.stringify({
          image: "https://cdn.example.com/generated/cat.png",
          success: true,
        }),
        timestamp: 1_781_774_003,
      },
    ],
  })),
  readFsDataUrl: vi.fn(async () => ({ dataUrl: "data:image/png;base64,QQ==" })),
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

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

let container: HTMLDivElement;
let root: Root;

async function renderPage(path = "/artifacts") {
  const { default: ArtifactsPage } = await import("./ArtifactsPage");
  act(() => {
    root.render(
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <ArtifactsPage />
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

describe("ArtifactsPage", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getSessions.mockClear();
    apiMocks.getSessionMessages.mockClear();
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

  it("indexes recent session artifacts and exposes Desktop filter tabs", async () => {
    await renderPage();
    expect(apiMocks.getSessions).toHaveBeenCalledWith(30, 0, undefined, "recent");
    expect(apiMocks.getSessionMessages).toHaveBeenCalledWith("sess-1", "");
    expect(container.textContent).toContain("All");
    expect(container.textContent).toContain("Images");
    expect(container.textContent).toContain("Files");
    expect(container.textContent).toContain("Links");
    expect(container.textContent).toContain("getting-started");
    expect(container.textContent).toContain("cat.png");
    expect(container.textContent).toContain("Demo session");
  });
});
