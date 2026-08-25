import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";

export interface SessionStatusBarProps {
  info: ThinChatSessionInfo;
  usage: ThinChatSessionUsage | null;
  reconnecting?: boolean;
  className?: string;
}

function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-[12rem] items-center truncate rounded-full border border-border/50 bg-muted/25 px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
    >
      {children}
    </span>
  );
}

/**
 * Compact session metadata from gateway ``session.info`` / ``session.usage``.
 */
export function SessionStatusBar({
  info,
  usage,
  reconnecting = false,
  className,
}: SessionStatusBarProps) {
  const model =
    info.model && info.provider
      ? `${info.provider}/${info.model}`
      : info.model || info.provider;

  const hasUsage =
    usage &&
    (usage.total != null || usage.input != null || usage.output != null);

  if (!model && !info.branch && !info.cwd && !info.fast && !info.yolo && !hasUsage && !reconnecting) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b border-border/40 bg-muted/15 px-3 py-1.5 text-xs",
        className,
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5">
        {reconnecting && <Chip title="Reconnecting">Reconnecting…</Chip>}
        {model && <Chip title="Model">{model}</Chip>}
        {info.branch && <Chip title="Branch">{info.branch}</Chip>}
        {info.cwd && (
          <Chip title="Working directory">
            {info.cwd.split("/").pop() || info.cwd}
          </Chip>
        )}
        {info.fast && <Chip>Fast</Chip>}
        {info.yolo && <Chip>YOLO</Chip>}
        {info.reasoningEffort && (
          <Chip title="Reasoning effort">{info.reasoningEffort}</Chip>
        )}
        {hasUsage && usage && (
          <Chip title="Session token usage">
            {usage.total != null
              ? `${usage.total.toLocaleString()} tok`
              : `${(usage.input ?? 0).toLocaleString()} in / ${(usage.output ?? 0).toLocaleString()} out`}
          </Chip>
        )}
      </div>
    </div>
  );
}
