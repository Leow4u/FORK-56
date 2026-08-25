import type { ChatMessage } from "./types";

/** True while the agent turn is in flight but no visible assistant text yet. */
export function shouldShowThinking(
  messages: ChatMessage[],
  busy: boolean,
): boolean {
  if (!busy) return false;
  const last = messages[messages.length - 1];
  if (!last) return true;
  if (last.role === "user") return true;
  if (last.role === "assistant" && last.streaming && !last.text.trim()) {
    return true;
  }
  return false;
}
