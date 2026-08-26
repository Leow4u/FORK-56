import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";

import { EmptyHome } from "./empty-home";
import { SessionView } from "./session-view";
import type { ThinChatPhase } from "./types";
import { useComposerAttachments } from "./use-composer-attachments";
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
  const [attachError, setAttachError] = useState<string | null>(null);

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

  const insertSnippet = useCallback((text: string) => {
    setDraft((prev) => {
      if (!prev.trim()) return text;
      return `${prev.trimEnd()}\n\n${text}`;
    });
  }, []);

  const attachmentsApi = useComposerAttachments({
    gateway,
    sessionId: liveSessionId,
    onError: setAttachError,
    onInsertText: insertSnippet,
  });

  useEffect(() => {
    if (!initialDraft) return;
    queueMicrotask(() => setDraft(initialDraft));
  }, [initialDraft]);

  const handleSubmit = useCallback(
    (text: string) => {
      const chips = attachmentsApi.attachments;
      setDraft("");
      attachmentsApi.clearAttachments();
      setAttachError(null);
      void submit(text, chips);
    },
    [attachmentsApi, submit],
  );

  const handleQueue = useCallback(
    (text: string) => {
      const chips = attachmentsApi.attachments;
      setDraft("");
      attachmentsApi.clearAttachments();
      setAttachError(null);
      enqueueDraft(text, chips);
    },
    [attachmentsApi, enqueueDraft],
  );

  const handleReset = useCallback(() => {
    setDraft("");
    attachmentsApi.clearAttachments();
    setAttachError(null);
    onReset?.();
    void reset();
  }, [attachmentsApi, onReset, reset]);

  useEffect(() => {
    if (!resetRef) return;
    resetRef.current = handleReset;
    return () => {
      resetRef.current = null;
    };
  }, [handleReset, resetRef]);

  const attachHandlers = useMemo(
    () => ({
      attachments: attachmentsApi.attachments,
      onRemoveAttachment: (id: string) => {
        void attachmentsApi.removeAttachment(id);
      },
      onPickFiles: (files: FileList | File[]) => {
        setAttachError(null);
        void attachmentsApi.attachFiles(files);
      },
      onPickImages: (files: FileList | File[]) => {
        setAttachError(null);
        void attachmentsApi.attachImages(files);
      },
      onPasteClipboardImage: () => {
        setAttachError(null);
        void attachmentsApi.pasteClipboardImage();
      },
      onAddUrl: (url: string) => {
        setAttachError(null);
        attachmentsApi.addUrl(url);
      },
      onInsertSnippet: (text: string) => {
        attachmentsApi.insertSnippet(text);
      },
      onDropFiles: (files: File[]) => {
        setAttachError(null);
        void attachmentsApi.attachFiles(files);
      },
    }),
    [attachmentsApi],
  );

  const statusLabel =
    connectionState === "connecting"
      ? "Connecting…"
      : connectionState === "error"
        ? "Connection error"
        : !ready && !error
          ? "Starting…"
          : null;

  const showCredentialWarning = Boolean(credentialWarning) && !error;
  const bannerError = error || attachError;

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

      {(bannerError || statusLabel) && (
        <div
          className={
            bannerError
              ? "border-b border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
              : "border-b border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
          }
          role={bannerError ? "alert" : "status"}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
            <span>{bannerError ?? statusLabel}</span>
            {bannerError && (
              <button
                type="button"
                className="shrink-0 underline-offset-2 hover:underline"
                onClick={() => {
                  clearError();
                  setAttachError(null);
                }}
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
          attach={attachHandlers}
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
          loadingEarlier={loadingEarlier}
          onLoadEarlier={() => void loadEarlier()}
          autoFocus={isActive}
          attach={attachHandlers}
        />
      )}
    </div>
  );
}
