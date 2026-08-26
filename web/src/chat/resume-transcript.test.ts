import { describe, expect, it } from "vitest";

import {
  appendInflightProjection,
  buildResumeTranscript,
  reconcileResumeMessages,
  turnStateFromInflight,
} from "./resume-transcript";
import type { ChatMessage } from "./types";

const user = (text: string, id = createId()): ChatMessage => ({
  id,
  role: "user",
  text,
});

const assistant = (
  text: string,
  opts: { streaming?: boolean; id?: string } = {},
): ChatMessage => ({
  id: opts.id ?? createId(),
  role: "assistant",
  text,
  streaming: opts.streaming,
});

let seq = 0;
function createId(): string {
  seq += 1;
  return `msg-${seq}`;
}

describe("appendInflightProjection", () => {
  it("appends inflight user and streaming assistant", () => {
    const out = appendInflightProjection(
      [{ role: "user", text: "old", id: "u1" }],
      { user: "new prompt", assistant: "partial", streaming: true },
      "sess-1",
    );
    expect(out).toHaveLength(3);
    expect(out[1]).toMatchObject({ role: "user", text: "new prompt" });
    expect(out[2]).toMatchObject({
      role: "assistant",
      text: "partial",
      streaming: true,
      id: "inflight-assistant-sess-1",
    });
  });

  it("does not duplicate inflight user already in the latest run", () => {
    const out = appendInflightProjection(
      [user("same prompt")],
      { user: "same prompt", assistant: "hi", streaming: true },
      "sess-1",
    );
    expect(out.filter((m) => m.role === "user")).toHaveLength(1);
    expect(out).toHaveLength(2);
  });

  it("surfaces retained failed turns as system + partial assistant", () => {
    const out = appendInflightProjection(
      [],
      { user: "q", assistant: "partial", error: "turn failed", streaming: false },
      "sess-1",
    );
    expect(out.some((m) => m.role === "system" && m.text === "turn failed")).toBe(
      true,
    );
    expect(out.some((m) => m.role === "assistant" && m.text === "partial")).toBe(
      true,
    );
  });
});

describe("reconcileResumeMessages", () => {
  it("preserves optimistic user tail missing from authoritative snapshot", () => {
    const authoritative = [user("committed")];
    const local = [user("committed"), user("optimistic send")];
    const merged = reconcileResumeMessages(authoritative, local);
    expect(merged.map((m) => m.text)).toEqual(["committed", "optimistic send"]);
  });

  it("keeps richer local streaming assistant over an empty authoritative shell", () => {
    const authoritative = [
      user("q"),
      assistant("", { streaming: true, id: "inflight-assistant-s1" }),
    ];
    const local = [
      user("q"),
      assistant("longer streamed answer", { streaming: true, id: "local-stream" }),
    ];
    const merged = reconcileResumeMessages(authoritative, local);
    expect(merged[1]).toMatchObject({
      text: "longer streamed answer",
      streaming: true,
    });
  });
});

describe("buildResumeTranscript", () => {
  it("projects inflight and reconciles local optimistic rows", () => {
    const history = [user("stored")];
    const local = [user("stored"), user("just sent")];
    const merged = buildResumeTranscript(
      history,
      { user: "just sent", assistant: "thinking", streaming: true },
      local,
      "sess-2",
    );
    expect(merged.filter((m) => m.role === "user").map((m) => m.text)).toEqual([
      "stored",
      "just sent",
    ]);
    expect(merged.at(-1)).toMatchObject({
      role: "assistant",
      text: "thinking",
      streaming: true,
    });
  });
});

describe("turnStateFromInflight", () => {
  it("arms streamId for streaming inflight assistant", () => {
    expect(
      turnStateFromInflight({ streaming: true, assistant: "x" }, "sess-3"),
    ).toEqual({
      streamId: "inflight-assistant-sess-3",
      interimBoundaryPending: false,
    });
  });
});
