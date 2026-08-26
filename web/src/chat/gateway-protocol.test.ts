import { describe, expect, it } from "vitest";

import {
  activityLineFromGatewayEvent,
  applyGatewayEvent,
  createThinChatTurnState,
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
  it("creates the assistant bubble on first delta, not on message.start", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();

    ({ messages: msgs, turn } = applyGatewayEvent(msgs, "message.start", {}, turn));
    expect(msgs).toHaveLength(0);
    expect(turn.streamId).toBeTruthy();

    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.delta",
      { text: "Hel" },
      turn,
    ));
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.delta",
      { text: "lo" },
      turn,
    ));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("Hello");

    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.complete",
      { text: "Hello!" },
      turn,
    ));
    expect(msgs[0]).toMatchObject({ text: "Hello!", streaming: false });
  });

  it("settles identical terminal reply onto interim when response_previewed", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();

    ({ messages: msgs, turn } = applyGatewayEvent(msgs, "message.start", {}, turn));
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.interim",
      { text: "same reply" },
      turn,
    ));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ text: "same reply", interim: true });

    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.complete",
      { response_previewed: true, text: "same reply" },
      turn,
    ));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({
      text: "same reply",
      interim: false,
      streaming: false,
    });
  });

  it("settles prefix-matched final onto interim without response_previewed", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();

    ({ messages: msgs, turn } = applyGatewayEvent(msgs, "message.start", {}, turn));
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.interim",
      { text: "partial answer" },
      turn,
    ));
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.complete",
      { text: "partial answer with more detail" },
      turn,
    ));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("partial answer with more detail");
  });

  it("settles identical terminal reply onto interim via prefix continuity", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();

    ({ messages: msgs, turn } = applyGatewayEvent(msgs, "message.start", {}, turn));
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.interim",
      { text: "same reply" },
      turn,
    ));
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.complete",
      { text: "same reply" },
      turn,
    ));
    expect(msgs.filter((m) => m.role === "assistant")).toHaveLength(1);
  });

  it("appends a distinct final reply after an interim segment", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();

    ({ messages: msgs, turn } = applyGatewayEvent(msgs, "message.start", {}, turn));
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.interim",
      { text: "interim thought" },
      turn,
    ));
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "message.complete",
      { text: "brand new final answer" },
      turn,
    ));
    const assistantMsgs = msgs.filter((m) => m.role === "assistant");
    expect(assistantMsgs).toHaveLength(2);
    expect(assistantMsgs[0]?.text).toBe("interim thought");
    expect(assistantMsgs[1]?.text).toBe("brand new final answer");
  });

  it("surfaces tool lifecycle lines", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();
    ({ messages: msgs, turn } = applyGatewayEvent(msgs, "tool.start", {
      name: "read_file",
      context: "a.ts",
    }, turn));
    expect(msgs[0].role).toBe("tool");
    expect(msgs[0].text).toContain("read_file");
  });

  it("streams reasoning blocks", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "reasoning.delta",
      { text: "hmm" },
      turn,
    ));
    expect(msgs[0]).toMatchObject({ role: "reasoning", text: "hmm" });
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "reasoning.available",
      { text: "done thinking" },
      turn,
    ));
    expect(msgs[0].text).toBe("done thinking");
  });

  it("upserts tool progress by tool_id", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();
    ({ messages: msgs, turn } = applyGatewayEvent(msgs, "tool.start", {
      name: "terminal",
      tool_id: "t1",
    }, turn));
    ({ messages: msgs, turn } = applyGatewayEvent(msgs, "tool.progress", {
      name: "terminal",
      tool_id: "t1",
      progress: "halfway",
    }, turn));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toContain("halfway");
  });

  it("surfaces subagent and compaction status lines", () => {
    let msgs: ChatMessage[] = [];
    let turn = createThinChatTurnState();
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "subagent.start",
      { goal: "research" },
      turn,
    ));
    expect(msgs[0].text).toContain("research");
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "status.update",
      { kind: "compacting" },
      turn,
    ));
    expect(msgs.some((m) => m.id === "status-compacting")).toBe(true);
    ({ messages: msgs, turn } = applyGatewayEvent(
      msgs,
      "status.update",
      { kind: "compacted" },
      turn,
    ));
    expect(msgs.some((m) => m.id === "status-compacting")).toBe(false);
  });
});

describe("activityLineFromGatewayEvent", () => {
  it("formats tool and background activity lines", () => {
    expect(
      activityLineFromGatewayEvent("tool.start", {
        name: "terminal",
        context: "pwd",
      }),
    ).toBe("▶ terminal — pwd");
    expect(
      activityLineFromGatewayEvent("status.update", {
        kind: "process",
        text: "npm test finished",
      }),
    ).toBe("Background: npm test finished");
    expect(
      activityLineFromGatewayEvent("notification.show", {
        text: "Build complete",
      }),
    ).toBe("Build complete");
  });
});
