import type { ConnectionState, GatewayClient } from "@/lib/gatewayClient";

import { PromptHost, type ThinChatPromptState } from "./approvals";
import type { ThinChatActivity } from "./chat-activity-strip";
import type { ComposerAttachHandlers } from "./composer";
import { ComposerDock } from "./composer-dock";
import { MessageList } from "./message-list";
import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";
import type { ChatMessage } from "./types";

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
}

/**
 * Active conversation: scrollable transcript + docked composer chrome.
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
}: SessionViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList
        messages={messages}
        busy={busy && !blockingPrompt}
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
          />
        </div>
      </div>
    </div>
  );
}
