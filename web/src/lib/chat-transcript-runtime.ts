import type { ThreadMessage } from "@assistant-ui/react";

import {
  type ChatMessage,
  type ChatMessagePart,
  chatMessageText,
  textPart,
} from "@/lib/chat-messages";

const THINKING_STATUS_PREFIX_RE =
  /^\s*(?:(?:[^\s.]{1,16})\s+)?(?:processing|thinking|reasoning|analyzing|pondering|contemplating|musing|cogitating|ruminating|deliberating|mulling|reflecting|computing|synthesizing|formulating|brainstorming)\.\.\.\s*/i;

const EMPTY_THINKING_PLACEHOLDER_RE =
  /\b(?:current rewritten thinking|next thinking to process|provide the thinking content|don't see any .*thinking)\b/i;

export function coerceGatewayText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          if (typeof row.text === "string") return row.text;
          if (typeof row.output_text === "string") return row.output_text;
        }
        return "";
      })
      .join("");
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.text === "string") return row.text;
    if (typeof row.output_text === "string") return row.output_text;
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

export function coerceThinkingText(value: unknown): string {
  const raw = coerceGatewayText(value).replace(THINKING_STATUS_PREFIX_RE, "");
  return EMPTY_THINKING_PLACEHOLDER_RE.test(raw) ? "" : raw;
}

export function messageCreatedAt(
  message: Pick<ChatMessage, "timestamp">,
  nowMs = Date.now(),
): Date {
  return typeof message.timestamp === "number" &&
    Number.isFinite(message.timestamp) &&
    message.timestamp > 0
    ? new Date(message.timestamp * 1000)
    : new Date(nowMs);
}

export function toRuntimeMessage(message: ChatMessage): ThreadMessage {
  const role =
    message.role === "user" ||
    message.role === "assistant" ||
    message.role === "system"
      ? message.role
      : "assistant";

  const createdAt = messageCreatedAt(message);

  const reactionMeta = {
    ...(message.rowId !== undefined ? { rowId: message.rowId } : {}),
    ...(message.reactions?.length ? { reactions: message.reactions } : {}),
  };

  const timelineMeta =
    typeof message.timestamp === "number" &&
    Number.isFinite(message.timestamp) &&
    message.timestamp > 0
      ? { timelineTimestamp: message.timestamp }
      : {};

  if (role === "user") {
    return {
      id: message.id,
      role,
      content: message.parts.filter(
        (part): part is Extract<ChatMessagePart, { type: "text" }> =>
          part.type === "text",
      ),
      attachments: [],
      createdAt,
      metadata: {
        custom: {
          attachmentRefs: message.attachmentRefs ?? [],
          ...reactionMeta,
          ...timelineMeta,
        },
      },
    } as ThreadMessage;
  }

  if (role === "system") {
    const text = chatMessageText(message);
    return {
      id: message.id,
      role,
      content: [textPart(text)],
      createdAt,
      metadata: { custom: timelineMeta },
    } as ThreadMessage;
  }

  return {
    id: message.id,
    role,
    content: message.parts as Extract<
      ThreadMessage,
      { role: "assistant" }
    >["content"],
    createdAt,
    status: message.error
      ? { type: "incomplete", reason: "error", error: message.error }
      : message.pending
        ? { type: "running" }
        : { type: "complete", reason: "stop" },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {
        ...(message.interim ? { interim: true } : {}),
        ...timelineMeta,
        ...(message.completedAt !== undefined
          ? { timelineCompletedAt: message.completedAt }
          : {}),
        ...(message.durationS !== undefined ? { durationS: message.durationS } : {}),
        ...reactionMeta,
      },
    },
  } as ThreadMessage;
}

export type ToolMergeCache = WeakMap<
  ChatMessage,
  {
    merged: ChatMessage;
    parts: ChatMessagePart[];
    prev: ChatMessage;
    prevParts: ChatMessagePart[];
  }
>;

export function createToolMergeCache(): ToolMergeCache {
  return new WeakMap();
}

function isToolOnlyAssistant(message: ChatMessage): boolean {
  return (
    message.role === "assistant" &&
    !message.pending &&
    !message.error &&
    !message.hidden &&
    message.parts.length > 0 &&
    message.parts.every((part) => part.type === "tool-call")
  );
}

export function coalesceToolOnlyAssistants(
  messages: ChatMessage[],
  cache: ToolMergeCache,
): ChatMessage[] {
  const out: ChatMessage[] = [];

  for (const message of messages) {
    const prev = out.at(-1);

    if (
      prev &&
      prev.role === "assistant" &&
      !prev.pending &&
      !prev.hidden &&
      isToolOnlyAssistant(message)
    ) {
      const cached = cache.get(message);
      const merged =
        cached &&
        cached.prev === prev &&
        cached.prevParts === prev.parts &&
        cached.parts === message.parts
          ? cached.merged
          : {
              ...prev,
              completedAt: [
                prev.completedAt,
                message.completedAt,
                ...message.parts.map((part) => part.completedAt),
              ]
                .filter((value): value is number => value !== undefined)
                .reduce<number | undefined>(
                  (latest, value) =>
                    latest === undefined ? value : Math.max(latest, value),
                  undefined,
                ),
              parts: [...prev.parts, ...message.parts],
            };

      cache.set(message, {
        merged,
        parts: message.parts,
        prev,
        prevParts: prev.parts,
      });
      out[out.length - 1] = merged;
      continue;
    }

    out.push(message);
  }

  return out;
}
