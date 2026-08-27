/** Minimal types shared with desktop ``lib/chat-messages`` (hydration + tool parts). */

export interface MessageReaction {
  emoji: string;
  author: "agent" | "user";
  at: number;
}

export interface SessionMessage {
  args?: unknown;
  content: unknown;
  context?: unknown;
  name?: string;
  reasoning?: string | null;
  reasoning_content?: string | null;
  reasoning_details?: unknown;
  display_kind?: string;
  display_metadata?: string | Record<string, unknown>;
  role: "assistant" | "system" | "tool" | "user";
  row_id?: number;
  id?: number;
  text?: unknown;
  timestamp?: number;
  tool_call_id?: string | null;
  tool_calls?: unknown;
  tool_name?: string;
}

export interface SessionInfo {
  id: string;
  title?: string | null;
  preview?: string | null;
  stored_session_id?: string | null;
}

export interface UsageStats {
  calls?: number;
  input?: number;
  output?: number;
  total?: number;
}
