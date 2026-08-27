/** Display roles — legacy alias; parts model uses SessionMessage roles. */
export type ChatRole =
  | "user"
  | "assistant"
  | "system"
  | "tool";

export type { ChatMessage } from "@/lib/chat-messages/types";

export type ThinChatPhase = "home" | "session";

export function createMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
