// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ComposerFloatingPills } from "./composer-floating-pills";

describe("ComposerFloatingPills", () => {
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

  it("renders nothing when there is no contextual data", () => {
    act(() => {
      root.render(
        <ComposerFloatingPills
          activity={{ toolLine: null, backgroundLine: null, queueCount: 0 }}
          info={{}}
        />,
      );
    });
    expect(container.textContent).toBe("");
  });

  it("renders queue and tool pills when present", () => {
    act(() => {
      root.render(
        <ComposerFloatingPills
          activity={{
            toolLine: "Running terminal",
            backgroundLine: null,
            queueCount: 2,
          }}
          info={{ fast: true }}
        />,
      );
    });
    expect(container.textContent).toContain("Running terminal");
    expect(container.textContent).toContain("2 queued");
    expect(container.textContent).toContain("Fast");
  });
});
