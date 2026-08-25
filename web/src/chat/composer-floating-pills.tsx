import { cn } from "@/lib/utils";

import type { ThinChatActivity } from "./chat-activity-strip";
import { composerFloatingPill, composerFloatingStrip } from "./composer-dock-styles";
import type { ThinChatSessionInfo } from "./session-info";

export interface ComposerFloatingPillsProps {
  activity: ThinChatActivity;
  busy?: boolean;
  info: ThinChatSessionInfo;
  resumeLabel?: string | null;
  className?: string;
}

/**
 * Contextual pills above the composer — shown only when there is data.
 */
export function ComposerFloatingPills({
  activity,
  busy = false,
  info,
  resumeLabel,
  className,
}: ComposerFloatingPillsProps) {
  const pills: { key: string; label: string; title?: string }[] = [];

  if (resumeLabel) {
    pills.push({ key: "resume", label: resumeLabel, title: resumeLabel });
  }

  if (activity.toolLine) {
    pills.push({
      key: "tool",
      label: activity.toolLine,
      title: activity.toolLine,
    });
  }

  if (activity.backgroundLine) {
    pills.push({
      key: "background",
      label: activity.backgroundLine,
      title: activity.backgroundLine,
    });
  }

  if (activity.queueCount > 0) {
    const label = `${activity.queueCount} queued`;
    pills.push({ key: "queue", label, title: label });
  }

  if (info.fast) {
    pills.push({ key: "fast", label: "Fast", title: "Fast mode" });
  }

  if (info.yolo) {
    pills.push({ key: "yolo", label: "YOLO", title: "YOLO mode" });
  }

  if (busy && pills.length === 0) {
    pills.push({ key: "working", label: "Working…", title: "Agent is running" });
  }

  if (pills.length === 0) return null;

  return (
    <div className={cn(composerFloatingStrip, "pb-1.5", className)}>
      {pills.map((pill) => (
        <span
          key={pill.key}
          className={cn(composerFloatingPill, "max-w-[16rem] cursor-default")}
          title={pill.title}
        >
          <span className="truncate text-[0.6875rem]">{pill.label}</span>
        </span>
      ))}
    </div>
  );
}
