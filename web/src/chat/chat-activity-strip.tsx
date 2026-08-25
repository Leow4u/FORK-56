import { cn } from "@/lib/utils";

export interface ThinChatActivity {
  toolLine: string | null;
  backgroundLine: string | null;
  queueCount: number;
}

export interface ChatActivityStripProps {
  busy: boolean;
  activity: ThinChatActivity;
  resumeLabel?: string | null;
  className?: string;
}

/**
 * Persistent activity row above the composer (tool / background / queue).
 */
export function ChatActivityStrip({
  busy,
  activity,
  resumeLabel,
  className,
}: ChatActivityStripProps) {
  const detail =
    resumeLabel ||
    activity.toolLine ||
    activity.backgroundLine ||
    (activity.queueCount > 0
      ? `${activity.queueCount} message${activity.queueCount === 1 ? "" : "s"} queued`
      : busy
        ? "Waiting for the model…"
        : "Ready");

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border/30 px-2 py-1.5 text-[0.6875rem] text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 font-medium",
          busy ? "text-primary" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            busy ? "animate-pulse bg-primary" : "bg-emerald-500/80",
          )}
          aria-hidden
        />
        {busy ? "Working" : "Idle"}
      </span>
      <span className="min-w-0 flex-1 truncate" title={detail}>
        {detail}
      </span>
      {activity.queueCount > 0 && activity.toolLine && (
        <span className="shrink-0 tabular-nums">
          +{activity.queueCount} queued
        </span>
      )}
    </div>
  );
}
