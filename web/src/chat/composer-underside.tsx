import type { ConnectionState } from "@/lib/gatewayClient";
import { Cloud, GitBranch, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { composerFloatingPill, composerFloatingStrip } from "./composer-dock-styles";
import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";

export interface ComposerUndersideProps {
  connectionState: ConnectionState;
  reconnecting?: boolean;
  info: ThinChatSessionInfo;
  usage: ThinChatSessionUsage | null;
  busy?: boolean;
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

function contextSummary(usage: ThinChatSessionUsage | null): string {
  if (!usage) return "—";
  if (usage.total != null) return `${usage.total.toLocaleString()} tok`;
  if (usage.input != null || usage.output != null) {
    return `${(usage.input ?? 0).toLocaleString()} in`;
  }
  return "—";
}

/**
 * Chrome-free strip below the composer: branch · connection · context meter.
 */
export function ComposerUnderside({
  connectionState,
  reconnecting = false,
  info,
  usage,
  busy = false,
  className,
}: ComposerUndersideProps) {
  const branch = info.branch?.trim();
  const connLabel = connectionLabel(connectionState, reconnecting);
  const contextLabel = contextSummary(usage);

  return (
    <div
      className={cn(composerFloatingStrip, "pt-1.5", className)}
      role="status"
      aria-label="Composer context"
    >
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

      <span
        className={cn(
          composerFloatingPill,
          "ml-auto cursor-default tabular-nums",
        )}
        title="Session context usage"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-70" aria-hidden />
        ) : null}
        <span className="text-[0.6875rem]">{contextLabel}</span>
      </span>
    </div>
  );
}
