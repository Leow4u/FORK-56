import { beforeEach, describe, expect, it } from "vitest";

import {
  $subagentsBySession,
  upsertSubagent,
} from "@/store/subagents";

import {
  ingestSubagentGatewayEvent,
  resetSubagentIngestForTests,
} from "./ingest-subagent-event";

const listFor = (sid: string) => $subagentsBySession.get()[sid] ?? [];

describe("ingestSubagentGatewayEvent", () => {
  beforeEach(() => {
    $subagentsBySession.set({});
    resetSubagentIngestForTests();
  });

  it("upserts native spawn events keyed by the event session, not the live chat", () => {
    const consumed = ingestSubagentGatewayEvent(
      {
        type: "subagent.spawn_requested",
        session_id: "other",
        payload: {
          goal: "scan files",
          status: "queued",
          subagent_id: "sa-1",
          task_index: 0,
        },
      },
      "live-chat",
    );

    expect(consumed).toBe(true);
    expect(listFor("live-chat")).toHaveLength(0);
    expect(listFor("other")[0]?.goal).toBe("scan files");
    expect(listFor("other")[0]?.status).toBe("queued");
  });

  it("falls back to the live session when the event has no session_id", () => {
    ingestSubagentGatewayEvent(
      {
        type: "subagent.start",
        payload: {
          goal: "write tests",
          status: "running",
          subagent_id: "sa-2",
          task_index: 0,
        },
      },
      "live-chat",
    );

    expect(listFor("live-chat")[0]?.goal).toBe("write tests");
  });

  it("does not create a row from progress unless spawn/start already did", () => {
    ingestSubagentGatewayEvent(
      {
        type: "subagent.progress",
        session_id: "s1",
        payload: {
          status: "running",
          subagent_id: "ghost",
          text: "still working",
        },
      },
      null,
    );

    expect(listFor("s1")).toHaveLength(0);
  });

  it("appends thinking/tool/progress onto an existing row", () => {
    ingestSubagentGatewayEvent(
      {
        type: "subagent.start",
        session_id: "s1",
        payload: {
          goal: "scan files",
          status: "running",
          subagent_id: "a1",
          task_index: 0,
        },
      },
      null,
    );
    ingestSubagentGatewayEvent(
      {
        type: "subagent.thinking",
        session_id: "s1",
        payload: {
          status: "running",
          subagent_id: "a1",
          text: "plan the search",
        },
      },
      null,
    );
    ingestSubagentGatewayEvent(
      {
        type: "subagent.complete",
        session_id: "s1",
        payload: {
          status: "completed",
          subagent_id: "a1",
          summary: "done",
        },
      },
      null,
    );

    const item = listFor("s1")[0];
    expect(item?.status).toBe("completed");
    expect(item?.stream.map((entry) => entry.kind)).toEqual([
      "thinking",
      "summary",
    ]);
  });

  it("prunes delegate-tool fallback rows on the first native event for a session", () => {
    upsertSubagent("s1", {
      goal: "fallback",
      status: "running",
      subagent_id: "delegate-tool:abc:0",
      task_index: 0,
    });

    ingestSubagentGatewayEvent(
      {
        type: "subagent.start",
        session_id: "s1",
        payload: {
          goal: "native",
          status: "running",
          subagent_id: "sa-0-xyz",
          task_index: 0,
        },
      },
      null,
    );

    expect(listFor("s1").map((item) => item.id)).toEqual(["sa-0-xyz"]);
  });

  it("prunes finished rows on message.start and leaves the event for the transcript", () => {
    upsertSubagent("s1", {
      goal: "live",
      status: "running",
      subagent_id: "live",
      task_index: 0,
    });
    upsertSubagent("s1", {
      goal: "done",
      status: "completed",
      subagent_id: "done",
      task_index: 1,
    });

    const consumed = ingestSubagentGatewayEvent(
      { type: "message.start", session_id: "s1" },
      "live-chat",
    );

    expect(consumed).toBe(false);
    expect(listFor("s1").map((item) => item.id)).toEqual(["live"]);
  });

  it("ignores unrelated event types", () => {
    expect(
      ingestSubagentGatewayEvent(
        { type: "tool.start", session_id: "s1", payload: { name: "terminal" } },
        null,
      ),
    ).toBe(false);
    expect($subagentsBySession.get()).toEqual({});
  });
});
