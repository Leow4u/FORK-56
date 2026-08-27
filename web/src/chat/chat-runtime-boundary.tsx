// @ts-nocheck — desktop parity port; web shims pending.
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useMemo } from "react";

import { Thread } from "@/components/assistant-ui/thread";
import { TranscriptWindowProvider } from "@/components/assistant-ui/thread/transcript-window";
import type { ChatMessage } from "@/lib/chat-messages";
import { useIncrementalExternalStoreRuntime } from "@/lib/incremental-external-store-runtime";
import type { GatewayClient } from "@/lib/gatewayClient";

import { useRuntimeMessageRepository } from "./runtime-repository";

export interface ChatRuntimeBoundaryProps {
  messages: ChatMessage[];
  busy: boolean;
  gateway: GatewayClient | null;
  sessionId?: string | null;
  cwd?: string | null;
  canLoadEarlier?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
}

export function ChatRuntimeBoundary({
  messages,
  busy,
  gateway,
  sessionId = null,
  cwd = null,
  canLoadEarlier = false,
  loadingEarlier: _loadingEarlier = false,
  onLoadEarlier,
}: ChatRuntimeBoundaryProps) {
  const repository = useRuntimeMessageRepository(messages);

  const transcriptWindow = useMemo(
    () => ({
      olderAvailable: canLoadEarlier,
      expandWindow: () => {
        onLoadEarlier?.();
      },
    }),
    [canLoadEarlier, onLoadEarlier],
  );

  const runtime = useIncrementalExternalStoreRuntime({
    messageRepository: repository,
    isRunning: busy,
    onNew: async () => {
      // Composer submits via thin-chat gateway — not via Thread composer.
    },
    onEdit: async () => {
      // Edit-in-place is a follow-up; web composer handles sends.
    },
    onCancel: async () => {
      // Stop is owned by ComposerDock.
    },
    onReload: async () => {
      // Branch reload not wired on web v1.
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TranscriptWindowProvider value={transcriptWindow}>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Thread
            clampToComposer
            cwd={cwd}
            gateway={gateway}
            loading={busy ? "response" : undefined}
            sessionId={sessionId}
            sessionKey={sessionId}
          />
        </div>
      </TranscriptWindowProvider>
    </AssistantRuntimeProvider>
  );
}
