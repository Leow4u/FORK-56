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

/** One graph node in the star map (learned skill or memory chunk). */
export interface StarmapNode {
  id: string;
  label: string;
  kind: "memory" | "skill";
  memorySource?: "memory" | "profile";
  timestamp?: null | number;
  category: string;
  useCount: number;
  state: string;
  createdBy: null | string;
  pinned: boolean;
}

/** A declared `related_skills` link; both endpoints are guaranteed to be nodes. */
export interface StarmapEdge {
  source: string;
  target: string;
}

export interface StarmapCluster {
  category: string;
  count: number;
}

/** Freeform memory rendered as a card — never a graph node. */
export interface StarmapMemoryCard {
  source: "memory" | "profile";
  timestamp?: null | number;
  title: string;
  body: string;
}

export interface StarmapGraph {
  nodes: StarmapNode[];
  edges: StarmapEdge[];
  clusters: StarmapCluster[];
  memory: StarmapMemoryCard[];
  stats: Record<string, unknown>;
}

export interface LearningNodeDetail {
  content: string;
  kind: "memory" | "skill";
  label: string;
  ok: boolean;
}
