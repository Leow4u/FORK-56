import { describe, expect, it } from "vitest";

import {
  applyGatewayEvent,
  historyToChatMessages,
  thinChatSessionCreateParams,
  thinChatSessionResumeParams,
} from "./gateway-protocol";
import type { ChatMessage } from "./types";

describe("thinChatSessionCreateParams", () => {
  it("uses web source and close_on_disconnect", () => {
    expect(thinChatSessionCreateParams()).toEqual({
      close_on_disconnect: true,
      source: "web",
    });
  });

  it("forwards profile when set", () => {
    expect(thinChatSessionCreateParams("coder").profile).toBe("coder");
  });
});

describe("thinChatSessionResumeParams", () => {
  it("requires session_id", () => {
    expect(thinChatSessionResumeParams("abc")).toEqual({ session_id: "abc" });
  });
});

describe("historyToChatMessages", () => {
  it("maps gateway history projection", () => {
    const msgs = historyToChatMessages([
      { role: "user", text: "hi", row_id: 1 },
      { role: "assistant", text: "hello" },
      { role: "tool", name: "terminal", context: "ls" },
      { role: "user", text: "secret", display_kind: "hidden" },
    ]);
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toMatchObject({ role: "user", text: "hi", id: "row-1" });
    expect(msgs[1]).toMatchObject({ role: "assistant", text: "hello" });
    expect(msgs[2].text).toContain("terminal");
  });
});

describe("applyGatewayEvent", () => {
  it("starts, appends deltas, and finalizes", () => {
    let msgs: ChatMessage[] = [];
    msgs = applyGatewayEvent(msgs, "message.start", {});
    expect(msgs).toHaveLength(1);
    expect(msgs[0].streaming).toBe(true);

    msgs = applyGatewayEvent(msgs, "message.delta", { text: "Hel" });
    msgs = applyGatewayEvent(msgs, "message.delta", { text: "lo" });
    expect(msgs[0].text).toBe("Hello");

    msgs = applyGatewayEvent(msgs, "message.complete", { text: "Hello!" });
    expect(msgs[0]).toMatchObject({ text: "Hello!", streaming: false });
  });

  it("surfaces tool lifecycle lines", () => {
    let msgs: ChatMessage[] = [];
    msgs = applyGatewayEvent(msgs, "tool.start", {
      name: "read_file",
      context: "a.ts",
    });
    expect(msgs[0].role).toBe("tool");
    expect(msgs[0].text).toContain("read_file");
  });

  it("streams reasoning blocks", () => {
    let msgs: ChatMessage[] = [];
    msgs = applyGatewayEvent(msgs, "reasoning.delta", { text: "hmm" });
    expect(msgs[0]).toMatchObject({ role: "reasoning", text: "hmm" });
    msgs = applyGatewayEvent(msgs, "reasoning.available", { text: "done thinking" });
    expect(msgs[0].text).toBe("done thinking");
  });

  it("upserts tool progress by tool_id", () => {
    let msgs: ChatMessage[] = [];
    msgs = applyGatewayEvent(msgs, "tool.start", {
      name: "terminal",
      tool_id: "t1",
    });
    msgs = applyGatewayEvent(msgs, "tool.progress", {
      name: "terminal",
      tool_id: "t1",
      progress: "halfway",
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toContain("halfway");
  });

  it("surfaces subagent and compaction status lines", () => {
    let msgs: ChatMessage[] = [];
    msgs = applyGatewayEvent(msgs, "subagent.start", { goal: "research" });
    expect(msgs[0].text).toContain("research");
    msgs = applyGatewayEvent(msgs, "status.update", { kind: "compacting" });
    expect(msgs.some((m) => m.id === "status-compacting")).toBe(true);
    msgs = applyGatewayEvent(msgs, "status.update", { kind: "compacted" });
    expect(msgs.some((m) => m.id === "status-compacting")).toBe(false);
  });
});
