// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/context";
import type { StarmapGraph } from "@/types/work4you";

const starmapMocks = vi.hoisted(() => {
  const graph: { current: StarmapGraph | null } = { current: null };
  const loading = { current: false };
  const error: { current: string | null } = { current: null };
  return {
    error,
    graph,
    loadStarmapGraph: vi.fn(async () => {}),
    loading,
    resetStarmapGraph: vi.fn(),
  };
});

vi.mock("@nanostores/react", () => ({
  useStore: (store: { get: () => unknown }) => store.get(),
}));

vi.mock("@/store/starmap", () => ({
  $starmapError: { get: () => starmapMocks.error.current },
  $starmapGraph: { get: () => starmapMocks.graph.current },
  $starmapLoading: { get: () => starmapMocks.loading.current },
  loadStarmapGraph: starmapMocks.loadStarmapGraph,
  resetStarmapGraph: starmapMocks.resetStarmapGraph,
}));

vi.mock("@/app/starmap/star-map", () => ({
  StarMap: ({ graph }: { graph: StarmapGraph }) => (
    <div data-testid="star-map">{graph.nodes.length} nodes</div>
  ),
}));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setTitle: vi.fn(), setEnd: vi.fn() }),
}));

vi.mock("@/contexts/useProfileScope", () => ({
  useProfileScope: () => ({ profile: "" }),
}));

vi.mock("@work4you/ui/ui/components/spinner", () => ({
  Spinner: () => <span>spinner</span>,
}));

function emptyGraph(): StarmapGraph {
  return { clusters: [], edges: [], memory: [], nodes: [], stats: {} };
}

function seededGraph(): StarmapGraph {
  return {
    clusters: [{ category: "devops", count: 1 }],
    edges: [],
    memory: [],
    nodes: [
      {
        category: "devops",
        createdBy: "agent",
        id: "skill-a",
        kind: "skill",
        label: "skill-a",
        pinned: false,
        state: "active",
        timestamp: 1_700_000_000,
        useCount: 1,
      },
    ],
    stats: {},
  };
}

let container: HTMLDivElement;
let root: Root;

async function renderPage() {
  const { default: StarmapPage } = await import("./StarmapPage");
  act(() => {
    root.render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/starmap"]}>
          <StarmapPage />
        </MemoryRouter>
      </I18nProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("StarmapPage", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    starmapMocks.graph.current = null;
    starmapMocks.loading.current = false;
    starmapMocks.error.current = null;
    starmapMocks.loadStarmapGraph.mockClear();
    starmapMocks.resetStarmapGraph.mockClear();
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

  it("shows the empty learned-graph copy when the scan returns no nodes", async () => {
    starmapMocks.graph.current = emptyGraph();
    await renderPage();
    expect(starmapMocks.resetStarmapGraph).toHaveBeenCalled();
    expect(starmapMocks.loadStarmapGraph).toHaveBeenCalledWith(true);
    expect(container.textContent).toContain("Nothing learned yet");
    expect(container.textContent).toContain(
      "As Work4You builds skills and memories for your work, they appear here.",
    );
    expect(container.querySelector('[data-testid="star-map"]')).toBeNull();
  });

  it("renders the map when the profile has learned nodes", async () => {
    starmapMocks.graph.current = seededGraph();
    await renderPage();
    expect(container.querySelector('[data-testid="star-map"]')?.textContent).toBe(
      "1 nodes",
    );
    expect(container.textContent).not.toContain("Nothing learned yet");
  });
});
