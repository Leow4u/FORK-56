import type { ConnectionState } from "@work4you/shared";
import { atom } from "nanostores";

import type { ChatMessage } from "@/lib/chat-messages";

/** Minimal web shim for assistant-ui transcript components. */

export const $messages = atom<ChatMessage[]>([]);
export const $activeSessionId = atom<string | null>(null);
export const $selectedStoredSessionId = atom<string | null>(null);
export const $sessions = atom<unknown[]>([]);
export const $connection = atom<ConnectionState>("closed");
export const $terminalBackend = atom<string | null>(null);
export const $cwd = atom<string>("");
export const $currentCwd = $cwd;
export const $busy = atom(false);
export const $turnStartedAt = atom<number | null>(null);

export function setMessages(
  updater: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[]),
): void {
  $messages.set(
    typeof updater === "function" ? updater($messages.get()) : updater,
  );
}

export function activeGateway() {
  return null;
}

export const sessionMatchesStoredId = (
  session: { id?: string; _lineage_root_id?: string },
  storedSessionId: string,
): boolean =>
  session.id === storedSessionId ||
  session._lineage_root_id === storedSessionId;
