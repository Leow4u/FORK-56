// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setEnd = vi.fn();
const setTitle = vi.fn();

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setEnd, setTitle }),
}));

vi.mock("@/contexts/useProfileScope", () => ({
  useProfileScope: () => ({ profile: "" }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: {
      app: { nav: { chat: "Chat" } },
      sessions: { newChat: "New chat" },
    },
  }),
}));

vi.mock("@/plugins", () => ({
  PluginSlot: ({ name }: { name: string }) => (
    <div data-plugin-slot={name} />
  ),
}));

vi.mock("@work4you/ui/ui/components/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ghost?: boolean; size?: string }) => {
    const { ghost: _g, size: _s, ...rest } = props;
    return (
      <button type="button" {...rest}>
        {children}
      </button>
    );
  },
}));

vi.mock("@work4you/ui/ui/components/typography/index", () => ({
  Typography: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/Markdown", () => ({
  Markdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

function renderChat(path = "/chat") {
  return import("./ChatPage").then(({ default: ChatPage }) => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <ChatPage isActive />
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
    expect(container.querySelector(".work4you-chat-xterm-host")).toBeNull();
    expect(container.textContent).toContain("Work4You");
    expect(container.querySelector('[data-plugin-slot="chat:top"]')).toBeTruthy();
  });

  it("seeds SessionView when ?resume= is present", async () => {
    await renderChat("/chat?resume=abc123");
    expect(container.querySelector('[role="log"]')).toBeTruthy();
    expect(container.textContent).toContain("Session resume will load");
  });

  it("registers a New chat header action when active", async () => {
    await renderChat();
    expect(setTitle).toHaveBeenCalledWith("Chat");
    expect(setEnd).toHaveBeenCalled();
    const end = setEnd.mock.calls.at(-1)?.[0];
    expect(end).toBeTruthy();
  });
});
