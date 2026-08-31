// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setEnd = vi.fn();
const setTitle = vi.fn();

const gatewayMocks = vi.hoisted(() => {
  const anyHandlers = new Set<(event: unknown) => void>();
  const stateHandlers = new Set<(state: string) => void>();
  return {
    close: vi.fn(),
    connect: vi.fn(async () => {
      for (const h of stateHandlers) h("open");
    }),
    onAny: vi.fn((handler: (event: unknown) => void) => {
      anyHandlers.add(handler);
      return () => anyHandlers.delete(handler);
    }),
    onState: vi.fn((handler: (state: string) => void) => {
      stateHandlers.add(handler);
      return () => stateHandlers.delete(handler);
    }),
    request: vi.fn(async (method: string) => {
      if (method === "session.create") {
        return { session_id: "live-1", stored_session_id: "stored-1", messages: [] };
      }
      if (method === "session.resume") {
        return {
          session_id: "live-r",
          stored_session_id: "abc123",
          messages: [{ role: "user", text: "from history" }],
        };
      }
      return {};
    }),
    reset() {
      anyHandlers.clear();
      stateHandlers.clear();
      this.close.mockClear();
      this.connect.mockClear();
      this.request.mockClear();
    },
  };
});

vi.mock("@/lib/gatewayClient", () => ({
  GatewayClient: class {
    close = gatewayMocks.close;
    connect = gatewayMocks.connect;
    onAny = gatewayMocks.onAny;
    onState = gatewayMocks.onState;
    request = gatewayMocks.request;
  },
}));

vi.mock("@/lib/api", () => ({
  api: {
    getSessions: vi.fn(async () => ({ sessions: [] })),
  },
}));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setEnd, setTitle }),
}));

vi.mock("@/contexts/useProfileScope", () => ({
  useProfileScope: () => ({ profile: "" }),
}));

import { resolveTranslations } from "@/i18n/resolve";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: resolveTranslations("en"),
    locale: "en" as const,
    setLocale: () => {},
  }),
}));

vi.mock("@/plugins", () => ({
  PluginSlot: ({ name }: { name: string }) => (
    <div data-plugin-slot={name} />
  ),
}));

vi.mock("@work4you/ui/ui/components/button", () => ({
  Button: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@work4you/ui/ui/components/typography/index", () => ({
  Typography: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@work4you/ui/ui/components/list-item", () => ({
  ListItem: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@work4you/ui/ui/components/spinner", () => ({
  Spinner: () => <span>loading</span>,
}));

vi.mock("@/components/Markdown", () => ({
  Markdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

function renderChat(
  path = "/chat",
  {
    isActive = true,
    newChatRef,
  }: {
    isActive?: boolean;
    newChatRef?: { current: (() => void) | null };
  } = {},
) {
  return import("./ChatPage").then(({ default: ChatPage }) => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <ChatPage isActive={isActive} newChatRef={newChatRef} />
          <LocationProbe />
        </MemoryRouter>,
      );
    });
  });
}

let container: HTMLDivElement;
let root: Root;

describe("ChatPage thin shell", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    setEnd.mockClear();
    setTitle.mockClear();
    gatewayMocks.reset();
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

  it("renders EmptyHome without a PTY terminal host", async () => {
    await renderChat();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector(".work4you-chat-xterm-host")).toBeNull();
    expect(container.textContent).toContain("Ready when you are.");
    expect(container.querySelector('[data-plugin-slot="chat:top"]')).toBeTruthy();
  });

  it("resumes when ?resume= is present", async () => {
    await renderChat("/chat?resume=abc123");
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[role="log"]')).toBeTruthy();
    expect(container.textContent).toContain("from history");
  });

  it("registers a New session header action when active", async () => {
    await renderChat();
    expect(setTitle).toHaveBeenCalledWith("Chat");
    expect(setEnd).toHaveBeenCalled();
    const end = setEnd.mock.calls.at(-1)?.[0];
    expect(end).toBeTruthy();
  });

  it("registers an Agents overlay action in the chat header", async () => {
    await renderChat();
    const labels: string[] = [];
    const walk = (node: unknown) => {
      if (node == null || typeof node === "boolean") return;
      if (typeof node === "string" || typeof node === "number") {
        labels.push(String(node));
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object" && node !== null && "props" in node) {
        const props = (
          node as {
            props: { children?: unknown; "aria-label"?: string };
          }
        ).props;
        if (props["aria-label"]) labels.push(props["aria-label"]);
        walk(props.children);
      }
    };
    walk(setEnd.mock.calls.at(-1)?.[0]);
    expect(labels.join(" ")).toContain("Agents");
  });

  it("does not clear the page header when the persistent host is hidden", async () => {
    await renderChat("/agents", { isActive: false });
    expect(setTitle).not.toHaveBeenCalled();
    expect(setEnd).not.toHaveBeenCalled();
  });

  it("does not rewrite a non-chat URL when New session resets the hidden host", async () => {
    const newChatRef = { current: null as (() => void) | null };
    await renderChat("/cron", { isActive: false, newChatRef });
    expect(newChatRef.current).toBeTruthy();
    act(() => {
      newChatRef.current?.();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/cron",
    );
  });

  it("clears resume params when New session runs on the active chat route", async () => {
    const newChatRef = { current: null as (() => void) | null };
    await renderChat("/chat?resume=abc123", { newChatRef });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("from history");
    act(() => {
      newChatRef.current?.();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/chat",
    );
  });
});
