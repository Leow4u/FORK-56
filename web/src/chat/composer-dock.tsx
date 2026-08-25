import { useMemo, useState } from "react";

import { ModelPickerDialog } from "@/components/ModelPickerDialog";
import type { ConnectionState } from "@/lib/gatewayClient";
import { cn } from "@/lib/utils";

import type { ThinChatActivity } from "./chat-activity-strip";
import { ComposerFloatingPills } from "./composer-floating-pills";
import { ComposerModelPill } from "./composer-model-pill";
import { ComposerUnderside } from "./composer-underside";
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
  onReasoningChange: _reasoningChange,
  onQueue,
  className,
  variant = "dock",
  ...composerProps
}: ComposerDockProps) {
  void _reasoningChange;
  const [modelOpen, setModelOpen] = useState(false);
  const busy = Boolean(composerProps.busy);

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
  const modelLabel = modelName
    ? (modelName.split("/").slice(-1)[0] ?? modelName)
    : "Auto";
  const modelTitle = modelName || "Switch model";

  const canPickModel = Boolean(gateway && sessionId);

  const dockPlaceholder = useMemo(
    () =>
      variant === "hero"
        ? "Plan, Build, / for skills, @ for context"
        : "Send follow-up",
    [variant],
  );

  const modelPill = (
    <ComposerModelPill
      label={modelLabel}
      title={modelTitle}
      disabled={!canPickModel}
      onClick={canPickModel ? () => setModelOpen(true) : undefined}
    />
  );

  const showFloatingPills =
    showChrome &&
    (Boolean(composerProps.busy) ||
      Boolean(resumeLabel) ||
      Boolean(activity.toolLine) ||
      Boolean(activity.backgroundLine) ||
      activity.queueCount > 0 ||
      Boolean(sessionInfo.fast) ||
      Boolean(sessionInfo.yolo));

  return (
    <div className={cn("flex w-full flex-col", className)} data-slot="composer-dock">
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
        trailingControls={showChrome ? modelPill : undefined}
        showAttachButton={showChrome}
        onQueue={onQueue}
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
