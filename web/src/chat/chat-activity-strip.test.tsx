// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

import { ChatActivityStrip } from "./chat-activity-strip";

describe("ChatActivityStrip", () => {
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

  it("shows idle ready state by default", () => {
    act(() => {
      root.render(
        <ChatActivityStrip
          busy={false}
          activity={{ toolLine: null, backgroundLine: null, queueCount: 0 }}
        />,
      );
    });
    expect(container.textContent).toContain("Idle");
    expect(container.textContent).toContain("Ready");
  });

  it("prefers tool line over generic busy text", () => {
    act(() => {
      root.render(
        <ChatActivityStrip
          busy
          activity={{
            toolLine: "▶ terminal — ls",
            backgroundLine: null,
            queueCount: 0,
          }}
        />,
      );
    });
    expect(container.textContent).toContain("Working");
    expect(container.textContent).toContain("▶ terminal — ls");
  });

  it("shows queued message count", () => {
    act(() => {
      root.render(
        <ChatActivityStrip
          busy={false}
          activity={{
            toolLine: null,
            backgroundLine: null,
            queueCount: 2,
          }}
        />,
      );
    });
    expect(container.textContent).toContain("2 messages queued");
  });
});
