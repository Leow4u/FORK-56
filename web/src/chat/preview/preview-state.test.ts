import { describe, expect, it } from "vitest";

import {
  EMPTY_PREVIEW_STATE,
  closePreviewAt,
  openPreviewTarget,
  parsePreviewOpenPayload,
} from "./preview-state";

describe("preview-state", () => {
  it("parses https URLs as url targets", () => {
    const t = parsePreviewOpenPayload({
      url: "https://example.com",
      label: "Ex",
    });
    expect(t).toMatchObject({
      kind: "url",
      url: "https://example.com",
      label: "Ex",
    });
  });

  it("parses path payloads as file targets", () => {
    const t = parsePreviewOpenPayload({ path: "/repo/README.md" });
    expect(t).toMatchObject({
      kind: "file",
      path: "/repo/README.md",
      label: "README.md",
    });
  });

  it("reuses an existing tab by identity", () => {
    const first = openPreviewTarget(EMPTY_PREVIEW_STATE, {
      kind: "file",
      label: "a",
      url: "/a",
      path: "/a",
      source: "tool-result",
    });
    const second = openPreviewTarget(first, {
      kind: "file",
      label: "a2",
      url: "/a",
      path: "/a",
      source: "tool-result",
      text: "hi",
    });
    expect(second.tabs).toHaveLength(1);
    expect(second.tabs[0]?.text).toBe("hi");
    expect(second.activeIndex).toBe(0);
  });

  it("closes tabs and clamps activeIndex", () => {
    let state = openPreviewTarget(EMPTY_PREVIEW_STATE, {
      kind: "url",
      label: "1",
      url: "https://a.test",
      source: "tool-result",
    });
    state = openPreviewTarget(state, {
      kind: "url",
      label: "2",
      url: "https://b.test",
      source: "tool-result",
    });
    state = closePreviewAt(state, 0);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.url).toBe("https://b.test");
  });
});
