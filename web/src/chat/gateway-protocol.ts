import { createMessageId, type ChatMessage, type ChatRole } from "./types";

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
}

export interface SessionResumeResult extends SessionCreateResult {
  resumed?: string;
  running?: boolean;
  status?: string;
}

/** ``session.create`` params for the thin web chat (not the tool sidecar). */
export function thinChatSessionCreateParams(
  profile?: string,
): Record<string, unknown> {
  return {
    close_on_disconnect: true,
    source: "web",
    ...(profile ? { profile } : {}),
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

export function historyToChatMessages(
  raw: GatewayHistoryMessage[] | unknown[] | null | undefined,
): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
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

export function sessionMessagesToChatMessages(
  raw: Array<{ role?: string; content?: string | null; tool_name?: string }>,
): ChatMessage[] {
  const out: ChatMessage[] = [];
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
    out.push({
      id: createMessageId(),
      role,
      text,
    });
  }
  return out;
}

function normalizeRole(role: unknown): ChatRole | null {
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

function toolIdFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const id = (payload as { tool_id?: unknown }).tool_id;
  return typeof id === "string" && id ? id : undefined;
}

/**
 * Apply a gateway stream event to the transcript.
 * Returns a new array when something changed, otherwise the same reference.
 */
export function applyGatewayEvent(
  messages: ChatMessage[],
  eventType: string,
  payload: unknown,
): ChatMessage[] {
  switch (eventType) {
    case "message.start":
      return [
        ...sealStreaming(messages),
        {
          id: createMessageId(),
          role: "assistant",
          text: "",
          streaming: true,
        },
      ];
    case "message.delta": {
      const chunk = coerceEventText(payload);
      if (!chunk) return messages;
      return appendAssistantDelta(messages, chunk);
    }
    case "message.interim": {
      const text = coerceEventText(payload);
      if (!text) return sealStreaming(messages);
      return finalizeStreamingAssistant(messages, text);
    }
    case "message.complete": {
      const text = coerceEventText(payload);
      return finalizeStreamingAssistant(messages, text);
    }
    case "reasoning.delta":
    case "thinking.delta": {
      const chunk = coerceEventText(payload);
      if (!chunk) return messages;
      return appendReasoningDelta(messages, chunk);
    }
    case "reasoning.available": {
      const text = coerceEventText(payload);
      if (!text) return messages;
      return replaceReasoningBlock(messages, text);
    }
    case "moa.reference":
    case "moa.aggregating":
    case "moa.progress":
    case "moa.phase": {
      const text = coerceEventText(payload);
      if (!text) return messages;
      return appendReasoningDelta(messages, text);
    }
    case "tool.generating": {
      const name =
        payload && typeof payload === "object"
          ? String((payload as { name?: unknown }).name || "tool")
          : "tool";
      return [
        ...sealStreaming(messages),
        {
          id: createMessageId(),
          role: "tool",
          text: `… ${name}`,
          toolId: toolIdFromPayload(payload),
        },
      ];
    }
    case "tool.start":
      return upsertToolRow(messages, payload, "start");
    case "tool.progress":
      return upsertToolRow(messages, payload, "progress");
    case "tool.complete":
      return upsertToolRow(messages, payload, "done");
    case "tool.output_risk": {
      const text = coerceEventText(payload);
      if (!text) return messages;
      return [
        ...messages,
        { id: createMessageId(), role: "system", text: `⚠ ${text}` },
      ];
    }
    case "status.update": {
      const kind =
        payload && typeof payload === "object"
          ? (payload as { kind?: unknown }).kind
          : undefined;
      if (kind === "compacting") {
        return [
          ...messages,
          {
            id: "status-compacting",
            role: "system",
            text: "Compacting context…",
          },
        ];
      }
      if (kind === "compacted") {
        return messages.filter((m) => m.id !== "status-compacting");
      }
      const text = coerceEventText(payload);
      if (!text) return messages;
      return [
        ...messages,
        { id: createMessageId(), role: "system", text },
      ];
    }
    case "review.summary":
    case "notification.show": {
      const text = coerceEventText(payload);
      if (!text) return messages;
      return [
        ...messages,
        { id: createMessageId(), role: "system", text },
      ];
    }
    case "notification.clear":
      return messages;
    case "subagent.spawn_requested":
    case "subagent.start":
    case "subagent.thinking":
    case "subagent.tool":
    case "subagent.progress":
    case "subagent.complete": {
      const line = formatSubagentEvent(eventType, payload);
      if (!line) return messages;
      return [
        ...messages,
        { id: createMessageId(), role: "system", text: line },
      ];
    }
    case "error": {
      const message =
        payload && typeof payload === "object"
          ? String((payload as { message?: unknown }).message || "Error")
          : "Error";
      return [
        ...sealStreaming(messages),
        { id: createMessageId(), role: "system", text: message },
      ];
    }
    default:
      return messages;
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
  messages: ChatMessage[],
  payload: unknown,
  phase: "start" | "progress" | "done",
): ChatMessage[] {
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

function sealStreaming(messages: ChatMessage[]): ChatMessage[] {
  let changed = false;
  const next = messages.map((m) => {
    if (!m.streaming) return m;
    changed = true;
    return { ...m, streaming: false };
  });
  return changed ? next : messages;
}

function appendAssistantDelta(
  messages: ChatMessage[],
  chunk: string,
): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && last.streaming) {
    const next = messages.slice();
    next[next.length - 1] = { ...last, text: last.text + chunk };
    return next;
  }
  return [
    ...messages,
    {
      id: createMessageId(),
      role: "assistant",
      text: chunk,
      streaming: true,
    },
  ];
}

function appendReasoningDelta(
  messages: ChatMessage[],
  chunk: string,
): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === "reasoning" && last.streaming !== false) {
    const next = messages.slice();
    next[next.length - 1] = { ...last, text: last.text + chunk };
    return next;
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
  messages: ChatMessage[],
  text: string,
): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === "reasoning") {
    const next = messages.slice();
    next[next.length - 1] = { ...last, text, streaming: false };
    return next;
  }
  return [
    ...sealStreaming(messages),
    { id: createMessageId(), role: "reasoning", text, streaming: false },
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

function finalizeStreamingAssistant(
  messages: ChatMessage[],
  text: string,
): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && last.streaming) {
    const next = messages.slice();
    next[next.length - 1] = {
      ...last,
      text: text || last.text,
      streaming: false,
    };
    return next;
  }
  if (text) {
    return [
      ...sealStreaming(messages),
      { id: createMessageId(), role: "assistant", text, streaming: false },
    ];
  }
  return sealStreaming(messages);
}
