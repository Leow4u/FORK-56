import { describe, expect, it } from "vitest";

import {
  applyPromptEvent,
  approvalOptions,
  hasBlockingPrompt,
  mergePromptEvent,
  parseApprovalPayload,
  parseClarifyPayload,
  EMPTY_PROMPT_STATE,
} from "./index";

describe("approvalOptions", () => {
  it("hides always when allowPermanent is false", () => {
    expect(
      approvalOptions({
        requestId: "a",
        sessionId: null,
        command: "rm -rf /",
        description: "dangerous",
        allowPermanent: false,
      }),
    ).toEqual(["once", "session", "deny"]);
  });

  it("uses smart-denied pair", () => {
    expect(
      approvalOptions({
        requestId: "a",
        sessionId: null,
        command: "x",
        description: "y",
        smartDenied: true,
      }),
    ).toEqual(["once", "deny"]);
  });
});

describe("parseClarifyPayload", () => {
  it("parses single-question clarify", () => {
    const req = parseClarifyPayload(
      {
        request_id: "c1",
        question: "Which env?",
        choices: ["dev", "prod"],
      },
      "sess-1",
    );
    expect(req).toMatchObject({
      requestId: "c1",
      question: "Which env?",
      choices: ["dev", "prod"],
      sessionId: "sess-1",
    });
  });

  it("parses batch questions", () => {
    const req = parseClarifyPayload(
      {
        request_id: "c2",
        questions: [
          { qid: "q1", question: "A?", choices: ["1"] },
          { qid: "q2", question: "B?", multi_select: true },
        ],
      },
      null,
    );
    expect(req?.questions).toHaveLength(2);
    expect(req?.questions[1]?.multiSelect).toBe(true);
  });
});

describe("applyPromptEvent / mergePromptEvent", () => {
  it("parks approval.request and clears on message.complete", () => {
    let state = EMPTY_PROMPT_STATE;
    state = mergePromptEvent(
      state,
      applyPromptEvent(
        "approval.request",
        {
          request_id: "r1",
          command: "ls",
          description: "List files",
        },
        "live-1",
      ),
    );
    expect(hasBlockingPrompt(state)).toBe(true);
    expect(state.approval?.requestId).toBe("r1");

    state = mergePromptEvent(
      state,
      applyPromptEvent("message.complete", {}, "live-1"),
    );
    expect(state.approval).toBeNull();
  });

  it("clears sudo on expire with matching request id", () => {
    let state = mergePromptEvent(
      EMPTY_PROMPT_STATE,
      applyPromptEvent("sudo.request", { request_id: "s1" }, null),
    );
    expect(state.sudo?.requestId).toBe("s1");
    state = mergePromptEvent(
      state,
      applyPromptEvent("sudo.expire", { request_id: "s1" }, null),
    );
    expect(state.sudo).toBeNull();
  });

  it("does not clear a newer sudo on stale expire", () => {
    let state = mergePromptEvent(
      EMPTY_PROMPT_STATE,
      applyPromptEvent("sudo.request", { request_id: "s2" }, null),
    );
    state = mergePromptEvent(
      state,
      applyPromptEvent("sudo.expire", { request_id: "s1" }, null),
    );
    expect(state.sudo?.requestId).toBe("s2");
  });
});

describe("parseApprovalPayload", () => {
  it("returns null for empty payload", () => {
    expect(parseApprovalPayload({}, null)).toBeNull();
  });
});
