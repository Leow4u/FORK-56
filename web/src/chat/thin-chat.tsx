import { useCallback, useEffect, useState, type MutableRefObject } from "react";

import { EmptyHome } from "./empty-home";
import { SessionView } from "./session-view";
import type { ThinChatPhase } from "./types";
import { useThinChatGateway } from "./use-thin-chat-gateway";

export interface ThinChatProps {
  /** When false, skip autofocus (persistent host hidden on other routes). */
  isActive?: boolean;
  profile?: string;
  /** Stored session id from `/chat?resume=<id>`. */
  resumeSessionId?: string | null;
  /** Seed composer from `/chat?learn=…` (Skills page). */
  initialDraft?: string;
  onPhaseChange?: (phase: ThinChatPhase) => void;
  /** Fired when the local transcript is cleared (New chat). */
  onReset?: () => void;
  /** Persist the durable session id into the URL for Sessions resume. */
  onStoredSessionId?: (storedId: string | null) => void;
  onTitle?: (title: string | null) => void;
  /** Parent can call `resetRef.current?.()` for the header New chat action. */
  resetRef?: MutableRefObject<(() => void) | null>;
}

/**
 * Thin chat: EmptyHome → SessionView, driven by ``GatewayClient`` → ``/api/ws``.
 */
export function ThinChat({
  isActive = true,
  profile,
  resumeSessionId = null,
  initialDraft = "",
  onPhaseChange,
  onReset,
  onStoredSessionId,
  onTitle,
  resetRef,
}: ThinChatProps) {
  const [draft, setDraft] = useState(initialDraft);

  const {
    phase,
    messages,
    connectionState,
    busy,
    error,
    reconnecting,
    credentialWarning,
    ready,
    gateway,
    liveSessionId,
    sessionInfo,
    sessionUsage,
    activity,
    resumeProgress,
    canLoadEarlier,
    showLoadEarlier,
    loadingEarlier,
    submit,
    enqueueDraft,
    interrupt,
    reset,
    loadEarlier,
    setReasoningEffort,
    clearError,
  } = useThinChatGateway({
    profile,
    resumeSessionId,
    enabled: true,
    onStoredSessionId,
    onTitle,
    onPhaseChange,
  });

  useEffect(() => {
    if (!initialDraft) return;
    queueMicrotask(() => setDraft(initialDraft));
  }, [initialDraft]);

  const handleSubmit = useCallback(
    (text: string) => {
      setDraft("");
      void submit(text);
    },
    [submit],
  );

  const handleQueue = useCallback(
    (text: string) => {
      setDraft("");
      enqueueDraft(text);
    },
    [enqueueDraft],
  );

  const handleReset = useCallback(() => {
    setDraft("");
    onReset?.();
    void reset();
  }, [onReset, reset]);

  useEffect(() => {
    if (!resetRef) return;
    resetRef.current = handleReset;
    return () => {
      resetRef.current = null;
    };
  }, [handleReset, resetRef]);

  const statusLabel =
    connectionState === "connecting"
      ? "Connecting…"
      : connectionState === "error"
        ? "Connection error"
        : !ready && !error
          ? "Starting…"
          : null;

  const showCredentialWarning = Boolean(credentialWarning) && !error;

  const resumeBanner =
    resumeProgress?.status === "loading"
      ? resumeProgress.messageCount != null
        ? `Loading session history (${resumeProgress.messageCount} messages)…`
        : "Loading session history…"
      : resumeProgress?.status === "failed"
        ? resumeProgress.message ?? "Resume failed"
        : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {showCredentialWarning && (
        <div
          className="border-b border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
          role="status"
        >
          <div className="mx-auto max-w-3xl">{credentialWarning}</div>
        </div>
      )}

      {(error || statusLabel) && (
        <div
          className={
            error
              ? "border-b border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
              : "border-b border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
          }
          role={error ? "alert" : "status"}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
            <span>{error ?? statusLabel}</span>
            {error && (
              <button
                type="button"
                className="shrink-0 underline-offset-2 hover:underline"
                onClick={clearError}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "home" ? (
        <EmptyHome
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
          gateway={gateway}
          sessionId={liveSessionId}
          connectionState={connectionState}
          reconnecting={reconnecting}
          sessionInfo={sessionInfo}
          sessionUsage={sessionUsage}
          activity={activity}
          onReasoningChange={(effort) => void setReasoningEffort(effort)}
          autoFocus={isActive}
          disabled={busy || connectionState === "connecting"}
        />
      ) : (
        <SessionView
          messages={messages}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
          gateway={gateway}
          sessionId={liveSessionId}
          connectionState={connectionState}
          reconnecting={reconnecting}
          sessionInfo={sessionInfo}
          sessionUsage={sessionUsage}
          activity={activity}
          resumeLabel={resumeBanner}
          onReasoningChange={(effort) => void setReasoningEffort(effort)}
          onQueue={handleQueue}
          onStop={() => void interrupt()}
          busy={busy}
          canLoadEarlier={canLoadEarlier}
          showLoadEarlier={showLoadEarlier}
          loadingEarlier={loadingEarlier}
          onLoadEarlier={() => void loadEarlier()}
          autoFocus={isActive}
        />
      )}
    </div>
  );
}
