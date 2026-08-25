/** Display roles for the thin web chat transcript (v1 skeleton). */
export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** True while the assistant bubble is still streaming (step 3+). */
  streaming?: boolean;
}

export type ThinChatPhase = "home" | "session";

export function createMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
