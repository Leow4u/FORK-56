// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@work4you/ui/ui/components/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children?: ReactNode;
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
    children?: ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

import { ChatContextBar } from "./chat-context-bar";

describe("ChatContextBar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("renders connection, model, and token placeholders", () => {
    act(() => {
      root.render(
        <ChatContextBar
          connectionState="open"
          info={{ model: "gpt-4", provider: "openai", reasoningEffort: "medium" }}
          usage={null}
          modelLabel="gpt-4"
          onOpenModelPicker={() => undefined}
          onReasoningChange={() => undefined}
        />,
      );
    });
    expect(container.textContent).toContain("Live");
    expect(container.textContent).toContain("gpt-4");
    expect(container.textContent).toContain("— tok");
  });

  it("formats token usage when present", () => {
    act(() => {
      root.render(
        <ChatContextBar
          connectionState="open"
          info={{}}
          usage={{ total: 1200 }}
          modelLabel="Model"
        />,
      );
    });
    expect(container.textContent).toContain("1,200 tok");
  });
});
