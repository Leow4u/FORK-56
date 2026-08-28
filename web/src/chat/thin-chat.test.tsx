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
      if (method === "slash.exec") {
        return { output: "help text" };
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

vi.mock("@work4you/ui/ui/components/list-item", () => ({
  ListItem: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@work4you/ui/ui/components/typography/index", () => ({
  Typography: ({ children, ...props }: { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@work4you/ui/ui/components/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children?: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Reasoning effort"
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectOption: ({
    children,
    value,
  }: {
    children?: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
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

  it("boots EmptyHome without creating a session until first send", async () => {
    await act(async () => {
      root.render(<ThinChat />);
    });
    // Flush connect microtasks
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Ready when you are.");
    expect(gatewayMocks.connect).toHaveBeenCalled();
    expect(gatewayMocks.request).not.toHaveBeenCalledWith(
      "session.create",
      expect.anything(),
    );
  });

  it("creates a web session on first send (desktop draft parity)", async () => {
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
      "session.create",
      expect.objectContaining({ source: "web", close_on_disconnect: true }),
    );
  });

  it("projects inflight tail when resuming a running session", async () => {
    gatewayMocks.request.mockImplementationOnce(async (method: string) => {
      if (method === "session.resume") {
        return {
          session_id: "live-resume",
          stored_session_id: "sess-running",
          resumed: "sess-running",
          running: true,
          messages: [{ role: "user", text: "question", row_id: 1 }],
          inflight: {
            user: "question",
            assistant: "partial answer",
            streaming: true,
          },
        };
      }
      return {};
    });

    await act(async () => {
      root.render(<ThinChat resumeSessionId="sess-running" />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("question");
    expect(container.textContent).toContain("partial answer");
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

  it("does not re-resume when ?resume= catches up to the live session", async () => {
    const onStoredSessionId = vi.fn();
    await act(async () => {
      root.render(<ThinChat onStoredSessionId={onStoredSessionId} />);
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

    expect(onStoredSessionId).toHaveBeenCalledWith("stored-1");

    await act(async () => {
      root.render(
        <ThinChat
          onStoredSessionId={onStoredSessionId}
          resumeSessionId="stored-1"
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(gatewayMocks.request).not.toHaveBeenCalledWith(
      "session.resume",
      expect.anything(),
    );
    expect(gatewayMocks.request).not.toHaveBeenCalledWith(
      "session.close",
      expect.anything(),
    );
    expect(container.textContent).toContain("hello agent");
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

  it("runs slash commands via slash.exec", async () => {
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
      setter?.call(textarea, "/help");
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
      "slash.exec",
      expect.objectContaining({ command: "help" }),
    );
    expect(container.textContent).toContain("help text");
    expect(gatewayMocks.request).not.toHaveBeenCalledWith(
      "prompt.submit",
      expect.anything(),
    );
  });

  it("blocks plain sends when credential_warning is active", async () => {
    await act(async () => {
      root.render(<ThinChat />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      gatewayMocks.emit("session.info", {
        credential_warning: "No API key configured",
      });
    });

    expect(container.textContent).toContain("No API key configured");

    const textarea = container.querySelector(
      'textarea[aria-label="Message"]',
    ) as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(textarea, "hello");
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

    expect(gatewayMocks.request).not.toHaveBeenCalledWith(
      "prompt.submit",
      expect.anything(),
    );
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
    expect(container.textContent).toContain("Ready when you are.");
    expect(gatewayMocks.request).toHaveBeenCalledWith(
      "session.close",
      expect.objectContaining({ session_id: "live-resume" }),
    );
  });
});
