// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW_SECONDS = Date.now() / 1000;

const apiMocks = vi.hoisted(() => ({
  getSessions: vi.fn(),
  searchSessions: vi.fn(async () => ({ results: [] })),
  setSessionPinned: vi.fn(async () => ({ ok: true, pinned: true })),
  setSessionArchived: vi.fn(async () => ({ ok: true, archived: true })),
  renameSession: vi.fn(async () => ({ ok: true, title: "Renamed" })),
  deleteSession: vi.fn(async () => ({ ok: true })),
  exportSessionUrl: vi.fn(
    (id: string, profile?: string) =>
      `/api/sessions/${id}/export?profile=${profile ?? ""}`,
  ),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: {
      common: { loading: "Loading", retry: "Retry", refresh: "Refresh" },
      sessions: {
        title: "Sessions",
        newChat: "New chat",
        searchPlaceholder: "Search message content...",
        noSessions: "No sessions yet",
        noMatch: "No sessions match",
        untitledSession: "Untitled session",
        pinnedSection: "Pinned",
        pinSession: "Pin",
        unpinSession: "Unpin",
        archiveSession: "Archive",
        renameSession: "Rename",
        openInTui: "Open in TUI",
      },
    },
  }),
}));

interface MockButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  prefix?: ReactNode;
  ghost?: boolean;
  outlined?: boolean;
  destructive?: boolean;
  size?: string;
}

vi.mock("@work4you/ui/ui/components/button", () => ({
  Button: (allProps: MockButtonProps) => {
    const { children, prefix, ghost, outlined, destructive, size, ...props } =
      allProps;
    void ghost;
    void outlined;
    void destructive;
    void size;
    return (
      <button type="button" {...props}>
        {prefix}
        {children}
      </button>
    );
  },
}));

vi.mock("@work4you/ui/ui/components/list-item", () => ({
  ListItem: (
    allProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      children?: ReactNode;
      active?: boolean;
    },
  ) => {
    const { children, active, ...props } = allProps;
    void active;
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock("@work4you/ui/ui/components/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@work4you/ui/ui/components/spinner", () => ({
  Spinner: () => <span data-spinner />,
}));

vi.mock("@/components/DeleteConfirmDialog", () => ({
  DeleteConfirmDialog: ({
    open,
    onConfirm,
    title,
  }: {
    open: boolean;
    onConfirm: () => void;
    title: string;
  }) =>
    open ? (
      <button type="button" data-testid="delete-confirm" onClick={onConfirm}>
        {title}
      </button>
    ) : null,
}));

vi.mock("@/components/TuiPtyModal", () => ({
  TuiPtyModal: ({
    open,
    resumeSessionId,
  }: {
    open: boolean;
    resumeSessionId: string;
  }) =>
    open ? (
      <div data-testid="tui-modal" data-resume={resumeSessionId} />
    ) : null,
}));

function sessionFixture(overrides: Record<string, unknown>) {
  return {
    id: "s-1",
    source: "cli",
    model: null,
    title: null,
    started_at: NOW_SECONDS - 600,
    ended_at: null,
    last_active: NOW_SECONDS - 60,
    is_active: false,
    message_count: 2,
    tool_call_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    preview: null,
    pinned: false,
    archived: false,
    ...overrides,
  };
}

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

let container: HTMLDivElement;
let root: Root;

async function renderList() {
  const { ChatSessionList } = await import("./ChatSessionList");
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/skills"]}>
        <ChatSessionList activeSessionId={null} />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  // Let the initial getSessions promise settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ChatSessionList", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getSessions.mockReset();
    apiMocks.setSessionPinned.mockClear();
    apiMocks.setSessionArchived.mockClear();
    apiMocks.renameSession.mockClear();
    apiMocks.getSessions.mockResolvedValue({
      sessions: [
        sessionFixture({ id: "pinned-1", title: "Pinned convo", pinned: true }),
        sessionFixture({ id: "recent-1", title: "Recent convo" }),
      ],
    });
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

  it("groups pinned sessions under a Pinned header, before the rest", async () => {
    await renderList();
    const text = container.textContent ?? "";
    expect(text).toContain("Pinned");
    expect(text.indexOf("Pinned convo")).toBeGreaterThan(-1);
    expect(text.indexOf("Pinned convo")).toBeLessThan(
      text.indexOf("Recent convo"),
    );
    // The pinned row offers Unpin; the unpinned row offers Pin.
    expect(container.querySelector('[aria-label="Unpin"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Pin"]')).toBeTruthy();
  });

  it("picking a row navigates to /chat?resume=<id> from any route", async () => {
    await renderList();
    const rows = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.includes("Recent convo"),
    );
    expect(rows.length).toBeGreaterThan(0);
    act(() => {
      rows[0].click();
    });
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/chat?resume=recent-1");
  });

  it("pin/unpin and archive go through the shared PATCH surface and refetch", async () => {
    await renderList();
    const initialLoads = apiMocks.getSessions.mock.calls.length;

    const pinButton = container.querySelector(
      '[aria-label="Pin"]',
    ) as HTMLButtonElement;
    await act(async () => {
      pinButton.click();
      await Promise.resolve();
    });
    expect(apiMocks.setSessionPinned).toHaveBeenCalledWith(
      "recent-1",
      true,
      "",
    );

    const archiveButton = container.querySelector(
      '[aria-label="Archive"]',
    ) as HTMLButtonElement;
    await act(async () => {
      archiveButton.click();
      await Promise.resolve();
    });
    expect(apiMocks.setSessionArchived).toHaveBeenCalledWith(
      expect.any(String),
      true,
      "",
    );

    // Each successful action triggers a list refetch.
    expect(apiMocks.getSessions.mock.calls.length).toBeGreaterThan(
      initialLoads,
    );
  });

  it("renames inline through renameSession", async () => {
    await renderList();
    const renameButton = container.querySelector(
      '[aria-label="Rename"]',
    ) as HTMLButtonElement;
    act(() => {
      renameButton.click();
    });
    const input = container.querySelector(
      'input[placeholder="Untitled session"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => {
      // React tracks input value via its own setter; assign then dispatch.
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "My renamed chat");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await Promise.resolve();
    });
    expect(apiMocks.renameSession).toHaveBeenCalledWith(
      expect.any(String),
      "My renamed chat",
      "",
    );
  });

  it("opens embedded TUI PTY (/api/pty) for the session row", async () => {
    await renderList();
    const recentRow = Array.from(
      container.querySelectorAll("[class*='group/row']"),
    ).find((el) => el.textContent?.includes("Recent convo"));
    const openTui = recentRow?.querySelector(
      '[aria-label="Open in TUI"]',
    ) as HTMLButtonElement;
    expect(openTui).toBeTruthy();
    act(() => {
      openTui.click();
    });
    const modal = container.querySelector('[data-testid="tui-modal"]');
    expect(modal).toBeTruthy();
    expect(modal?.getAttribute("data-resume")).toBe("recent-1");
  });
});
