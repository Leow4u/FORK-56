// @vitest-environment jsdom
import { act } from "react";
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

vi.mock("@/components/PathPopover", () => ({
  PathPopover: () => null,
}));

vi.mock("@/components/SlashPopover", () => ({
  SlashPopover: () => null,
}));

import { ComposerDock } from "./composer-dock";

describe("ComposerDock geometry", () => {
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

  it("renders model pill inside surface and underside below", () => {
    act(() => {
      root.render(
        <ComposerDock
          value=""
          onChange={() => undefined}
          onSubmit={() => undefined}
          gateway={null}
          sessionId="sess-1"
          connectionState="open"
          sessionInfo={{ model: "gpt-4", provider: "openai", branch: "main" }}
          sessionUsage={{ total: 500 }}
          activity={{ toolLine: null, backgroundLine: null, queueCount: 0 }}
        />,
      );
    });

    const dock = container.querySelector("[data-slot='composer-dock']");
    expect(dock).toBeTruthy();

    expect(container.textContent).toContain("gpt-4");
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("Cloud");
    expect(container.textContent).toContain("500 tok");

    // Old horizontal context bar (connection Live chip) must not appear above composer.
    expect(container.textContent).not.toContain("Live");
  });
});
