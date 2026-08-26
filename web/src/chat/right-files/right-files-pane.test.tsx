// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RightFilesPane } from "./right-files-pane";

const listFsDir = vi.fn();
const readFsText = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    listFsDir: (...args: unknown[]) => listFsDir(...args),
    readFsText: (...args: unknown[]) => readFsText(...args),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("RightFilesPane", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    listFsDir.mockReset();
    readFsText.mockReset();
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

  function render(node: ReactNode) {
    act(() => {
      root.render(node);
    });
  }

  it("shows no-project empty state when workspace is null", () => {
    const onOpen = vi.fn();
    render(
      <RightFilesPane workspaceCwd={null} onOpenWorkspace={onOpen} />,
    );
    expect(container.textContent).toContain("No project open");
    expect(listFsDir).not.toHaveBeenCalled();

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Open project"),
    );
    expect(button).toBeTruthy();
    act(() => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpen).toHaveBeenCalled();
  });

  it("loads the cwd tree when a project is open", async () => {
    listFsDir.mockResolvedValue({
      entries: [
        { name: "src", path: "/repo/src", isDirectory: true },
        { name: "README.md", path: "/repo/README.md", isDirectory: false },
      ],
    });

    await act(async () => {
      root.render(<RightFilesPane workspaceCwd="/repo" />);
    });

    // Allow the async refresh to settle
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listFsDir).toHaveBeenCalledWith("/repo");
    expect(container.textContent).toContain("repo");
    expect(container.textContent).toContain("src");
    expect(container.textContent).toContain("README.md");
  });
});
