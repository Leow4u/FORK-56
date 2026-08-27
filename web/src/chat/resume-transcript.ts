import {
  assistantTextPart,
  chatMessageText,
  textPart,
} from "@/lib/chat-messages";

import {
  createPartsTurnState,
  type SessionInflightTurn,
  type PartsTurnState,
} from "./parts-gateway-protocol";
import { createMessageId, type ChatMessage } from "./types";

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function latestUserRun(messages: ChatMessage[]): ChatMessage[] {
  const latestUserIndex = messages.map((m) => m.role).lastIndexOf("user");
  if (latestUserIndex < 0) return [];

  const run: ChatMessage[] = [];
  for (let index = latestUserIndex; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate.role === "user") {
      run.unshift(candidate);
      continue;
    }
    if (candidate.role === "assistant" && candidate.pending) {
      continue;
    }
    break;
  }
  return run;
}

function inflightUserPersisted(
  messages: ChatMessage[],
  inflightUser: string,
): boolean {
  if (!inflightUser) return false;
  const run = latestUserRun(messages);
  return run.some(
    (m) => normalizeText(chatMessageText(m)) === inflightUser,
  );
}

export function appendInflightProjection(
  messages: ChatMessage[],
  inflight?: SessionInflightTurn | null,
  sessionId = "session",
): ChatMessage[] {
  if (!inflight) return messages;

  const inflightUser = normalizeText(inflight.user ?? "");
  const assistant = inflight.assistant ?? "";
  const streaming = Boolean(inflight.streaming);
  const error = normalizeText(inflight.error ?? "");
  const corrections = (inflight.corrections ?? [])
    .map((c) => c.trim())
    .filter(Boolean);

  if (
    !inflightUser &&
    !assistant &&
    !streaming &&
    !error &&
    corrections.length === 0
  ) {
    return messages;
  }

  const out = [...messages];

  if (inflightUser && !inflightUserPersisted(out, inflightUser)) {
    out.push({
      id: createMessageId(),
      role: "user",
      parts: [textPart(inflight.user!.trim())],
    });
  }

  for (const correction of corrections) {
    if (!inflightUserPersisted(out, normalizeText(correction))) {
      out.push({
        id: createMessageId(),
        role: "user",
        parts: [textPart(correction)],
      });
    }
  }

  if (error) {
    out.push({
      id: createMessageId(),
      role: "system",
      parts: [textPart(error)],
    });
    if (assistant.trim()) {
      out.push({
        id: `inflight-assistant-${sessionId}`,
        role: "assistant",
        parts: [assistantTextPart(assistant.trim())],
        pending: false,
      });
    }
    return out;
  }

  if (!assistant.trim() && !streaming) {
    return out;
  }

  const streamId = `inflight-assistant-${sessionId}`;
  const existingIdx = out.findIndex((m) => m.id === streamId);
  const assistantText = assistant.trim();

  if (existingIdx >= 0) {
    const next = out.slice();
    const existing = next[existingIdx];
    next[existingIdx] = {
      ...existing,
      parts: assistantText
        ? [assistantTextPart(assistantText)]
        : existing.parts,
      pending: streaming,
    };
    return next;
  }

  const lastAssistant = [...out].reverse().find((m) => m.role === "assistant");
  if (
    lastAssistant &&
    !lastAssistant.pending &&
    assistantText &&
    normalizeText(chatMessageText(lastAssistant)) ===
      normalizeText(assistantText) &&
    !streaming
  ) {
    return out;
  }

  out.push({
    id: streamId,
    role: "assistant",
    parts: assistantText ? [assistantTextPart(assistantText)] : [],
    pending: streaming,
  });

  return out;
}

export function turnStateFromInflight(
  inflight: SessionInflightTurn | null | undefined,
  sessionId: string,
): PartsTurnState {
  if (!inflight?.streaming) {
    return createPartsTurnState();
  }
  return {
    streamId: `inflight-assistant-${sessionId}`,
    interimBoundaryPending: false,
  };
}

export function reconcileResumeMessages(
  authoritative: ChatMessage[],
  local: ChatMessage[],
): ChatMessage[] {
  if (!local.length) return authoritative;

  let openTailStart = 0;
  for (let i = authoritative.length - 1; i >= 0; i -= 1) {
    const message = authoritative[i];
    if (
      message.role === "assistant" &&
      !message.pending &&
      !message.interim
    ) {
      openTailStart = i + 1;
      break;
    }
  }

  const localTail = local.slice(openTailStart);
  if (!localTail.length) return authoritative;

  const authoritativeKeys = new Set(
    authoritative.map(
      (m) => `${m.role}:${normalizeText(chatMessageText(m))}`,
    ),
  );

  const merged = [...authoritative];
  const authoritativeTail = authoritative.slice(openTailStart);

  for (const localMsg of localTail) {
    const key = `${localMsg.role}:${normalizeText(chatMessageText(localMsg))}`;

    if (localMsg.role === "user") {
      if (!authoritativeKeys.has(key)) {
        merged.push(localMsg);
        authoritativeKeys.add(key);
      }
      continue;
    }

    if (localMsg.role !== "assistant") {
      continue;
    }

    const localText = chatMessageText(localMsg).trim();
    const tailAssistant = [...authoritativeTail]
      .reverse()
      .find((m) => m.role === "assistant");
    const tailText = tailAssistant ? chatMessageText(tailAssistant).trim() : "";

    const localRicher =
      localText.length > tailText.length ||
      (localMsg.pending && !tailAssistant?.pending);

    if (!localRicher) {
      continue;
    }

    if (tailAssistant) {
      const idx = merged.findIndex((m) => m.id === tailAssistant.id);
      if (idx >= 0) {
        merged[idx] = {
          ...tailAssistant,
          parts:
            localText.length >= tailText.length
              ? localMsg.parts
              : tailAssistant.parts,
          pending: localMsg.pending || tailAssistant.pending,
        };
        continue;
      }
    }

    if (!authoritativeKeys.has(key) || localMsg.pending) {
      merged.push(localMsg);
    }
  }

  return merged;
}

export function buildResumeTranscript(
  history: ChatMessage[],
  inflight: SessionInflightTurn | null | undefined,
  localMessages: ChatMessage[],
  sessionId: string,
): ChatMessage[] {
  const withInflight = appendInflightProjection(history, inflight, sessionId);
  return reconcileResumeMessages(withInflight, localMessages);
}
