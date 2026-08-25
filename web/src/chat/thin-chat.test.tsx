// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gatewayMocks = vi.hoisted(() => {
  const anyHandlers = new Set<(event: unknown) => void>();
  const stateHandlers = new Set<(state: string) => void>();
  return {
    anyHandlers,
    stateHandlers,
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
      handler("idle");
      return () => stateHandlers.delete(handler);
    }),
    request: vi.fn(async (method: string) => {
      if (method === "session.create") {
        return {
          session_id: "live-1",
          stored_session_id: "stored-1",
          messages: [],
        };
      }
      if (method === "session.resume") {
        return {
          session_id: "live-resume",
          stored_session_id: "sess-abc",
          resumed: "sess-abc",
          messages: [
            { role: "user", text: "earlier", row_id: 10 },
            { role: "assistant", text: "prior reply" },
          ],
        };
      }
      if (method === "prompt.submit") {
        return { status: "streaming" };
      }
      if (method === "session.close" || method === "session.interrupt") {
        return { ok: true };
      }
      return {};
    }),
    emit(type: string, payload?: unknown, session_id = "live-1") {
      for (const h of anyHandlers) {
        h({ type, payload, session_id });
      }
    },
    reset() {
      anyHandlers.clear();
      stateHandlers.clear();
      this.close.mockClear();
      this.connect.mockClear();
      this.onAny.mockClear();
      this.onState.mockClear();
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

vi.mock("@work4you/ui/ui/components/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@work4you/ui/ui/components/typography/index", () => ({
  Typography: ({ children, ...props }: { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/Markdown", () => ({
  Markdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

import { ThinChat } from "./thin-chat";

describe("ThinChat gateway wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
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

  it("boots EmptyHome and creates a web session", async () => {
    await act(async () => {
      root.render(<ThinChat />);
    });
    // Flush connect/create microtasks
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Work4You");
    expect(gatewayMocks.connect).toHaveBeenCalled();
    expect(gatewayMocks.request).toHaveBeenCalledWith(
      "session.create",
      expect.objectContaining({ source: "web", close_on_disconnect: true }),
    );
  });

  it("resumes a stored session into SessionView", async () => {
    await act(async () => {
      root.render(<ThinChat resumeSessionId="sess-abc" />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(gatewayMocks.request).toHaveBeenCalledWith(
      "session.resume",
      expect.objectContaining({ session_id: "sess-abc" }),
    );
    expect(container.querySelector('[role="log"]')).toBeTruthy();
    expect(container.textContent).toContain("earlier");
    expect(container.textContent).toContain("prior reply");
  });

  it("submits a prompt and streams assistant deltas", async () => {
    await act(async () => {
      root.render(<ThinChat />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const textarea = container.querySelector(
      'textarea[aria-label="Message"]',
    ) as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(textarea, "hello agent");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const send = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;
    await act(async () => {
      send.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(gatewayMocks.request).toHaveBeenCalledWith(
      "prompt.submit",
      expect.objectContaining({
        session_id: "live-1",
        text: "hello agent",
      }),
    );
    expect(container.textContent).toContain("hello agent");

    await act(async () => {
      gatewayMocks.emit("message.start", {});
      gatewayMocks.emit("message.delta", { text: "Hi " });
      gatewayMocks.emit("message.delta", { text: "there" });
      gatewayMocks.emit("message.complete", { text: "Hi there" });
    });

    expect(container.textContent).toContain("Hi there");
    expect(
      container.querySelector('button[aria-label="Stop generating"]'),
    ).toBeNull();
  });

  it("exposes reset via resetRef", async () => {
    const resetRef: { current: (() => void) | null } = { current: null };
    await act(async () => {
      root.render(
        <ThinChat resumeSessionId="sess-abc" resetRef={resetRef} />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[role="log"]')).toBeTruthy();

    await act(async () => {
      resetRef.current?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Work4You");
    expect(gatewayMocks.request).toHaveBeenCalledWith(
      "session.close",
      expect.objectContaining({ session_id: "live-resume" }),
    );
  });
});
