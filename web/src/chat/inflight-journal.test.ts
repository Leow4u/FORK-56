// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { sessionMessagesToChatMessages } from "./gateway-protocol";
import {
  clearInflightJournal,
  persistInflightJournal,
  prependOlderMessages,
  recoverInflightJournal,
} from "./inflight-journal";
import type { ChatMessage } from "./types";

const user = (text: string, id: string): ChatMessage => ({
  id,
  role: "user",
  text,
});

const assistant = (text: string, id: string): ChatMessage => ({
  id,
  role: "assistant",
  text,
});

describe("sessionMessagesToChatMessages", () => {
  it("uses durable row ids from REST backfill", () => {
    const msgs = sessionMessagesToChatMessages([
      { role: "user", content: "hi", id: 42 },
      { role: "assistant", content: "hello", row_id: 43 },
    ]);
    expect(msgs[0].id).toBe("row-42");
    expect(msgs[1].id).toBe("row-43");
  });
});

describe("prependOlderMessages", () => {
  it("skips rows already present by row id", () => {
    const existing = [user("newer", "row-2")];
    const older = [user("older", "row-1"), user("dup", "row-2")];
    const merged = prependOlderMessages(existing, older);
    expect(merged.map((m) => m.id)).toEqual(["row-1", "row-2"]);
  });
});

describe("inflight journal", () => {
  const stored = "sess-journal-1";

  beforeEach(() => {
    localStorage.clear();
    clearInflightJournal(stored);
  });

  it("persists and recovers an open turn tail", () => {
    const base = [user("committed", "row-1")];
    const tail = [
      user("live prompt", "user-live"),
      { ...assistant("partial", "stream-1"), streaming: true },
    ];

    persistInflightJournal(
      stored,
      [...base, ...tail],
      { streamId: "stream-1", interimBoundaryPending: false },
      true,
    );

    const recovery = recoverInflightJournal(stored, base, { keepPending: true });
    expect(recovery.applied).toBe(true);
    expect(recovery.messages.map((m) => m.text)).toEqual([
      "committed",
      "live prompt",
      "partial",
    ]);
    expect(recovery.turn.streamId).toBe("stream-1");
  });

  it("clears journal when turn settles", () => {
    persistInflightJournal(
      stored,
      [user("q", "u1")],
      { streamId: "s1", interimBoundaryPending: false },
      true,
    );
    persistInflightJournal(
      stored,
      [user("q", "u1"), assistant("done", "a1")],
      { streamId: null, interimBoundaryPending: false },
      false,
    );
    expect(recoverInflightJournal(stored, [], { keepPending: false }).applied).toBe(
      false,
    );
  });
});
