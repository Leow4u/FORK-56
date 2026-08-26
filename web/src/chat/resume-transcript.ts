import {
  createThinChatTurnState,
  type SessionInflightTurn,
  type ThinChatTurnState,
} from "./gateway-protocol";
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
    if (candidate.role === "assistant" && candidate.streaming) {
      continue;
    }
    break;
  }
  return run;
}

function inflightUserPersisted(messages: ChatMessage[], inflightUser: string): boolean {
  if (!inflightUser) return false;
  const run = latestUserRun(messages);
  return run.some((m) => normalizeText(m.text) === inflightUser);
}

/**
 * Append the gateway's live inflight tail onto committed history.
 * Mirrors desktop ``appendLiveSessionProjection`` / TUI ``liveSessionInflightMessages``.
 */
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
      text: inflight.user!.trim(),
    });
  }

  for (const correction of corrections) {
    if (!inflightUserPersisted(out, normalizeText(correction))) {
      out.push({ id: createMessageId(), role: "user", text: correction });
    }
  }

  if (error) {
    out.push({
      id: createMessageId(),
      role: "system",
      text: error,
    });
    if (assistant.trim()) {
      out.push({
        id: `inflight-assistant-${sessionId}`,
        role: "assistant",
        text: assistant.trim(),
        streaming: false,
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
    next[existingIdx] = {
      ...next[existingIdx],
      text: assistantText || next[existingIdx].text,
      streaming,
    };
    return next;
  }

  const lastAssistant = [...out].reverse().find((m) => m.role === "assistant");
  if (
    lastAssistant &&
    !lastAssistant.streaming &&
    assistantText &&
    normalizeText(lastAssistant.text) === normalizeText(assistantText) &&
    !streaming
  ) {
    return out;
  }

  out.push({
    id: streamId,
    role: "assistant",
    text: assistantText,
    streaming,
  });

  return out;
}

/** Seed turn state when resuming onto a live streaming inflight assistant. */
export function turnStateFromInflight(
  inflight: SessionInflightTurn | null | undefined,
  sessionId: string,
): ThinChatTurnState {
  if (!inflight?.streaming) {
    return createThinChatTurnState();
  }
  return {
    streamId: `inflight-assistant-${sessionId}`,
    interimBoundaryPending: false,
  };
}

/**
 * Merge authoritative resume history with the local optimistic tail instead of
 * clobbering rows that have not round-tripped yet.
 */
export function reconcileResumeMessages(
  authoritative: ChatMessage[],
  local: ChatMessage[],
): ChatMessage[] {
  if (!local.length) return authoritative;

  let openTailStart = 0;
  for (let i = authoritative.length - 1; i >= 0; i -= 1) {
    const message = authoritative[i];
    if (message.role === "assistant" && !message.streaming && !message.interim) {
      openTailStart = i + 1;
      break;
    }
  }

  const localTail = local.slice(openTailStart);
  if (!localTail.length) return authoritative;

  const authoritativeKeys = new Set(
    authoritative.map((m) => `${m.role}:${normalizeText(m.text)}`),
  );

  const merged = [...authoritative];
  const authoritativeTail = authoritative.slice(openTailStart);

  for (const localMsg of localTail) {
    const key = `${localMsg.role}:${normalizeText(localMsg.text)}`;

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

    const localText = localMsg.text.trim();
    const tailAssistant = [...authoritativeTail]
      .reverse()
      .find((m) => m.role === "assistant");
    const tailText = tailAssistant?.text.trim() ?? "";

    const localRicher =
      localText.length > tailText.length ||
      (localMsg.streaming && !tailAssistant?.streaming);

    if (!localRicher) {
      continue;
    }

    if (tailAssistant) {
      const idx = merged.findIndex((m) => m.id === tailAssistant.id);
      if (idx >= 0) {
        merged[idx] = {
          ...tailAssistant,
          text: localText.length >= tailText.length ? localMsg.text : tailAssistant.text,
          streaming: localMsg.streaming || tailAssistant.streaming,
        };
        continue;
      }
    }

    if (!authoritativeKeys.has(key) || localMsg.streaming) {
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
