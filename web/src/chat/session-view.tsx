// @ts-nocheck — desktop parity port; web shims pending.
import { atom } from "nanostores";
import { useEffect, useMemo, type ReactNode } from "react";

import type { ChatMessage } from "@/lib/chat-messages";
import type { GatewayClient } from "@/lib/gatewayClient";

import { SessionViewProvider } from "@/app/chat/session-view";
import { PromptHost, type ThinChatPromptState } from "./approvals";
import type { ThinChatActivity } from "./chat-activity-strip";
import type { ComposerAttachHandlers } from "./composer";
import { ChatRuntimeBoundary } from "./chat-runtime-boundary";
import { ComposerDock } from "./composer-dock";
import type { QueuedPromptEntry } from "./composer-queue";
import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";
import type { ConnectionState } from "@/lib/gatewayClient";

export interface SessionViewProps {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (text: string) => void;
  gateway: GatewayClient | null;
  sessionId?: string | null;
  connectionState: ConnectionState;
  reconnecting?: boolean;
  sessionInfo: ThinChatSessionInfo;
  sessionUsage: ThinChatSessionUsage | null;
  activity: ThinChatActivity;
  resumeLabel?: string | null;
  onReasoningChange?: (effort: string) => void;
  onQueue?: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;
  canLoadEarlier?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
  autoFocus?: boolean;
  attach?: ComposerAttachHandlers | null;
  workspaceCwd?: string | null;
  onWorkspaceClick?: () => void;
  prompts?: ThinChatPromptState;
  onPromptsChange?: (
    updater: (prev: ThinChatPromptState) => ThinChatPromptState,
  ) => void;
  blockingPrompt?: boolean;
  queueEntries?: QueuedPromptEntry[];
  queueParked?: boolean;
  onQueueEdit?: (entry: QueuedPromptEntry) => void;
  onQueueDelete?: (id: string) => void;
  onQueueSendNow?: (id: string) => void;
  onQueueSteerNow?: (id: string) => void;
  onQueueResume?: () => void;
}

function TranscriptSessionProvider({
  sessionId,
  messages,
  busy,
  cwd,
  children,
}: {
  sessionId: string | null;
  messages: ChatMessage[];
  busy: boolean;
  cwd: string | null;
  children: ReactNode;
}) {
  const view = useMemo(
    () => ({
      $runtimeId: atom<string | null>(sessionId),
      $storedId: atom<string | null>(sessionId),
      $messages: atom<ChatMessage[]>(messages),
      $busy: atom(busy),
      $cwd: atom(cwd),
      $turnStartedAt: atom<number | null>(busy ? Date.now() : null),
    }),
    [],
  );

  useEffect(() => {
    view.$runtimeId.set(sessionId);
    view.$storedId.set(sessionId);
  }, [sessionId, view]);

  useEffect(() => {
    view.$messages.set(messages);
  }, [messages, view]);

  useEffect(() => {
    view.$busy.set(busy);
    view.$turnStartedAt.set(busy ? Date.now() : null);
  }, [busy, view]);

  useEffect(() => {
    view.$cwd.set(cwd);
  }, [cwd, view]);

  return <SessionViewProvider view={view}>{children}</SessionViewProvider>;
}

/**
 * Active conversation: assistant-ui Thread transcript + docked composer chrome.
 */
export function SessionView({
  messages,
  draft,
  onDraftChange,
  onSubmit,
  gateway,
  sessionId = null,
  connectionState,
  reconnecting = false,
  sessionInfo,
  sessionUsage,
  activity,
  resumeLabel,
  onReasoningChange,
  onQueue,
  onStop,
  busy = false,
  canLoadEarlier = false,
  loadingEarlier = false,
  onLoadEarlier,
  autoFocus = true,
  attach = null,
  workspaceCwd = null,
  onWorkspaceClick,
  prompts,
  onPromptsChange,
  blockingPrompt = false,
  queueEntries = [],
  queueParked = false,
  onQueueEdit,
  onQueueDelete,
  onQueueSendNow,
  onQueueSteerNow,
  onQueueResume,
}: SessionViewProps) {
  return (
    <TranscriptSessionProvider
      sessionId={sessionId}
      messages={messages}
      busy={busy && !blockingPrompt}
      cwd={workspaceCwd ?? ""}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatRuntimeBoundary
          messages={messages}
          busy={busy && !blockingPrompt}
          gateway={gateway}
          sessionId={sessionId}
          cwd={workspaceCwd}
          canLoadEarlier={canLoadEarlier}
          loadingEarlier={loadingEarlier}
          onLoadEarlier={onLoadEarlier}
        />
        <div className="relative shrink-0 border-t border-border/60 bg-gradient-to-t from-background via-background/95 to-background/80 px-4 py-3 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-background/80 to-transparent" />
          {prompts && onPromptsChange && (
            <PromptHost
              gateway={gateway}
              sessionId={sessionId}
              prompts={prompts}
              onPromptsChange={onPromptsChange}
            />
          )}
          <div className="mx-auto w-full max-w-3xl">
            <ComposerDock
              variant="dock"
              value={draft}
              onChange={onDraftChange}
              onSubmit={onSubmit}
              gateway={gateway}
              sessionId={sessionId}
              connectionState={connectionState}
              reconnecting={reconnecting}
              sessionInfo={sessionInfo}
              sessionUsage={sessionUsage}
              activity={activity}
              resumeLabel={resumeLabel}
              onReasoningChange={onReasoningChange}
              onQueue={onQueue}
              onStop={onStop}
              busy={busy}
              autoFocus={autoFocus}
              attach={attach}
              workspaceCwd={workspaceCwd}
              onWorkspaceClick={onWorkspaceClick}
              blockingPrompt={blockingPrompt}
              queueEntries={queueEntries}
              queueParked={queueParked}
              onQueueEdit={onQueueEdit}
              onQueueDelete={onQueueDelete}
              onQueueSendNow={onQueueSendNow}
              onQueueSteerNow={onQueueSteerNow}
              onQueueResume={onQueueResume}
            />
          </div>
        </div>
      </div>
    </TranscriptSessionProvider>
  );
}
