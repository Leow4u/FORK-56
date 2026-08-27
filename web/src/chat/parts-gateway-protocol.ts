/**
 * Parts-based gateway event reducer for thin web chat (desktop parity).
 * Mirrors ``gateway-protocol.ts`` but stores ``ChatMessage.parts[]`` for
 * assistant-ui Thread + ToolFallback.
 */

import {
  appendAssistantTextPart,
  appendReasoningPart,
  assistantTextPart,
  chatMessageText,
  completeOpenTimelineParts,
  mergeFinalAssistantText,
  reasoningPart,
  renderMediaTags,
  textPart,
} from "@/lib/chat-messages";
import { toChatMessages } from "@/lib/chat-messages/hydration";
import {
  sealOpenToolParts,
  upsertToolPart,
} from "@/lib/chat-messages/tool-parts";
import type {
  ChatMessage,
  GatewayEventPayload,
} from "@/lib/chat-messages/types";
import {
  coerceGatewayText,
  coerceThinkingText,
} from "@/lib/chat-transcript-runtime";
import type { SessionMessage } from "@/types/work4you";

import {
  activityLineFromGatewayEvent,
  coerceEventText,
  formatToolEvent,
  type GatewayHistoryMessage,
  type SessionCreateResult,
  type SessionInflightTurn,
  type SessionResumeResult,
  thinChatSessionCreateParams,
  thinChatSessionResumeParams,
} from "./gateway-protocol";
import { createMessageId } from "./types";

export type { SessionCreateResult, SessionResumeResult, SessionInflightTurn };
export {
  activityLineFromGatewayEvent,
  thinChatSessionCreateParams,
  thinChatSessionResumeParams,
};

export interface PartsTurnState {
  streamId: string | null;
  interimBoundaryPending: boolean;
}

export interface ApplyPartsGatewayEventResult {
  messages: ChatMessage[];
  turn: PartsTurnState;
}

export function createPartsTurnState(): PartsTurnState {
  return { streamId: null, interimBoundaryPending: false };
}

let streamMessageSeq = 0;
const nextStreamMessageId = (prefix: string) =>
  `${prefix}-${Date.now()}-${++streamMessageSeq}`;

function gatewayHistoryToSessionMessages(
  raw: GatewayHistoryMessage[],
): SessionMessage[] {
  const out: SessionMessage[] = [];
  for (const msg of raw) {
    if (!msg || typeof msg !== "object") continue;
    const role = msg.role;
    if (
      role !== "user" &&
      role !== "assistant" &&
      role !== "system" &&
      role !== "tool"
    ) {
      continue;
    }
    if (msg.display_kind === "hidden") continue;
    out.push({
      role,
      content: typeof msg.text === "string" ? msg.text : "",
      name: msg.name,
      row_id:
        typeof msg.row_id === "number"
          ? msg.row_id
          : typeof msg.row_id === "string"
            ? Number(msg.row_id)
            : undefined,
      display_kind: msg.display_kind,
    });
  }
  return out;
}

export function historyToPartsMessages(
  raw: GatewayHistoryMessage[] | unknown[] | null | undefined,
): ChatMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return toChatMessages(gatewayHistoryToSessionMessages(raw as GatewayHistoryMessage[]));
}

export function sessionMessagesToPartsMessages(
  raw: Array<{
    role?: string;
    content?: string | null;
    tool_name?: string;
    id?: number;
    row_id?: number;
    name?: string;
    tool_call_id?: string;
    reasoning?: string | null;
    display_kind?: string;
  }>,
): ChatMessage[] {
  const sessionRows: SessionMessage[] = [];
  for (const item of raw) {
    const role = item.role;
    if (
      role !== "user" &&
      role !== "assistant" &&
      role !== "system" &&
      role !== "tool"
    ) {
      continue;
    }
    sessionRows.push({
      role,
      content: typeof item.content === "string" ? item.content : "",
      name: item.tool_name ?? item.name,
      row_id: item.row_id ?? item.id,
      tool_call_id: item.tool_call_id ?? undefined,
      reasoning: item.reasoning,
      display_kind: item.display_kind,
    });
  }
  return toChatMessages(sessionRows);
}

function responsePreviewedFromPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  return Boolean((payload as { response_previewed?: unknown }).response_previewed);
}

function clearedTurnState(turn: PartsTurnState): PartsTurnState {
  return { ...turn, streamId: null, interimBoundaryPending: false };
}

function sealPendingAssistants(messages: ChatMessage[]): ChatMessage[] {
  let changed = false;
  const next = messages.map((m) => {
    if (m.role !== "assistant" || !m.pending) return m;
    changed = true;
    return { ...m, pending: false };
  });
  return changed ? next : messages;
}

function findStreamMessage(
  messages: ChatMessage[],
  streamId: string | null,
): ChatMessage | undefined {
  if (!streamId) return undefined;
  return messages.find((m) => m.id === streamId);
}

function upsertStreamMessage(
  messages: ChatMessage[],
  streamId: string,
  update: (msg: ChatMessage) => ChatMessage,
  seed: () => ChatMessage,
): ChatMessage[] {
  const idx = messages.findIndex((m) => m.id === streamId);
  if (idx < 0) return [...messages, seed()];
  const next = messages.slice();
  next[idx] = update(next[idx]);
  return next;
}

function appendAssistantDelta(
  messages: ChatMessage[],
  turn: PartsTurnState,
  chunk: string,
  occurredAt = Date.now() / 1000,
): ApplyPartsGatewayEventResult {
  const streamId = turn.streamId ?? nextStreamMessageId("assistant-stream");
  const existing = findStreamMessage(messages, streamId);

  if (existing && existing.role === "assistant") {
    return {
      messages: upsertStreamMessage(
        messages,
        streamId,
        (m) => ({
          ...m,
          parts: appendAssistantTextPart(m.parts, chunk, occurredAt),
          pending: true,
        }),
        () => existing,
      ),
      turn: { ...turn, streamId },
    };
  }

  return {
    messages: [
      ...messages,
      {
        id: streamId,
        role: "assistant",
        parts: appendAssistantTextPart([], chunk, occurredAt),
        timestamp: occurredAt,
        pending: true,
      },
    ],
    turn: { ...turn, streamId },
  };
}

function appendReasoningDelta(
  messages: ChatMessage[],
  turn: PartsTurnState,
  chunk: string,
  replace = false,
  occurredAt = Date.now() / 1000,
): ApplyPartsGatewayEventResult {
  const streamId = turn.streamId;
  const existing = streamId ? findStreamMessage(messages, streamId) : undefined;

  if (existing && existing.role === "assistant") {
    const parts = replace
      ? [
          ...existing.parts.filter((p) => p.type !== "reasoning"),
          reasoningPart(chunk, occurredAt),
        ]
      : appendReasoningPart(existing.parts, chunk, occurredAt);
    return {
      messages: upsertStreamMessage(
        messages,
        existing.id,
        (m) => ({ ...m, parts, pending: true }),
        () => existing,
      ),
      turn,
    };
  }

  const last = messages.at(-1);
  if (last?.role === "assistant" && last.pending) {
    const parts = replace
      ? [
          ...last.parts.filter((p) => p.type !== "reasoning"),
          reasoningPart(chunk, occurredAt),
        ]
      : appendReasoningPart(last.parts, chunk, occurredAt);
    const next = messages.slice();
    next[next.length - 1] = { ...last, parts };
    return { messages: next, turn: { ...turn, streamId: last.id } };
  }

  const id = streamId ?? nextStreamMessageId("assistant-stream");
  return {
    messages: [
      ...messages,
      {
        id,
        role: "assistant",
        parts: [reasoningPart(chunk, occurredAt)],
        timestamp: occurredAt,
        pending: true,
      },
    ],
    turn: { ...turn, streamId: id },
  };
}

function finalizeInterimAssistant(
  messages: ChatMessage[],
  turn: PartsTurnState,
  text: string,
  occurredAt = Date.now() / 1000,
): ApplyPartsGatewayEventResult {
  const authoritative = renderMediaTags(text).trim();
  if (!authoritative) {
    return { messages: sealPendingAssistants(messages), turn: { ...turn, streamId: null } };
  }

  const streamId = turn.streamId;
  if (streamId && messages.some((m) => m.id === streamId)) {
    return {
      messages: messages.map((m) =>
        m.id === streamId
          ? {
              ...m,
              parts: completeOpenTimelineParts(
                mergeFinalAssistantText(m.parts, authoritative, occurredAt),
                occurredAt,
              ),
              completedAt: occurredAt,
              pending: false,
              interim: true,
            }
          : m,
      ),
      turn: { ...turn, streamId: null, interimBoundaryPending: true },
    };
  }

  return {
    messages: [
      ...messages,
      {
        id: nextStreamMessageId("assistant-interim"),
        role: "assistant",
        parts: [
          {
            ...assistantTextPart(authoritative, occurredAt),
            completedAt: occurredAt,
          },
        ],
        timestamp: occurredAt,
        completedAt: occurredAt,
        pending: false,
        interim: true,
      },
    ],
    turn: { ...turn, streamId: null, interimBoundaryPending: true },
  };
}

function completeAssistantMessage(
  messages: ChatMessage[],
  turn: PartsTurnState,
  text: string,
  responsePreviewed: boolean,
  occurredAt = Date.now() / 1000,
): ApplyPartsGatewayEventResult {
  const finalText = renderMediaTags(text).trim();
  const streamId = turn.streamId;
  const interimBoundaryPending = turn.interimBoundaryPending;

  const settle = (m: ChatMessage): ChatMessage => ({
    ...m,
    parts: completeOpenTimelineParts(
      finalText
        ? mergeFinalAssistantText(m.parts, finalText, occurredAt)
        : m.parts,
      occurredAt,
    ),
    completedAt: occurredAt,
    pending: false,
    interim: false,
  });

  let nextMessages = messages;

  if (streamId && messages.some((m) => m.id === streamId)) {
    nextMessages = messages.map((m) => (m.id === streamId ? settle(m) : m));
  } else {
    const fallbackIndex = [...messages]
      .reverse()
      .findIndex((m) => m.role === "assistant" && !m.hidden);
    if (fallbackIndex >= 0 && finalText) {
      const index = messages.length - 1 - fallbackIndex;
      const existing = messages[index];
      const existingText = chatMessageText(existing).trim();
      const continues =
        Boolean(
          existing.interim &&
            finalText &&
            existingText &&
            (finalText === existingText ||
              finalText.startsWith(existingText) ||
              existingText.startsWith(finalText)),
        );
      if (
        existing.pending ||
        (!interimBoundaryPending && existingText === finalText) ||
        (interimBoundaryPending && responsePreviewed) ||
        continues
      ) {
        nextMessages = messages.map((m, i) => (i === index ? settle(m) : m));
      } else {
        nextMessages = [
          ...messages,
          {
            id: nextStreamMessageId("assistant"),
            role: "assistant" as const,
            parts: [
              {
                ...assistantTextPart(finalText, occurredAt),
                completedAt: occurredAt,
              },
            ],
            timestamp: occurredAt,
            completedAt: occurredAt,
          },
        ];
      }
    } else if (finalText) {
      nextMessages = [
        ...messages,
        {
          id: nextStreamMessageId("assistant"),
          role: "assistant" as const,
          parts: [
            {
              ...assistantTextPart(finalText, occurredAt),
              completedAt: occurredAt,
            },
          ],
          timestamp: occurredAt,
          completedAt: occurredAt,
        },
      ];
    }
  }

  nextMessages = sealOpenToolParts(nextMessages);

  return {
    messages: nextMessages,
    turn: clearedTurnState(turn),
  };
}

function upsertTool(
  messages: ChatMessage[],
  turn: PartsTurnState,
  payload: unknown,
  phase: "running" | "complete",
  occurredAt = Date.now() / 1000,
): ApplyPartsGatewayEventResult {
  const streamId = turn.streamId ?? nextStreamMessageId("assistant-stream");
  const eventPayload = (payload ?? {}) as GatewayEventPayload;
  const toolPhase = phase === "running" ? "running" : "complete";

  const existing = findStreamMessage(messages, streamId);
  if (existing && existing.role === "assistant") {
    return {
      messages: upsertStreamMessage(
        messages,
        streamId,
        (m) => ({
          ...m,
          parts: upsertToolPart(
            m.parts,
            eventPayload,
            toolPhase,
            occurredAt,
          ),
          pending: phase !== "complete",
        }),
        () => existing,
      ),
      turn: { ...turn, streamId },
    };
  }

  return {
    messages: [
      ...sealPendingAssistants(messages),
      {
        id: streamId,
        role: "assistant",
        parts: upsertToolPart([], eventPayload, toolPhase, occurredAt),
        timestamp: occurredAt,
        pending: phase !== "complete",
      },
    ],
    turn: { ...turn, streamId },
  };
}

function appendSystemLine(
  messages: ChatMessage[],
  text: string,
  id?: string,
  occurredAt = Date.now() / 1000,
): ChatMessage[] {
  if (!text.trim()) return messages;
  return [
    ...messages,
    {
      id: id ?? createMessageId(),
      role: "system",
      parts: [textPart(text, occurredAt)],
      timestamp: occurredAt,
    },
  ];
}

export function applyPartsGatewayEvent(
  messages: ChatMessage[],
  eventType: string,
  payload: unknown,
  turn: PartsTurnState = createPartsTurnState(),
): ApplyPartsGatewayEventResult {
  const occurredAt =
    payload &&
    typeof payload === "object" &&
    typeof (payload as { timestamp?: unknown }).timestamp === "number"
      ? ((payload as { timestamp: number }).timestamp as number)
      : Date.now() / 1000;

  switch (eventType) {
    case "message.start":
      return {
        messages: sealPendingAssistants(messages),
        turn: {
          streamId: nextStreamMessageId("assistant-stream"),
          interimBoundaryPending: false,
        },
      };
    case "message.delta": {
      const chunk = coerceGatewayText(
        payload && typeof payload === "object"
          ? (payload as { text?: unknown }).text
          : "",
      );
      if (!chunk) return { messages, turn };
      return appendAssistantDelta(messages, turn, chunk, occurredAt);
    }
    case "message.interim": {
      const text = coerceEventText(payload);
      if (!text) {
        return {
          messages: sealPendingAssistants(messages),
          turn: { ...turn, streamId: null },
        };
      }
      return finalizeInterimAssistant(messages, turn, text, occurredAt);
    }
    case "message.complete": {
      const text = coerceEventText(payload);
      return completeAssistantMessage(
        messages,
        turn,
        text,
        responsePreviewedFromPayload(payload),
        occurredAt,
      );
    }
    case "reasoning.delta":
    case "thinking.delta": {
      const chunk = coerceThinkingText(
        payload && typeof payload === "object"
          ? (payload as { text?: unknown }).text
          : "",
      );
      if (!chunk) return { messages, turn };
      return appendReasoningDelta(messages, turn, chunk, false, occurredAt);
    }
    case "reasoning.available": {
      const text = coerceThinkingText(coerceEventText(payload)).trim();
      if (!text) return { messages, turn };
      return appendReasoningDelta(messages, turn, text, true, occurredAt);
    }
    case "moa.reference":
    case "moa.progress":
    case "moa.phase": {
      const text = coerceEventText(payload);
      if (!text) return { messages, turn };
      return appendReasoningDelta(messages, turn, text, false, occurredAt);
    }
    case "moa.aggregating":
      return { messages, turn };
    case "tool.generating":
      return { messages, turn };
    case "tool.start":
    case "tool.progress":
      return upsertTool(messages, turn, payload, "running", occurredAt);
    case "tool.complete":
      return upsertTool(messages, turn, payload, "complete", occurredAt);
    case "tool.output_risk": {
      const text = coerceEventText(payload);
      if (!text) return { messages, turn };
      return {
        messages: appendSystemLine(messages, `⚠ ${text}`, undefined, occurredAt),
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
          messages: appendSystemLine(
            messages,
            "Compacting context…",
            "status-compacting",
            occurredAt,
          ),
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
        messages: appendSystemLine(messages, text, undefined, occurredAt),
        turn,
      };
    }
    case "review.summary":
    case "notification.show": {
      const text = coerceEventText(payload);
      if (!text) return { messages, turn };
      return {
        messages: appendSystemLine(messages, text, undefined, occurredAt),
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
      const line = formatToolEvent(payload, "start");
      if (!line) return { messages, turn };
      return {
        messages: appendSystemLine(messages, line, undefined, occurredAt),
        turn,
      };
    }
    case "error": {
      const message =
        payload && typeof payload === "object"
          ? String((payload as { message?: unknown }).message || "Error")
          : "Error";
      return {
        messages: appendSystemLine(messages, message, undefined, occurredAt),
        turn: clearedTurnState(turn),
      };
    }
    default:
      return { messages, turn };
  }
}

export function optimisticUserPartsMessage(
  text: string,
  images?: string[],
  occurredAt = Date.now() / 1000,
): ChatMessage {
  const parts = [textPart(text, occurredAt)];
  return {
    id: createMessageId(),
    role: "user",
    parts,
    timestamp: occurredAt,
    attachmentRefs: images,
  };
}
