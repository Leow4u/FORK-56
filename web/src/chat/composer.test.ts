import { describe, expect, it } from "vitest";

import { resolveComposerBusyAction } from "./composer";

describe("resolveComposerBusyAction", () => {
  it("returns send when idle", () => {
    expect(resolveComposerBusyAction(false, "hello")).toBe("send");
  });

  it("returns stop when busy and empty", () => {
    expect(resolveComposerBusyAction(true, "   ")).toBe("stop");
  });

  it("returns steer when busy with plain text", () => {
    expect(resolveComposerBusyAction(true, "fix the bug")).toBe("steer");
  });

  it("returns queue when busy with slash command", () => {
    expect(resolveComposerBusyAction(true, "/help")).toBe("queue");
  });
});
