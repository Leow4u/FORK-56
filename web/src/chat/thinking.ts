import { chatMessageText } from "@/lib/chat-messages";
import type { ChatMessage } from "@/lib/chat-messages/types";

/** True while the agent turn is in flight but no visible assistant text yet. */
export function shouldShowThinking(
  messages: ChatMessage[],
  busy: boolean,
): boolean {
  if (!busy) return false;
  const last = messages[messages.length - 1];
  if (!last) return true;
  if (last.role === "user") return true;
  if (
    last.role === "assistant" &&
    last.pending &&
    !chatMessageText(last).trim()
  ) {
    return true;
  }
  return false;
}
