// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ComposerUnderside } from "./composer-underside";

describe("ComposerUnderside", () => {
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

  it("renders branch, cloud connection, and context meter", () => {
    act(() => {
      root.render(
        <ComposerUnderside
          connectionState="open"
          info={{ branch: "cursor/feature-branch" }}
          usage={{ contextMax: 200_000, contextUsed: 50_000, contextPercent: 25 }}
        />,
      );
    });
    expect(container.textContent).toContain("No project open");
    expect(container.textContent).toContain("cursor/feature-branch");
    expect(container.textContent).toContain("Cloud");
    expect(container.textContent).toContain("25%");
  });

  it("shows workspace basename when a project is open", () => {
    act(() => {
      root.render(
        <ComposerUnderside
          connectionState="open"
          info={{}}
          usage={null}
          workspaceCwd="/opt/data/my-app"
        />,
      );
    });
    expect(container.textContent).toContain("my-app");
  });

  it("formats token usage when present", () => {
    act(() => {
      root.render(
        <ComposerUnderside
          connectionState="open"
          info={{}}
          usage={{ total: 2400 }}
        />,
      );
    });
    expect(container.textContent).toContain("2,400 tok");
  });
});
