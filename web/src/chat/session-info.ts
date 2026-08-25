/** Fields mirrored from desktop ``sessionInfoStatePatch`` (gateway ``session.info``). */
export interface ThinChatSessionInfo {
  model?: string;
  provider?: string;
  cwd?: string;
  branch?: string;
  reasoningEffort?: string;
  fast?: boolean;
  yolo?: boolean;
  running?: boolean;
  messageCount?: number;
}

export function sessionInfoFromPayload(
  payload: unknown,
): ThinChatSessionInfo {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const out: ThinChatSessionInfo = {};
  if (typeof p.model === "string") out.model = p.model;
  if (typeof p.provider === "string") out.provider = p.provider;
  if (typeof p.cwd === "string") out.cwd = p.cwd;
  if (typeof p.branch === "string") out.branch = p.branch;
  if (typeof p.reasoning_effort === "string") {
    out.reasoningEffort = p.reasoning_effort;
  }
  if (typeof p.fast === "boolean") out.fast = p.fast;
  if (typeof p.yolo === "boolean") out.yolo = p.yolo;
  if (typeof p.running === "boolean") out.running = p.running;
  if (typeof p.message_count === "number") out.messageCount = p.message_count;
  return out;
}

export function mergeSessionInfo(
  prev: ThinChatSessionInfo,
  patch: ThinChatSessionInfo,
): ThinChatSessionInfo {
  return { ...prev, ...patch };
}

export interface ThinChatSessionUsage {
  calls?: number;
  input?: number;
  output?: number;
  total?: number;
}

export function sessionUsageFromPayload(
  payload: unknown,
): ThinChatSessionUsage | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  const p =
    raw.usage && typeof raw.usage === "object"
      ? (raw.usage as Record<string, unknown>)
      : raw;
  return {
    calls: typeof p.calls === "number" ? p.calls : undefined,
    input: typeof p.input === "number" ? p.input : undefined,
    output: typeof p.output === "number" ? p.output : undefined,
    total: typeof p.total === "number" ? p.total : undefined,
  };
}
