import type { ConnectionState } from "@/lib/gatewayClient";
import { Cloud, FolderOpen, GitBranch } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ContextBreakdown } from "./context-breakdown";
import { mergeGaugeUsage } from "./context-breakdown";
import { ContextUsageChip } from "./context-usage-chip";
import { composerFloatingPill, composerFloatingStrip } from "./composer-dock-styles";
import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";
import { hasOpenWorkspace, workspaceLabel } from "./workspace";

export interface ComposerUndersideProps {
  connectionState: ConnectionState;
  reconnecting?: boolean;
  info: ThinChatSessionInfo;
  usage: ThinChatSessionUsage | null;
  breakdown?: ContextBreakdown | null;
  breakdownLoading?: boolean;
  busy?: boolean;
  /** User-chosen workspace (null = detached / no project). */
  workspaceCwd?: string | null;
  onWorkspaceClick?: () => void;
  className?: string;
}

function connectionLabel(
  state: ConnectionState,
  reconnecting: boolean,
): string {
  if (reconnecting) return "Reconnecting";
  if (state === "connecting") return "Connecting";
  if (state === "open") return "Cloud";
  if (state === "error") return "Error";
  if (state === "closed") return "Offline";
  return "Cloud";
}

function connectionTone(
  state: ConnectionState,
  reconnecting: boolean,
): string {
  if (reconnecting || state === "connecting") return "text-amber-500";
  if (state === "open") return "text-emerald-500";
  if (state === "error") return "text-destructive";
  return "text-muted-foreground";
}

/**
 * Chrome-free strip below the composer: workspace · branch · connection · meter.
 */
export function ComposerUnderside({
  connectionState,
  reconnecting = false,
  info,
  usage,
  breakdown = null,
  breakdownLoading = false,
  busy = false,
  workspaceCwd = null,
  onWorkspaceClick,
  className,
}: ComposerUndersideProps) {
  const branch = info.branch?.trim();
  const connLabel = connectionLabel(connectionState, reconnecting);
  const gauge = mergeGaugeUsage(usage, breakdown);
  const open = hasOpenWorkspace(workspaceCwd);
  const label = workspaceLabel(workspaceCwd);

  return (
    <div
      className={cn(composerFloatingStrip, "pt-1.5", className)}
      role="status"
      aria-label="Composer context"
    >
      <button
        type="button"
        className={cn(
          composerFloatingPill,
          "max-w-[14rem]",
          onWorkspaceClick
            ? "cursor-pointer hover:bg-muted/40"
            : "cursor-default",
          !open && "text-muted-foreground",
        )}
        title={open ? workspaceCwd || label : "Open project on the agent"}
        onClick={onWorkspaceClick}
        disabled={!onWorkspaceClick}
      >
        <FolderOpen className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        <span className="truncate font-mono text-[0.6875rem]">{label}</span>
      </button>

      {branch ? (
        <span
          className={cn(composerFloatingPill, "max-w-[14rem] cursor-default")}
          title={branch}
        >
          <GitBranch className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          <span className="truncate font-mono text-[0.6875rem]">{branch}</span>
        </span>
      ) : null}

      <span
        className={cn(composerFloatingPill, "cursor-default")}
        title={`Gateway ${connLabel}`}
      >
        <Cloud
          className={cn("h-3 w-3 shrink-0", connectionTone(connectionState, reconnecting))}
          aria-hidden
        />
        <span className="text-[0.6875rem]">{connLabel}</span>
      </span>

      <ContextUsageChip
        breakdown={breakdown}
        loading={breakdownLoading}
        contextMax={gauge.contextMax}
        contextUsed={gauge.contextUsed}
        contextPercent={gauge.contextPercent}
        total={gauge.total}
        busy={busy}
      />
    </div>
  );
}
