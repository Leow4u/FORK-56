/** Thin-chat approval / clarify / sudo / secret prompt types (gateway wire). */

export type ApprovalChoice = "once" | "session" | "always" | "deny";

export interface ApprovalRequest {
  requestId: string;
  sessionId: string | null;
  command: string;
  description: string;
  allowPermanent?: boolean;
  smartDenied?: boolean;
  choices?: ApprovalChoice[];
}

export interface ClarifyQuestion {
  qid: string;
  question: string;
  choices: string[] | null;
  multiSelect: boolean;
}

export interface ClarifyRequest {
  requestId: string;
  sessionId: string | null;
  question: string;
  choices: string[] | null;
  multiSelect: boolean;
  questions: ClarifyQuestion[];
  lockedAnswers?: Record<string, string>;
}

export interface SudoRequest {
  requestId: string;
  sessionId: string | null;
}

export interface SecretRequest {
  requestId: string;
  sessionId: string | null;
  envVar: string;
  prompt: string;
}

export interface ThinChatPromptState {
  approval: ApprovalRequest | null;
  clarify: ClarifyRequest | null;
  sudo: SudoRequest | null;
  secret: SecretRequest | null;
}

export const EMPTY_PROMPT_STATE: ThinChatPromptState = {
  approval: null,
  clarify: null,
  sudo: null,
  secret: null,
};

export function hasBlockingPrompt(state: ThinChatPromptState): boolean {
  return Boolean(state.approval || state.sudo || state.secret);
}

export function hasClarifyPrompt(state: ThinChatPromptState): boolean {
  return Boolean(state.clarify);
}

export function isAwaitingInput(state: ThinChatPromptState): boolean {
  return Boolean(
    state.approval || state.clarify || state.sudo || state.secret,
  );
}

const APPROVAL_OPTS: ApprovalChoice[] = ["once", "session", "always", "deny"];

export function approvalOptions(req: ApprovalRequest): ApprovalChoice[] {
  if (req.choices?.length) {
    return req.choices.filter((c): c is ApprovalChoice =>
      APPROVAL_OPTS.includes(c),
    );
  }
  if (req.smartDenied) return ["once", "deny"];
  if (req.allowPermanent === false) return ["once", "session", "deny"];
  return [...APPROVAL_OPTS];
}

export const APPROVAL_LABELS: Record<ApprovalChoice, string> = {
  once: "Allow once",
  session: "Allow this session",
  always: "Always allow",
  deny: "Deny",
};
