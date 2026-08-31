import {
  pruneDelegateFallbackSubagents,
  pruneFinishedSessionSubagents,
  upsertSubagent,
} from "@/store/subagents";

/** Native subagent stream events from tui_gateway / the agent loop. */
export const SUBAGENT_EVENT_TYPES = new Set([
  "subagent.spawn_requested",
  "subagent.start",
  "subagent.thinking",
  "subagent.tool",
  "subagent.progress",
  "subagent.complete",
]);

const nativeSubagentSessions = new Set<string>();

export function resetSubagentIngestForTests(): void {
  nativeSubagentSessions.clear();
}

function ownerSessionId(
  eventSessionId: unknown,
  liveSessionId?: string | null,
): string | null {
  if (typeof eventSessionId === "string" && eventSessionId) {
    return eventSessionId;
  }
  return liveSessionId || null;
}

/**
 * Feed `$subagentsBySession` from gateway events.
 *
 * Must run **before** the live-session filter in the thin-chat handler: a
 * child running in another stored session still belongs in the spawn tree,
 * matching Desktop's aggregated Agents overlay.
 *
 * Returns true when the event is a native subagent event (caller can skip
 * other-session transcript work after ingesting). `message.start` is handled
 * as a prune side-effect and returns false so the transcript path still runs.
 */
export function ingestSubagentGatewayEvent(
  ev: { payload?: unknown; session_id?: string; type: string },
  liveSessionId?: string | null,
): boolean {
  const sid = ownerSessionId(ev.session_id, liveSessionId);

  if (ev.type === "message.start") {
    if (sid) {
      pruneFinishedSessionSubagents(sid);
    }
    return false;
  }

  if (!SUBAGENT_EVENT_TYPES.has(ev.type)) {
    return false;
  }

  if (!sid) {
    return true;
  }

  const payload =
    ev.payload && typeof ev.payload === "object"
      ? (ev.payload as Record<string, unknown>)
      : null;
  if (!payload) {
    return true;
  }

  if (!nativeSubagentSessions.has(sid)) {
    pruneDelegateFallbackSubagents(sid);
    nativeSubagentSessions.add(sid);
  }

  upsertSubagent(
    sid,
    payload,
    ev.type === "subagent.spawn_requested" || ev.type === "subagent.start",
    ev.type,
  );
  return true;
}
