import { Typography } from "@work4you/ui/ui/components/typography/index";

import { useI18n } from "@/i18n";
import type { ConnectionState, GatewayClient } from "@/lib/gatewayClient";
import { cn } from "@/lib/utils";

import type { ThinChatActivity } from "./chat-activity-strip";
import type { ComposerAttachHandlers } from "./composer";
import { ComposerDock } from "./composer-dock";
import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";

const DEFAULT_SUGGESTIONS = [
  "What can you help me with?",
  "Summarize what we talked about last time",
  "What skills are available?",
  "Check if the gateway is healthy",
];

export interface EmptyHomeProps {
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
  onReasoningChange?: (effort: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  attach?: ComposerAttachHandlers | null;
  workspaceCwd?: string | null;
  onWorkspaceClick?: () => void;
}

/**
 * First-paint chat surface: brand + centered composer dock with session chrome.
 */
export function EmptyHome({
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
  onReasoningChange,
  autoFocus = true,
  disabled = false,
  attach = null,
  workspaceCwd = null,
  onWorkspaceClick,
}: EmptyHomeProps) {
  const { t } = useI18n();
  const subtitle =
    t.thinChat?.emptySubtitle ??
    "Ask anything. Your agent runs on this machine.";
  const suggestions = t.thinChat?.suggestions ?? DEFAULT_SUGGESTIONS;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-16 pt-8">
      <div className="flex w-full max-w-3xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Typography
            mondwest
            className="text-display text-[1.75rem] leading-none tracking-[0.04em] text-foreground sm:text-[2rem]"
          >
            Work4You
          </Typography>
          <p className="max-w-md text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <ComposerDock
          variant="hero"
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
          onReasoningChange={onReasoningChange}
          autoFocus={autoFocus}
          disabled={disabled}
          busy={disabled}
          attach={attach}
          workspaceCwd={workspaceCwd}
          onWorkspaceClick={onWorkspaceClick}
          className="w-full shadow-md"
        />

        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          {suggestions.map((label) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => onDraftChange(label)}
              className={cn(
                "rounded-full border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground",
                "transition-colors hover:border-border hover:bg-muted/35 hover:text-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
