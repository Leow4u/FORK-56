// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/context";
import { $subagentsBySession, upsertSubagent } from "@/store/subagents";

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({
    setAfterTitle: vi.fn(),
    setEnd: vi.fn(),
    setTitle: vi.fn(),
  }),
}));

vi.mock("@/plugins", () => ({
  PluginSlot: ({ name }: { name: string }) => (
    <div data-plugin-slot={name} />
  ),
}));

let container: HTMLDivElement;
let root: Root;

async function renderPage() {
  const { default: AgentsPage } = await import("./AgentsPage");
  act(() => {
    root.render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/agents"]}>
          <AgentsPage />
        </MemoryRouter>
      </I18nProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AgentsPage", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    $subagentsBySession.set({});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    $subagentsBySession.set({});
  });

  it("shows the empty spawn-tree copy when no subagents are live", async () => {
    await renderPage();
    expect(container.querySelector('[data-testid="agents-empty"]')).toBeTruthy();
    expect(container.textContent).toContain("No live subagents");
    expect(container.textContent).toContain(
      "When a turn delegates work, child agents stream their progress here.",
    );
  });

  it("renders aggregated rows from every session", async () => {
    upsertSubagent("s1", {
      goal: "scan files",
      status: "running",
      subagent_id: "a1",
      task_index: 0,
      model: "demo-model",
    });
    upsertSubagent("s2", {
      goal: "write tests",
      status: "completed",
      subagent_id: "a2",
      task_index: 0,
      summary: "done",
    });

    await renderPage();

    expect(container.querySelector('[data-testid="agents-tree"]')).toBeTruthy();
    expect(container.textContent).toContain("scan files");
    expect(container.textContent).toContain("write tests");
    expect(container.textContent).toContain("2 agents");
    expect(container.textContent).toContain("1 active");
  });
});
