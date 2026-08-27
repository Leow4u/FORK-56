// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buildWsUrlMock = vi.hoisted(() =>
  vi.fn(async () => "ws://127.0.0.1/api/pty?token=test"),
);

const terminalMocks = vi.hoisted(() => ({
  open: vi.fn(),
  fit: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    loadAddon = vi.fn();
    open = terminalMocks.open;
    onData = vi.fn();
    onResize = vi.fn();
    write = vi.fn();
    dispose = terminalMocks.dispose;
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = terminalMocks.fit;
  },
}));

vi.mock("@xterm/addon-unicode11", () => ({
  Unicode11Addon: class {},
}));

vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: class {},
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

vi.mock("@/lib/api", () => ({
  buildWsUrl: buildWsUrlMock,
}));

vi.mock("@/lib/dashboard-auth-reload", () => ({
  maybeReloadForLoopbackWsAuthFailure: vi.fn(),
}));

vi.mock("@/hooks/useModalBehavior", () => ({
  useModalBehavior: () => ({ current: null }),
}));

vi.mock("@/themes", () => ({
  useTheme: () => ({
    theme: {
      terminalBackground: "#000000",
      terminalForeground: "#f0e6d2",
    },
  }),
}));

vi.mock("@work4you/ui/ui/components/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props} />
  ),
}));

vi.mock("@work4you/ui/ui/components/spinner", () => ({
  Spinner: () => <span data-spinner />,
}));

class MockWebSocket {
  static OPEN = 1;
  binaryType = "arraybuffer";
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;

  constructor(_url: string) {
    queueMicrotask(() => this.onopen?.());
  }

  send = vi.fn();
  close = vi.fn();
}

let container: HTMLDivElement;
let root: Root;

describe("TuiPtyModal", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    buildWsUrlMock.mockClear();
    terminalMocks.open.mockClear();
    terminalMocks.fit.mockClear();
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body
      .querySelectorAll('[role="dialog"]')
      .forEach((el) => el.remove());
    vi.unstubAllGlobals();
  });

  it("does not mount PTY host when closed", async () => {
    const { TuiPtyModal } = await import("./TuiPtyModal");
    act(() => {
      root.render(
        <TuiPtyModal
          open={false}
          onClose={() => {}}
          resumeSessionId="sess-abc"
        />,
      );
    });
    expect(container.querySelector(".work4you-chat-xterm-host")).toBeNull();
    expect(buildWsUrlMock).not.toHaveBeenCalled();
  });

  it("connects /api/pty with resume id when opened", async () => {
    const { TuiPtyModal } = await import("./TuiPtyModal");
    act(() => {
      root.render(
        <TuiPtyModal
          open
          onClose={() => {}}
          resumeSessionId="sess-abc"
          profile="default"
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(buildWsUrlMock).toHaveBeenCalledWith(
      "/api/pty",
      expect.objectContaining({
        resume: "sess-abc",
        profile: "default",
        channel: expect.stringMatching(/^tui-modal-/),
      }),
    );
    expect(
      document.body.querySelector(".work4you-chat-xterm-host"),
    ).toBeTruthy();
    expect(document.body.textContent).toContain("live");
  });
});
