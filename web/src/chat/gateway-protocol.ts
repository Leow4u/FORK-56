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
    // Appears in Sessions list (deny-list is only ``tool`` / ``kanban``).
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

function normalizeRole(role: unknown): ChatRole | null {
  if (role === "user" || role === "assistant" || role === "system" || role === "tool") {
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
      const status =
        payload && typeof payload === "object"
          ? (payload as { status?: string }).status
          : undefined;
      if (status === "error" && text) {
        return finalizeStreamingAssistant(messages, text);
      }
      return finalizeStreamingAssistant(messages, text);
    }
    case "tool.start": {
      const line = formatToolEvent(payload, "start");
      if (!line) return messages;
      return [
        ...sealStreaming(messages),
        { id: createMessageId(), role: "tool", text: line },
      ];
    }
    case "tool.complete": {
      const line = formatToolEvent(payload, "done");
      if (!line) return messages;
      return [
        ...messages,
        { id: createMessageId(), role: "tool", text: line },
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

function formatToolEvent(
  payload: unknown,
  phase: "start" | "done",
): string {
  if (!payload || typeof payload !== "object") return "";
  const name = String((payload as { name?: unknown }).name || "tool");
  const context = (payload as { context?: unknown }).context;
  const ctx =
    typeof context === "string" && context.trim() ? ` — ${context.trim()}` : "";
  return phase === "start" ? `▶ ${name}${ctx}` : `✓ ${name}${ctx}`;
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
