import { createMessageId, type ChatRole } from "./types";

/** Legacy flat message shape used by ``gateway-protocol.ts`` tests and history helpers. */
export interface FlatChatMessage {
  id: string;
  role: ChatRole | "reasoning";
  text: string;
  streaming?: boolean;
  name?: string;
  context?: string;
  toolId?: string;
  interim?: boolean;
}

/** Message shape returned by ``session.create`` / ``session.resume`` (``_history_to_messages``). */
export interface GatewayHistoryMessage {
  role?: string;
  text?: string;
  name?: string;
  context?: string;
  row_id?: number | string;
  display_kind?: string;
}

export interface SessionCreateResult {
  session_id: string;
  stored_session_id?: string;
  messages?: GatewayHistoryMessage[];
  message_count?: number;
  info?: Record<string, unknown>;
  pending_approval?: Record<string, unknown> | null;
  pending_clarify?: Record<string, unknown> | null;
}

export interface SessionResumeResult extends SessionCreateResult {
  resumed?: string;
  running?: boolean;
  status?: string;
  inflight?: SessionInflightTurn | null;
}

/** ``session.resume`` inflight turn snapshot (``tui_gateway._inflight_snapshot``). */
export interface SessionInflightTurn {
  user?: string;
  assistant?: string;
  streaming?: boolean;
  corrections?: string[];
  correction_offsets?: number[];
  error?: string;
  status?: string;
  recoverable?: boolean;
}

/** Per-turn stream bookkeeping (desktop ``interimBoundaryPending`` / ``streamId``). */
export interface ThinChatTurnState {
  streamId: string | null;
  interimBoundaryPending: boolean;
}

export interface ApplyGatewayEventResult {
  messages: FlatChatMessage[];
  turn: ThinChatTurnState;
}

export function createThinChatTurnState(): ThinChatTurnState {
  return { streamId: null, interimBoundaryPending: false };
}

/** ``session.create`` params for the thin web chat (not the tool sidecar). */
export function thinChatSessionCreateParams(
  profile?: string,
  cwd?: string | null,
): Record<string, unknown> {
  const trimmed = cwd?.trim() ?? "";
  return {
    close_on_disconnect: true,
    source: "web",
    ...(profile ? { profile } : {}),
    ...(trimmed ? { cwd: trimmed } : {}),
  };
}

export function thinChatSessionResumeParams(
  sessionId: string,
  profile?: string,
): Record<string, unknown> {
  return {
    session_id: sessionId,
    ...(profile ? { profile } : {}),
  };
}

export function historyToFlatChatMessages(
  raw: GatewayHistoryMessage[] | unknown[] | null | undefined,
): FlatChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: FlatChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const msg = item as GatewayHistoryMessage;
    const role = normalizeRole(msg.role);
    if (!role) continue;
    if (msg.display_kind === "hidden") continue;
    const text =
      typeof msg.text === "string"
        ? msg.text
        : role === "tool"
          ? formatToolLine(msg)
          : "";
    if (!text.trim() && role !== "assistant") continue;
    out.push({
      id:
        msg.row_id != null
          ? `row-${msg.row_id}`
          : createMessageId(),
      role,
      text: text || (role === "assistant" ? "" : text),
    });
  }
  return out;
}

/** @deprecated Use ``historyToFlatChatMessages`` — kept for existing imports. */
export const historyToChatMessages = historyToFlatChatMessages;

export function sessionMessagesToFlatChatMessages(
  raw: Array<{
    role?: string;
    content?: string | null;
    tool_name?: string;
    id?: number;
    row_id?: number;
  }>,
): FlatChatMessage[] {
  const out: FlatChatMessage[] = [];
  for (const item of raw) {
    const role = normalizeRole(item.role);
    if (!role) continue;
    const text =
      typeof item.content === "string"
        ? item.content
        : item.role === "tool" && item.tool_name
          ? item.tool_name
          : "";
    if (!text.trim()) continue;
    const rowId = item.row_id ?? item.id;
    out.push({
      id: rowId != null ? `row-${rowId}` : createMessageId(),
      role,
      text,
    });
  }
  return out;
}

function normalizeRole(role: unknown): ChatRole | "reasoning" | null {
  if (
    role === "user" ||
    role === "assistant" ||
    role === "system" ||
    role === "tool" ||
    role === "reasoning"
  ) {
    return role;
  }
  return null;
}

function formatToolLine(msg: GatewayHistoryMessage): string {
  const name = msg.name || "tool";
  const ctx = typeof msg.context === "string" && msg.context ? ` — ${msg.context}` : "";
  return `${name}${ctx}`;
}

export function coerceEventText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const text = (payload as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

function responsePreviewedFromPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  return Boolean((payload as { response_previewed?: unknown }).response_previewed);
}

function toolIdFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const id = (payload as { tool_id?: unknown }).tool_id;
  return typeof id === "string" && id ? id : undefined;
}

function clearedTurnState(turn: ThinChatTurnState): ThinChatTurnState {
  return { ...turn, streamId: null, interimBoundaryPending: false };
}

/**
 * Apply a gateway stream event to the transcript.
 * Returns a new array when something changed, otherwise the same reference.
 */
export function applyGatewayEvent(
  messages: FlatChatMessage[],
  eventType: string,
  payload: unknown,
  turn: ThinChatTurnState = createThinChatTurnState(),
): ApplyGatewayEventResult {
  switch (eventType) {
    case "message.start":
      return {
        messages: sealStreaming(messages),
        turn: {
          streamId: createMessageId(),
          interimBoundaryPending: false,
        },
      };
    case "message.delta": {
      const chunk = coerceEventText(payload);
      if (!chunk) return { messages, turn };
      return appendAssistantDelta(messages, turn, chunk);
    }
    case "message.interim": {
      const text = coerceEventText(payload);
      if (!text) {
        return { messages: sealStreaming(messages), turn: { ...turn, streamId: null } };
      }
      return finalizeInterimAssistant(messages, turn, text);
    }
    case "message.complete": {
      const text = coerceEventText(payload);
      return completeAssistantMessage(
        messages,
        turn,
        text,
        responsePreviewedFromPayload(payload),
      );
    }
    case "reasoning.delta":
    case "thinking.delta": {
      const chunk = coerceEventText(payload);
      if (!chunk) return { messages, turn };
      return { messages: appendReasoningDelta(messages, chunk), turn };
    }
    case "reasoning.available": {
      const text = coerceEventText(payload).trim();
      if (!text) return { messages, turn };
      return { messages: replaceReasoningBlock(messages, text), turn };
    }
    case "moa.reference":
    case "moa.aggregating":
    case "moa.progress":
    case "moa.phase": {
      const text = coerceEventText(payload);
      if (!text) return { messages, turn };
      return { messages: appendReasoningDelta(messages, text), turn };
    }
    case "tool.generating": {
      const name =
        payload && typeof payload === "object"
          ? String((payload as { name?: unknown }).name || "tool")
          : "tool";
      return {
        messages: [
          ...sealStreaming(messages),
          {
            id: createMessageId(),
            role: "tool",
            text: `… ${name}`,
            toolId: toolIdFromPayload(payload),
          },
        ],
        turn: { ...turn, streamId: null },
      };
    }
    case "tool.start":
      return {
        messages: upsertToolRow(messages, payload, "start"),
        turn,
      };
    case "tool.progress":
      return {
        messages: upsertToolRow(messages, payload, "progress"),
        turn,
      };
    case "tool.complete":
      return {
        messages: upsertToolRow(messages, payload, "done"),
        turn,
      };
    case "tool.output_risk": {
      const text = coerceEventText(payload);
      if (!text) return { messages, turn };
      return {
        messages: [
          ...messages,
          { id: createMessageId(), role: "system", text: `⚠ ${text}` },
        ],
        turn,
      };
    }
    case "status.update": {
      const kind =
        payload && typeof payload === "object"
          ? (payload as { kind?: unknown }).kind
          : undefined;
      if (kind === "compacting") {
        return {
          messages: [
            ...messages,
            {
              id: "status-compacting",
              role: "system",
              text: "Compacting context…",
            },
          ],
          turn,
        };
      }
      if (kind === "compacted") {
        return {
          messages: messages.filter((m) => m.id !== "status-compacting"),
          turn,
        };
      }
      const text = coerceEventText(payload);
      if (!text) return { messages, turn };
      return {
        messages: [
          ...messages,
          { id: createMessageId(), role: "system", text },
        ],
        turn,
      };
    }
    case "review.summary":
    case "notification.show": {
      const text = coerceEventText(payload);
      if (!text) return { messages, turn };
      return {
        messages: [
          ...messages,
          { id: createMessageId(), role: "system", text },
        ],
        turn,
      };
    }
    case "notification.clear":
      return { messages, turn };
    case "subagent.spawn_requested":
    case "subagent.start":
    case "subagent.thinking":
    case "subagent.tool":
    case "subagent.progress":
    case "subagent.complete": {
      const line = formatSubagentEvent(eventType, payload);
      if (!line) return { messages, turn };
      return {
        messages: [
          ...messages,
          { id: createMessageId(), role: "system", text: line },
        ],
        turn,
      };
    }
    case "error": {
      const message =
        payload && typeof payload === "object"
          ? String((payload as { message?: unknown }).message || "Error")
          : "Error";
      return {
        messages: [
          ...sealStreaming(messages),
          { id: createMessageId(), role: "system", text: message },
        ],
        turn: clearedTurnState(turn),
      };
    }
    default:
      return { messages, turn };
  }
}

/** Last tool/subagent line for the composer activity strip. */
export function activityLineFromGatewayEvent(
  eventType: string,
  payload: unknown,
): string | null {
  switch (eventType) {
    case "tool.generating":
      return formatToolEvent(payload, "start").replace(/^▶/, "…") || null;
    case "tool.start":
      return formatToolEvent(payload, "start") || null;
    case "tool.progress":
      return formatToolEvent(payload, "progress") || null;
    case "tool.complete":
      return formatToolEvent(payload, "done") || null;
    case "status.update": {
      const kind =
        payload && typeof payload === "object"
          ? (payload as { kind?: unknown }).kind
          : undefined;
      if (kind === "compacting") return "Compacting context…";
      if (kind === "compacted") return null;
      if (kind === "process") {
        const text = coerceEventText(payload);
        return text ? `Background: ${text}` : "Background process…";
      }
      return coerceEventText(payload) || null;
    }
    case "notification.show":
      return coerceEventText(payload) || null;
    case "subagent.spawn_requested":
    case "subagent.start":
    case "subagent.thinking":
    case "subagent.tool":
    case "subagent.progress":
    case "subagent.complete":
      return formatSubagentEvent(eventType, payload) || null;
    default:
      return null;
  }
}

export function formatToolEvent(
  payload: unknown,
  phase: "start" | "progress" | "done",
): string {
  if (!payload || typeof payload !== "object") return "";
  const name = String((payload as { name?: unknown }).name || "tool");
  const context = (payload as { context?: unknown }).context;
  const ctx =
    typeof context === "string" && context.trim() ? ` — ${context.trim()}` : "";
  const progress = (payload as { progress?: unknown }).progress;
  if (phase === "progress" && typeof progress === "string" && progress.trim()) {
    return `▶ ${name}${ctx} — ${progress.trim()}`;
  }
  if (phase === "done") {
    const err = (payload as { error?: unknown }).error;
    if (err) return `✗ ${name}${ctx}`;
    return `✓ ${name}${ctx}`;
  }
  return `▶ ${name}${ctx}`;
}

function upsertToolRow(
  messages: FlatChatMessage[],
  payload: unknown,
  phase: "start" | "progress" | "done",
): FlatChatMessage[] {
  const line = formatToolEvent(payload, phase);
  if (!line) return messages;
  const toolId = toolIdFromPayload(payload);
  const base =
    phase === "start" ? [...sealStreaming(messages)] : [...messages];
  if (toolId) {
    const idx = base.findIndex((m) => m.toolId === toolId);
    if (idx >= 0) {
      const next = base.slice();
      next[idx] = { ...next[idx], text: line, role: "tool" };
      return next;
    }
  }
  return [
    ...base,
    {
      id: createMessageId(),
      role: "tool" as const,
      text: line,
      toolId,
    },
  ];
}

function sealStreaming(messages: FlatChatMessage[]): FlatChatMessage[] {
  let changed = false;
  const next = messages.map((m) => {
    if (!m.streaming) return m;
    changed = true;
    return { ...m, streaming: false };
  });
  return changed ? next : messages;
}

/** Reasoning row for the open turn (sits before the trailing assistant/tools). */
function findTurnReasoningIndex(messages: FlatChatMessage[]): number {
  let i = messages.length - 1;
  while (i >= 0 && messages[i].role === "tool") {
    i -= 1;
  }
  if (i >= 0 && messages[i].role === "assistant") {
    i -= 1;
  }
  while (i >= 0 && messages[i].role === "tool") {
    i -= 1;
  }
  if (i >= 0 && messages[i].role === "reasoning") {
    return i;
  }
  return -1;
}

function turnReasoningText(messages: FlatChatMessage[]): string {
  const idx = findTurnReasoningIndex(messages);
  return idx >= 0 ? messages[idx].text.trim() : "";
}

function pruneEmptyReasoning(messages: FlatChatMessage[]): FlatChatMessage[] {
  const next = messages.filter(
    (m) => m.role !== "reasoning" || m.text.trim().length > 0,
  );
  return next.length === messages.length ? messages : next;
}

function appendAssistantDelta(
  messages: FlatChatMessage[],
  turn: ThinChatTurnState,
  chunk: string,
): ApplyGatewayEventResult {
  const streamId = turn.streamId ?? createMessageId();

  if (streamId) {
    const idx = messages.findIndex((m) => m.id === streamId);
    if (idx >= 0 && messages[idx]?.role === "assistant") {
      const next = messages.slice();
      const row = next[idx];
      next[idx] = { ...row, text: row.text + chunk, streaming: true };
      return { messages: next, turn: { ...turn, streamId } };
    }
  }

  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && last.streaming) {
    const next = messages.slice();
    next[next.length - 1] = { ...last, text: last.text + chunk };
    return { messages: next, turn: { ...turn, streamId: last.id } };
  }

  return {
    messages: [
      ...messages,
      {
        id: streamId,
        role: "assistant",
        text: chunk,
        streaming: true,
      },
    ],
    turn: { ...turn, streamId },
  };
}

function appendReasoningDelta(
  messages: FlatChatMessage[],
  chunk: string,
): FlatChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === "reasoning" && last.streaming !== false) {
    const next = messages.slice();
    next[next.length - 1] = { ...last, text: last.text + chunk };
    return next;
  }

  const turnIdx = findTurnReasoningIndex(messages);
  if (turnIdx >= 0) {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (
      lastAssistant?.text.trim() &&
      !lastAssistant.streaming &&
      messages[turnIdx].text.trim()
    ) {
      return messages;
    }

    const next = messages.slice();
    const row = next[turnIdx];
    next[turnIdx] = {
      ...row,
      text: row.text + chunk,
      streaming: row.streaming !== false,
    };
    return next;
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  if (lastAssistant?.text.trim() && !lastAssistant.streaming) {
    return messages;
  }

  return [
    ...sealStreaming(messages),
    {
      id: createMessageId(),
      role: "reasoning",
      text: chunk,
      streaming: true,
    },
  ];
}

function replaceReasoningBlock(
  messages: FlatChatMessage[],
  text: string,
): FlatChatMessage[] {
  const trimmed = text.trim();
  if (!trimmed) return messages;

  if (turnReasoningText(messages)) {
    return messages;
  }

  const last = messages[messages.length - 1];
  if (last?.role === "reasoning") {
    const next = messages.slice();
    next[next.length - 1] = { ...last, text: trimmed, streaming: false };
    return next;
  }

  const turnIdx = findTurnReasoningIndex(messages);
  if (turnIdx >= 0) {
    const next = messages.slice();
    next[turnIdx] = {
      ...next[turnIdx],
      text: trimmed,
      streaming: false,
    };
    return next;
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  if (lastAssistant?.text.trim() && !lastAssistant.streaming) {
    return messages;
  }

  return [
    ...sealStreaming(messages),
    { id: createMessageId(), role: "reasoning", text: trimmed, streaming: false },
  ];
}

function formatSubagentEvent(type: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const goal = typeof p.goal === "string" ? p.goal.trim() : "";
  const text = typeof p.text === "string" ? p.text.trim() : "";
  const summary = typeof p.summary === "string" ? p.summary.trim() : "";
  if (type === "subagent.start" || type === "subagent.spawn_requested") {
    return goal ? `↳ Delegating: ${goal}` : "↳ Starting subagent…";
  }
  if (type === "subagent.complete") {
    if (summary) return `✓ Subagent: ${summary}`;
    const status = typeof p.status === "string" ? p.status : "";
    if (status === "failed" || status === "timeout") {
      return summary || "✗ Subagent failed";
    }
    return "✓ Subagent finished";
  }
  if (text) return `↳ ${text}`;
  if (goal) return `↳ ${goal}`;
  return "";
}

function finalizeInterimAssistant(
  messages: FlatChatMessage[],
  turn: ThinChatTurnState,
  text: string,
): ApplyGatewayEventResult {
  const streamId = turn.streamId;
  let nextMessages = messages;

  if (streamId) {
    const idx = messages.findIndex((m) => m.id === streamId);
    if (idx >= 0 && messages[idx]?.role === "assistant") {
      const next = messages.slice();
      const row = next[idx];
      next[idx] = {
        ...row,
        text: text || row.text,
        streaming: false,
        interim: true,
      };
      nextMessages = next;
    }
  }

  if (nextMessages === messages) {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.streaming) {
      const next = messages.slice();
      next[next.length - 1] = {
        ...last,
        text: text || last.text,
        streaming: false,
        interim: true,
      };
      nextMessages = next;
    } else {
      nextMessages = [
        ...sealStreaming(messages),
        {
          id: createMessageId(),
          role: "assistant",
          text,
          streaming: false,
          interim: true,
        },
      ];
    }
  }

  return {
    messages: nextMessages,
    turn: {
      streamId: null,
      interimBoundaryPending: true,
    },
  };
}

function completeAssistantMessage(
  messages: FlatChatMessage[],
  turn: ThinChatTurnState,
  text: string,
  responsePreviewed: boolean,
): ApplyGatewayEventResult {
  const finalText = text.trim();
  const streamId = turn.streamId;
  const interimBoundaryPending = turn.interimBoundaryPending;
  const nextTurn = clearedTurnState(turn);

  const settleAssistant = (message: FlatChatMessage): FlatChatMessage => ({
    ...message,
    text: finalText || message.text,
    streaming: false,
    interim: false,
  });

  if (streamId) {
    const idx = messages.findIndex((m) => m.id === streamId);
    if (idx >= 0 && messages[idx]?.role === "assistant") {
      const next = pruneEmptyReasoning(messages.slice());
      next[idx] = settleAssistant(next[idx]);
      return { messages: next, turn: nextTurn };
    }
  }

  const lastAssistantIdx = [...messages]
    .map((m, i) => ({ m, i }))
    .reverse()
    .find(({ m }) => m.role === "assistant")?.i;

  if (lastAssistantIdx !== undefined && lastAssistantIdx >= 0) {
    const existing = messages[lastAssistantIdx];
    const existingText = existing.text.trim();
    const finalContinuesInterim = Boolean(
      existing.interim &&
        finalText &&
        existingText &&
        (finalText === existingText ||
          finalText.startsWith(existingText) ||
          existingText.startsWith(finalText)),
    );

    if (
      existing.streaming ||
      (!interimBoundaryPending && finalText && existingText === finalText)
    ) {
      const next = pruneEmptyReasoning(messages.slice());
      next[lastAssistantIdx] = settleAssistant(existing);
      return { messages: next, turn: nextTurn };
    }

    if ((interimBoundaryPending && responsePreviewed) || finalContinuesInterim) {
      const next = pruneEmptyReasoning(messages.slice());
      next[lastAssistantIdx] = settleAssistant(existing);
      return { messages: next, turn: nextTurn };
    }

    if (finalText) {
      return {
        messages: pruneEmptyReasoning([
          ...sealStreaming(messages),
          {
            id: createMessageId(),
            role: "assistant",
            text: finalText,
            streaming: false,
          },
        ]),
        turn: nextTurn,
      };
    }

    return { messages: pruneEmptyReasoning(sealStreaming(messages)), turn: nextTurn };
  }

  if (finalText) {
    return {
      messages: pruneEmptyReasoning([
        ...sealStreaming(messages),
        {
          id: createMessageId(),
          role: "assistant",
          text: finalText,
          streaming: false,
        },
      ]),
      turn: nextTurn,
    };
  }

  return { messages: pruneEmptyReasoning(sealStreaming(messages)), turn: nextTurn };
}
