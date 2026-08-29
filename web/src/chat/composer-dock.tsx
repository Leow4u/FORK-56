import { Select, SelectOption } from "@work4you/ui/ui/components/select";
import { useMemo, useState } from "react";

import { ModelPickerDialog } from "@/components/ModelPickerDialog";
import type { ConnectionState } from "@/lib/gatewayClient";
import { formatModelStatusLabel } from "@/lib/model-status-label";
import { EFFORT_OPTIONS } from "@/lib/reasoning-effort";
import { cn } from "@/lib/utils";

import type { ThinChatActivity } from "./chat-activity-strip";
import type { ComposerAttachHandlers } from "./composer";
import { ComposerFloatingPills } from "./composer-floating-pills";
import { ComposerModelPill } from "./composer-model-pill";
import type { QueuedPromptEntry } from "./composer-queue";
import { ComposerUnderside } from "./composer-underside";
import { ComposerVoiceButton } from "./composer-voice-button";
import { QueuePanel } from "./queue-panel";
import { SlashComposer, type SlashComposerProps } from "./slash-composer";
import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";
import { useContextBreakdown } from "./use-context-breakdown";

export interface ComposerDockProps extends SlashComposerProps {
  connectionState: ConnectionState;
  reconnecting?: boolean;
  sessionInfo: ThinChatSessionInfo;
  sessionUsage: ThinChatSessionUsage | null;
  activity: ThinChatActivity;
  resumeLabel?: string | null;
  showChrome?: boolean;
  onReasoningChange?: (effort: string) => void;
  onQueue?: (text: string) => void;
  attach?: ComposerAttachHandlers | null;
  workspaceCwd?: string | null;
  onWorkspaceClick?: () => void;
  queueEntries?: QueuedPromptEntry[];
  queueParked?: boolean;
  onQueueEdit?: (entry: QueuedPromptEntry) => void;
  onQueueDelete?: (id: string) => void;
  onQueueSendNow?: (id: string) => void;
  onQueueSteerNow?: (id: string) => void;
  onQueueResume?: () => void;
  className?: string;
}

/**
 * Composer dock — FORK geometry: floating top → surface → underside.
 */
export function ComposerDock({
  gateway,
  sessionId,
  connectionState,
  reconnecting = false,
  sessionInfo,
  sessionUsage,
  activity,
  resumeLabel,
  showChrome = true,
  onReasoningChange,
  onQueue,
  attach = null,
  workspaceCwd = null,
  onWorkspaceClick,
  queueEntries = [],
  queueParked = false,
  onQueueEdit,
  onQueueDelete,
  onQueueSendNow,
  onQueueSteerNow,
  onQueueResume,
  className,
  variant = "dock",
  ...composerProps
}: ComposerDockProps) {
  const [modelOpen, setModelOpen] = useState(false);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const busy = Boolean(composerProps.busy);
  const draft = composerProps.value ?? "";
  const setDraft = composerProps.onChange;

  const { breakdown, loading: breakdownLoading } = useContextBreakdown({
    busy,
    enabled: showChrome,
    gateway,
    sessionId,
  });

  const modelName =
    sessionInfo.model && sessionInfo.provider
      ? `${sessionInfo.provider}/${sessionInfo.model}`
      : sessionInfo.model || sessionInfo.provider || "";
  const modelLabel = formatModelStatusLabel(modelName || "Auto", {
    reasoningEffort: sessionInfo.reasoningEffort,
    fastMode: sessionInfo.fast,
  });
  const modelTitle = modelName
    ? `${modelName} · effort ${sessionInfo.reasoningEffort || "medium"}`
    : "Switch model";

  const canPickModel = Boolean(gateway && sessionId);
  const effort = sessionInfo.reasoningEffort || "medium";

  const dockPlaceholder = useMemo(
    () =>
      variant === "hero"
        ? "Plan, Build, / for skills, @ for context"
        : "Send follow-up",
    [variant],
  );

  const trailingControls = showChrome ? (
    <div className="flex min-w-0 items-center gap-1">
      <ComposerVoiceButton
        disabled={Boolean(composerProps.disabled)}
        onTranscript={(text) => {
          if (!setDraft) return;
          const next = draft.trim()
            ? `${draft.trimEnd()} ${text}`
            : text;
          setDraft(next);
        }}
      />
      <Select
        value={effort}
        disabled={!onReasoningChange}
        onValueChange={(value) => onReasoningChange?.(value)}
        className="h-7 min-w-[4.5rem] max-w-[5.5rem] text-[0.7rem]"
        aria-label="Reasoning effort"
      >
        {EFFORT_OPTIONS.map((opt) => (
          <SelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </SelectOption>
        ))}
      </Select>
      <ComposerModelPill
        label={modelLabel}
        title={modelTitle}
        disabled={!canPickModel}
        onClick={canPickModel ? () => setModelOpen(true) : undefined}
      />
    </div>
  ) : undefined;

  const showFloatingPills =
    showChrome &&
    (Boolean(composerProps.busy) ||
      Boolean(resumeLabel) ||
      Boolean(activity.toolLine) ||
      Boolean(activity.backgroundLine) ||
      (activity.queueCount > 0 && queueEntries.length === 0) ||
      Boolean(sessionInfo.fast) ||
      Boolean(sessionInfo.yolo));

  return (
    <div className={cn("flex w-full flex-col", className)} data-slot="composer-dock">
      {showChrome &&
        queueEntries.length > 0 &&
        onQueueEdit &&
        onQueueDelete &&
        onQueueSendNow && (
          <QueuePanel
            busy={busy}
            entries={queueEntries}
            editingId={editingQueueId}
            parked={queueParked}
            onEdit={(entry) => {
              setEditingQueueId(entry.id);
              onQueueEdit(entry);
            }}
            onDelete={(id) => {
              if (editingQueueId === id) setEditingQueueId(null);
              onQueueDelete(id);
            }}
            onSendNow={onQueueSendNow}
            onSteerNow={onQueueSteerNow}
            onResume={onQueueResume}
          />
        )}

      {showFloatingPills ? (
        <ComposerFloatingPills
          activity={activity}
          busy={busy}
          info={sessionInfo}
          resumeLabel={resumeLabel}
        />
      ) : null}

      <SlashComposer
        variant={variant}
        gateway={gateway}
        sessionId={sessionId}
        placeholder={dockPlaceholder}
        trailingControls={trailingControls}
        showAttachButton={showChrome}
        onQueue={onQueue}
        attach={attach}
        className="w-full"
        {...composerProps}
      />

      {showChrome ? (
        <ComposerUnderside
          connectionState={connectionState}
          reconnecting={reconnecting}
          info={sessionInfo}
          usage={sessionUsage}
          breakdown={breakdown}
          breakdownLoading={breakdownLoading}
          busy={busy}
          workspaceCwd={workspaceCwd}
          onWorkspaceClick={onWorkspaceClick}
        />
      ) : null}

      {modelOpen && gateway && sessionId && (
        <ModelPickerDialog
          gw={gateway}
          sessionId={sessionId}
          onClose={() => setModelOpen(false)}
        />
      )}
    </div>
  );
}
