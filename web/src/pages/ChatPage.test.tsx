// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/desktop-chat/WebChatApp", () => ({
  WebChatApp: ({ isActive }: { isActive?: boolean }) =>
    isActive === false ? (
      <div data-web-desktop-chat-host="idle" aria-hidden />
    ) : (
      <div data-web-desktop-chat-host="active">
        <div data-testid="contrib-wiring">
          <div data-testid="wired-pane-sidebar" />
          <div data-testid="wired-pane-chatRoutes" />
        </div>
      </div>
    ),
}));

vi.mock("@/desktop-chat/bridge", () => ({
  installWebDesktopBridge: () => {
    window.work4youDesktop = { api: async () => ({}) };
  },
  removeWebDesktopBridge: () => {
    Reflect.deleteProperty(window, "work4youDesktop");
  },
}));

async function flushMount() {
  // ChatPage mounts WebChatApp asynchronously via createRoot + dynamic import.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ChatPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.__WORK4YOU_SESSION_TOKEN__ = "test-token";
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    Reflect.deleteProperty(window, "work4youDesktop");
    Reflect.deleteProperty(window, "__WORK4YOU_SESSION_TOKEN__");
  });

  it("renders the desktop chat shell when active", async () => {
    const { default: ChatPage } = await import("./ChatPage");

    await act(async () => {
      root.render(<ChatPage isActive />);
    });
    await flushMount();

    expect(container.querySelector('[data-web-desktop-chat-host="active"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="contrib-wiring"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="wired-pane-sidebar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="wired-pane-chatRoutes"]')).toBeTruthy();
  });

  it("keeps the host mounted but hidden when inactive", async () => {
    const { default: ChatPage } = await import("./ChatPage");

    await act(async () => {
      root.render(<ChatPage isActive={false} />);
    });
    await flushMount();

    expect(container.querySelector('[data-web-desktop-chat-host="idle"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="contrib-wiring"]')).toBeNull();
  });

  it("survives nesting under a BrowserRouter (separate React root)", async () => {
    const { BrowserRouter } = await import("react-router");
    const { default: ChatPage } = await import("./ChatPage");

    await act(async () => {
      root.render(
        <BrowserRouter>
          <ChatPage isActive />
        </BrowserRouter>,
      );
    });
    await flushMount();

    expect(container.querySelector("[data-web-chat-mount]")).toBeTruthy();
    expect(container.querySelector('[data-web-desktop-chat-host="active"]')).toBeTruthy();
  });
});
