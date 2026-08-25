// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThinChat } from "./thin-chat";

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

describe("ThinChat", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // React 19 + vitest jsdom: silence act() environment warnings.
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
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

  it("starts on EmptyHome with centered composer", () => {
    act(() => {
      root.render(<ThinChat />);
    });
    expect(container.textContent).toContain("Work4You");
    expect(container.querySelector('textarea[aria-label="Message"]')).toBeTruthy();
    expect(container.querySelector('[role="log"]')).toBeNull();
  });

  it("transitions to SessionView after the first send", () => {
    act(() => {
      root.render(<ThinChat />);
    });
    const textarea = container.querySelector(
      'textarea[aria-label="Message"]',
    ) as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    act(() => {
      setter?.call(textarea, "hello thin chat");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(textarea.value).toBe("hello thin chat");
    const send = container.querySelector(
      'button[aria-label="Send message"]',
    ) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    act(() => {
      send.click();
    });
    expect(container.querySelector('[role="log"]')).toBeTruthy();
    expect(container.textContent).toContain("hello thin chat");
    expect(container.textContent).toContain("Chat UI skeleton is live");
  });

  it("opens SessionView for resume targets", () => {
    act(() => {
      root.render(<ThinChat resumeSessionId="sess-abc" />);
    });
    expect(container.querySelector('[role="log"]')).toBeTruthy();
    expect(container.textContent).toContain("Session resume will load");
  });

  it("exposes reset via resetRef", () => {
    const resetRef: { current: (() => void) | null } = { current: null };
    act(() => {
      root.render(<ThinChat resumeSessionId="sess-abc" resetRef={resetRef} />);
    });
    expect(container.querySelector('[role="log"]')).toBeTruthy();
    act(() => {
      resetRef.current?.();
    });
    expect(container.querySelector('[role="log"]')).toBeNull();
    expect(container.textContent).toContain("Work4You");
  });
});
