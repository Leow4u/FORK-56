import type {
  ApprovalChoice,
  ApprovalRequest,
  ClarifyQuestion,
  ClarifyRequest,
  SecretRequest,
  SudoRequest,
  ThinChatPromptState,
} from "./types";
import { EMPTY_PROMPT_STATE } from "./types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown): boolean {
  return value === true;
}

function normalizeChoices(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
}

function normalizeApprovalChoices(raw: unknown): ApprovalChoice[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const allowed = new Set(["once", "session", "always", "deny"]);
  const out = raw.filter(
    (c): c is ApprovalChoice => typeof c === "string" && allowed.has(c),
  );
  return out.length > 0 ? out : undefined;
}

function normalizeQuestions(raw: unknown): ClarifyQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ClarifyQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const question = asString(row.question).trim();
    if (!question) continue;
    const qid = asString(row.qid || row.question_id).trim() || `q${out.length}`;
    const choices = normalizeChoices(row.choices);
    out.push({
      qid,
      question,
      choices: choices.length > 0 ? choices : null,
      multiSelect: asBool(row.multi_select),
    });
  }
  return out;
}

export function parseApprovalPayload(
  payload: Record<string, unknown> | null | undefined,
  sessionId: string | null,
): ApprovalRequest | null {
  if (!payload) return null;
  const requestId = asString(payload.request_id).trim();
  const command = asString(payload.command);
  const description = asString(payload.description);
  if (!requestId && !command && !description) return null;
  return {
    requestId,
    sessionId,
    command,
    description,
    allowPermanent:
      payload.allow_permanent === undefined
        ? undefined
        : asBool(payload.allow_permanent),
    smartDenied: asBool(payload.smart_denied),
    choices: normalizeApprovalChoices(payload.choices),
  };
}

export function parseClarifyPayload(
  payload: Record<string, unknown> | null | undefined,
  sessionId: string | null,
): ClarifyRequest | null {
  if (!payload) return null;
  const requestId = asString(payload.request_id).trim();
  if (!requestId) return null;
  const questions = normalizeQuestions(payload.questions);
  const question = asString(payload.question).trim();
  const choices = normalizeChoices(payload.choices);
  const lockedRaw = payload.answers;
  const lockedAnswers =
    lockedRaw && typeof lockedRaw === "object"
      ? Object.fromEntries(
          Object.entries(lockedRaw as Record<string, unknown>).filter(
            (e): e is [string, string] => typeof e[1] === "string",
          ),
        )
      : undefined;

  if (questions.length > 0) {
    return {
      requestId,
      sessionId,
      question: "",
      choices: null,
      multiSelect: false,
      questions,
      lockedAnswers,
    };
  }
  if (!question) return null;
  return {
    requestId,
    sessionId,
    question,
    choices: choices.length > 0 ? choices : null,
    multiSelect: asBool(payload.multi_select),
    questions: [],
    lockedAnswers,
  };
}

export function parseSudoPayload(
  payload: Record<string, unknown> | null | undefined,
  sessionId: string | null,
): SudoRequest | null {
  const requestId = asString(payload?.request_id).trim();
  if (!requestId) return null;
  return { requestId, sessionId };
}

export function parseSecretPayload(
  payload: Record<string, unknown> | null | undefined,
  sessionId: string | null,
): SecretRequest | null {
  const requestId = asString(payload?.request_id).trim();
  if (!requestId) return null;
  return {
    requestId,
    sessionId,
    envVar: asString(payload?.env_var),
    prompt: asString(payload?.prompt) || "Enter secret",
  };
}

export type PromptEventResult =
  | { kind: "set"; state: Partial<ThinChatPromptState> }
  | { kind: "clear"; keys: (keyof ThinChatPromptState)[]; requestId?: string }
  | { kind: "noop" };

/**
 * Map a gateway event into a prompt-state patch.
 * Does not mutate — caller merges into React state.
 */
export function applyPromptEvent(
  type: string,
  payload: Record<string, unknown> | null | undefined,
  sessionId: string | null,
): PromptEventResult {
  switch (type) {
    case "approval.request": {
      const approval = parseApprovalPayload(payload, sessionId);
      return approval ? { kind: "set", state: { approval } } : { kind: "noop" };
    }
    case "clarify.request": {
      const clarify = parseClarifyPayload(payload, sessionId);
      return clarify ? { kind: "set", state: { clarify } } : { kind: "noop" };
    }
    case "sudo.request": {
      const sudo = parseSudoPayload(payload, sessionId);
      return sudo ? { kind: "set", state: { sudo } } : { kind: "noop" };
    }
    case "secret.request": {
      const secret = parseSecretPayload(payload, sessionId);
      return secret ? { kind: "set", state: { secret } } : { kind: "noop" };
    }
    case "clarify.expire":
      return {
        kind: "clear",
        keys: ["clarify"],
        requestId: asString(payload?.request_id) || undefined,
      };
    case "sudo.expire":
      return {
        kind: "clear",
        keys: ["sudo"],
        requestId: asString(payload?.request_id) || undefined,
      };
    case "secret.expire":
      return {
        kind: "clear",
        keys: ["secret"],
        requestId: asString(payload?.request_id) || undefined,
      };
    case "message.complete":
      return {
        kind: "clear",
        keys: ["approval", "clarify", "sudo", "secret"],
      };
    default:
      return { kind: "noop" };
  }
}

export function mergePromptEvent(
  current: ThinChatPromptState,
  result: PromptEventResult,
): ThinChatPromptState {
  if (result.kind === "noop") return current;
  if (result.kind === "set") {
    return { ...current, ...result.state };
  }
  const next = { ...current };
  for (const key of result.keys) {
    const existing = next[key];
    if (
      result.requestId &&
      existing &&
      "requestId" in existing &&
      existing.requestId !== result.requestId
    ) {
      continue;
    }
    next[key] = null;
  }
  return next;
}

export function clearAllPrompts(): ThinChatPromptState {
  return { ...EMPTY_PROMPT_STATE };
}
