import { useCallback, useMemo, useState } from "react";

import { ModelPickerDialog } from "@/components/ModelPickerDialog";
import type { ConnectionState } from "@/lib/gatewayClient";
import { cn } from "@/lib/utils";

import { ChatActivityStrip, type ThinChatActivity } from "./chat-activity-strip";
import { ChatContextBar } from "./chat-context-bar";
import { SlashComposer, type SlashComposerProps } from "./slash-composer";
import type { ThinChatSessionInfo, ThinChatSessionUsage } from "./session-info";

export interface ComposerDockProps extends SlashComposerProps {
  connectionState: ConnectionState;
  reconnecting?: boolean;
  sessionInfo: ThinChatSessionInfo;
  sessionUsage: ThinChatSessionUsage | null;
  activity: ThinChatActivity;
  resumeLabel?: string | null;
  showChrome?: boolean;
  onReasoningChange?: (effort: string) => void;
  className?: string;
}

/**
 * Composer dock: context bar + activity strip + slash/@ composer + model picker.
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
  className,
  variant = "dock",
  ...composerProps
}: ComposerDockProps) {
  const [modelOpen, setModelOpen] = useState(false);

  const modelName =
    sessionInfo.model && sessionInfo.provider
      ? `${sessionInfo.provider}/${sessionInfo.model}`
      : sessionInfo.model || sessionInfo.provider || "";
  const modelLabel = modelName
    ? (modelName.split("/").slice(-1)[0] ?? modelName)
    : "Model";
  const modelTitle = modelName || "Switch model";

  const canPickModel = Boolean(gateway && sessionId);

  const handleReasoning = useCallback(
    (effort: string) => {
      onReasoningChange?.(effort);
    },
    [onReasoningChange],
  );

  const dockPlaceholder = useMemo(
    () =>
      variant === "hero"
        ? "Plan, Build, / for skills, @ for context"
        : "Message Work4You…  / skills  @ files",
    [variant],
  );

  return (
    <div className={cn("w-full", className)}>
      {showChrome && (
        <>
          <ChatContextBar
            connectionState={connectionState}
            reconnecting={reconnecting}
            info={sessionInfo}
            usage={sessionUsage}
            modelLabel={modelLabel}
            modelTitle={modelTitle}
            onOpenModelPicker={
              canPickModel ? () => setModelOpen(true) : undefined
            }
            onReasoningChange={canPickModel ? handleReasoning : undefined}
            reasoningDisabled={!canPickModel}
          />
          <ChatActivityStrip
            busy={Boolean(composerProps.busy)}
            activity={activity}
            resumeLabel={resumeLabel}
          />
        </>
      )}

      <SlashComposer
        variant={variant}
        gateway={gateway}
        sessionId={sessionId}
        placeholder={dockPlaceholder}
        {...composerProps}
      />

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
