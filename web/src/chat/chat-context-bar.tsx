import { Button } from "@work4you/ui/ui/components/button";
import { Select, SelectOption } from "@work4you/ui/ui/components/select";
import type { ConnectionState } from "@/lib/gatewayClient";
import { EFFORT_OPTIONS } from "@/lib/reasoning-effort";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";

export interface ChatContextBarProps {
  connectionState: ConnectionState;
  reconnecting?: boolean;
  info: ThinChatSessionInfo;
  usage: ThinChatSessionUsage | null;
  modelLabel: string;
  modelTitle?: string;
  onOpenModelPicker?: () => void;
  onReasoningChange?: (effort: string) => void;
  reasoningDisabled?: boolean;
  className?: string;
}

function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-[10rem] items-center truncate rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
    >
      {children}
    </span>
  );
}

function connectionTone(
  state: ConnectionState,
  reconnecting: boolean,
): string {
  if (reconnecting || state === "connecting") return "bg-amber-400";
  if (state === "open") return "bg-emerald-500";
  if (state === "error") return "bg-destructive";
  return "bg-muted-foreground/50";
}

function connectionLabel(
  state: ConnectionState,
  reconnecting: boolean,
): string {
  if (reconnecting) return "Reconnecting";
  if (state === "connecting") return "Connecting";
  if (state === "open") return "Live";
  if (state === "error") return "Error";
  if (state === "closed") return "Offline";
  return "Idle";
}

/**
 * Always-visible session context above the composer (model, effort, cwd, tokens).
 */
export function ChatContextBar({
  connectionState,
  reconnecting = false,
  info,
  usage,
  modelLabel,
  modelTitle,
  onOpenModelPicker,
  onReasoningChange,
  reasoningDisabled = false,
  className,
}: ChatContextBarProps) {
  const effort = info.reasoningEffort || "medium";
  const hasUsage =
    usage &&
    (usage.total != null || usage.input != null || usage.output != null);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 border-b border-border/35 px-2 py-1.5 text-xs",
        className,
      )}
      role="status"
    >
      <Chip title={`Gateway ${connectionLabel(connectionState, reconnecting)}`}>
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connectionTone(connectionState, reconnecting),
            )}
            aria-hidden
          />
          {connectionLabel(connectionState, reconnecting)}
        </span>
      </Chip>

      <Button
        ghost
        size="sm"
        type="button"
        disabled={!onOpenModelPicker}
        onClick={onOpenModelPicker}
        className="h-6 max-w-[9rem] min-w-0 px-1.5 py-0 text-[0.6875rem] font-medium normal-case tracking-normal"
        title={modelTitle || modelLabel}
      >
        <span className="flex min-w-0 items-center gap-0.5">
          <span className="truncate">{modelLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </span>
      </Button>

      <Select
        value={effort}
        disabled={reasoningDisabled || !onReasoningChange}
        onValueChange={(value) => onReasoningChange?.(value)}
        className="h-6 min-w-[5.5rem] max-w-[7rem] text-[0.6875rem]"
        aria-label="Reasoning effort"
      >
        {EFFORT_OPTIONS.map((opt) => (
          <SelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </SelectOption>
        ))}
      </Select>

      {info.branch ? <Chip title="Branch">{info.branch}</Chip> : null}
      {info.cwd ? (
        <Chip title={info.cwd}>
          {info.cwd.split("/").pop() || info.cwd}
        </Chip>
      ) : (
        <Chip title="Working directory">—</Chip>
      )}
      {info.fast ? <Chip>Fast</Chip> : null}
      {info.yolo ? <Chip>YOLO</Chip> : null}
      <Chip title="Session token usage">
        {hasUsage && usage
          ? usage.total != null
            ? `${usage.total.toLocaleString()} tok`
            : `${(usage.input ?? 0).toLocaleString()} in / ${(usage.output ?? 0).toLocaleString()} out`
          : "— tok"}
      </Chip>
    </div>
  );
}
