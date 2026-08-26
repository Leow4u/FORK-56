import type { GatewayClient } from "@/lib/gatewayClient";

import { ApprovalBar } from "./ApprovalBar";
import { ClarifyCard } from "./ClarifyCard";
import {
  ackApprovalReceived,
  fetchPendingApproval,
  respondApproval,
  respondClarify,
  respondSecret,
  respondSudo,
} from "./respond";
import { SecretDialog, SudoDialog } from "./SudoSecretDialog";
import type {
  ApprovalChoice,
  ThinChatPromptState,
} from "./types";
import { parseApprovalPayload } from "./prompt-state";

export interface PromptHostProps {
  gateway: GatewayClient | null;
  sessionId: string | null;
  prompts: ThinChatPromptState;
  onPromptsChange: (
    updater: (prev: ThinChatPromptState) => ThinChatPromptState,
  ) => void;
}

/**
 * Surfaces mid-turn blocking prompts (approval / clarify / sudo / secret).
 */
export function PromptHost({
  gateway,
  sessionId,
  prompts,
  onPromptsChange,
}: PromptHostProps) {
  const clearKey = (
    key: keyof ThinChatPromptState,
    requestId?: string,
  ) => {
    onPromptsChange((prev) => {
      const current = prev[key];
      if (
        requestId &&
        current &&
        "requestId" in current &&
        current.requestId !== requestId
      ) {
        return prev;
      }
      return { ...prev, [key]: null };
    });
  };

  const chooseApproval = async (choice: ApprovalChoice) => {
    if (!gateway || !prompts.approval) return;
    const req = prompts.approval;
    clearKey("approval", req.requestId);
    try {
      await respondApproval(gateway, {
        choice,
        requestId: req.requestId,
        sessionId: req.sessionId ?? sessionId,
      });
      // FIFO: pull next pending approval if any.
      try {
        const next = await fetchPendingApproval(
          gateway,
          req.sessionId ?? sessionId,
        );
        if (next) {
          const parsed = parseApprovalPayload(
            next,
            req.sessionId ?? sessionId,
          );
          if (parsed) {
            onPromptsChange((prev) => ({ ...prev, approval: parsed }));
            if (parsed.requestId) {
              void ackApprovalReceived(gateway, {
                requestId: parsed.requestId,
                sessionId: parsed.sessionId,
              }).catch(() => undefined);
            }
          }
        }
      } catch {
        // ignore pending fetch errors
      }
    } catch {
      // restore on failure so the user can retry
      onPromptsChange((prev) =>
        prev.approval ? prev : { ...prev, approval: req },
      );
    }
  };

  const answerClarify = async (answer: string, questionId?: string) => {
    if (!gateway || !prompts.clarify) return;
    const req = prompts.clarify;
    const batch = req.questions.length > 0;
    try {
      const result = await respondClarify(gateway, {
        requestId: req.requestId,
        answer,
        questionId,
      });
      if (!batch || !questionId || !answer.trim()) {
        clearKey("clarify", req.requestId);
        return;
      }
      // Lock this question; clear when none remain.
      onPromptsChange((prev) => {
        if (!prev.clarify || prev.clarify.requestId !== req.requestId) {
          return prev;
        }
        const locked = {
          ...(prev.clarify.lockedAnswers ?? {}),
          [questionId]: answer,
        };
        const remaining = prev.clarify.questions.filter((q) => !locked[q.qid]);
        if (remaining.length === 0 || result?.remaining === 0) {
          return { ...prev, clarify: null };
        }
        return {
          ...prev,
          clarify: { ...prev.clarify, lockedAnswers: locked },
        };
      });
    } catch {
      // leave card up
    }
  };

  const skipClarify = async () => {
    if (!gateway || !prompts.clarify) return;
    const req = prompts.clarify;
    clearKey("clarify", req.requestId);
    try {
      await respondClarify(gateway, {
        requestId: req.requestId,
        answer: "",
      });
    } catch {
      // timeout handles it
    }
  };

  const submitSudo = async (password: string) => {
    if (!gateway || !prompts.sudo) return;
    const req = prompts.sudo;
    clearKey("sudo", req.requestId);
    try {
      await respondSudo(gateway, {
        requestId: req.requestId,
        password,
      });
    } catch {
      if (password) {
        onPromptsChange((prev) =>
          prev.sudo ? prev : { ...prev, sudo: req },
        );
      }
    }
  };

  const submitSecret = async (value: string) => {
    if (!gateway || !prompts.secret) return;
    const req = prompts.secret;
    clearKey("secret", req.requestId);
    try {
      await respondSecret(gateway, {
        requestId: req.requestId,
        value,
      });
    } catch {
      if (value) {
        onPromptsChange((prev) =>
          prev.secret ? prev : { ...prev, secret: req },
        );
      }
    }
  };

  return (
    <>
      {(prompts.approval || prompts.clarify) && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-3 pb-2">
          {prompts.approval && (
            <ApprovalBar
              request={prompts.approval}
              onChoose={chooseApproval}
            />
          )}
          {prompts.clarify && (
            <ClarifyCard
              request={prompts.clarify}
              onAnswer={answerClarify}
              onSkip={skipClarify}
            />
          )}
        </div>
      )}
      {prompts.sudo && (
        <SudoDialog
          request={prompts.sudo}
          onSubmit={submitSudo}
          onCancel={() => void submitSudo("")}
        />
      )}
      {prompts.secret && (
        <SecretDialog
          request={prompts.secret}
          onSubmit={submitSecret}
          onCancel={() => void submitSecret("")}
        />
      )}
    </>
  );
}
