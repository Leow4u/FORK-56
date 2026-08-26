import type { ThinChatTurnState } from "./gateway-protocol";
import { createThinChatTurnState } from "./gateway-protocol";
import { reconcileResumeMessages } from "./resume-transcript";
import type { ChatMessage } from "./types";

const STORAGE_PREFIX = "work4you:thin-chat:inflight:";
const JOURNAL_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface InflightJournalSnapshot {
  version: typeof JOURNAL_VERSION;
  updatedAt: number;
  turn: ThinChatTurnState;
  messages: ChatMessage[];
}

export interface InflightJournalRecovery {
  messages: ChatMessage[];
  turn: ThinChatTurnState;
  applied: boolean;
}

function storageKey(storedSessionId: string): string {
  return `${STORAGE_PREFIX}${storedSessionId}`;
}

function readSnapshot(storedSessionId: string): InflightJournalSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(storedSessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InflightJournalSnapshot;
    if (parsed.version !== JOURNAL_VERSION) return null;
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) return null;
    if (!Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(
  storedSessionId: string,
  snapshot: InflightJournalSnapshot,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(storedSessionId), JSON.stringify(snapshot));
  } catch {
    // Best-effort — quota or private mode should not break chat.
  }
}

export function clearInflightJournal(storedSessionId: string | null): void {
  if (!storedSessionId || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(storageKey(storedSessionId));
  } catch {
    // ignore
  }
}

function openTailStart(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "assistant" && !message.streaming && !message.interim) {
      return i + 1;
    }
  }
  return 0;
}

function tailHasRecoverableContent(tail: ChatMessage[]): boolean {
  return tail.some(
    (m) =>
      (m.role === "user" && m.text.trim()) ||
      (m.role === "assistant" && (m.text.trim() || m.streaming)),
  );
}

/**
 * Persist the open turn tail while a session is busy. Clears when the turn
 * settles. Mirrors desktop ``persistInFlightTurnState`` (throttle-free).
 */
export function persistInflightJournal(
  storedSessionId: string | null,
  messages: ChatMessage[],
  turn: ThinChatTurnState,
  busy: boolean,
): void {
  if (!storedSessionId) return;

  if (!busy && !turn.streamId) {
    clearInflightJournal(storedSessionId);
    return;
  }

  const tail = messages.slice(openTailStart(messages));
  if (!tailHasRecoverableContent(tail)) {
    clearInflightJournal(storedSessionId);
    return;
  }

  writeSnapshot(storedSessionId, {
    version: JOURNAL_VERSION,
    updatedAt: Date.now(),
    turn,
    messages: tail,
  });
}

/**
 * Fold a journaled in-flight tail back onto a restored transcript after resume.
 */
export function recoverInflightJournal(
  storedSessionId: string | null,
  baseMessages: ChatMessage[],
  options: { keepPending?: boolean } = {},
): InflightJournalRecovery {
  const noop: InflightJournalRecovery = {
    messages: baseMessages,
    turn: createThinChatTurnState(),
    applied: false,
  };

  if (!storedSessionId) return noop;

  const snapshot = readSnapshot(storedSessionId);
  if (!snapshot) return noop;

  const merged = reconcileResumeMessages(baseMessages, [
    ...baseMessages.slice(0, openTailStart(baseMessages)),
    ...snapshot.messages,
  ]);

  if (merged === baseMessages) {
    return noop;
  }

  const turn =
    options.keepPending && snapshot.turn.streamId
      ? snapshot.turn
      : createThinChatTurnState();

  return {
    messages: merged,
    turn,
    applied: true,
  };
}

/** Stable row key shared by gateway history and REST backfill. */
export function messageRowKey(message: ChatMessage): string | null {
  if (message.id.startsWith("row-")) {
    return message.id;
  }
  return null;
}

/** Prepend older rows without duplicating durable ``row-*`` ids. */
export function prependOlderMessages(
  existing: ChatMessage[],
  older: ChatMessage[],
): ChatMessage[] {
  if (!older.length) return existing;

  const seen = new Set(
    existing
      .map((message) => messageRowKey(message))
      .filter((key): key is string => Boolean(key)),
  );

  const uniqueOlder = older.filter((message) => {
    const key = messageRowKey(message);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!uniqueOlder.length) return existing;
  return [...uniqueOlder, ...existing];
}
