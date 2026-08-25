import type { GatewayClient } from "@/lib/gatewayClient";

import { MessageList } from "./message-list";
import { SlashComposer } from "./slash-composer";
import type { ChatMessage } from "./types";

export interface SessionViewProps {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (text: string) => void;
  gateway: GatewayClient | null;
  onStop?: () => void;
  busy?: boolean;
  autoFocus?: boolean;
}

/**
 * Active conversation: scrollable transcript + docked composer.
 */
export function SessionView({
  messages,
  draft,
  onDraftChange,
  onSubmit,
  gateway,
  onStop,
  busy = false,
  autoFocus = true,
}: SessionViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList messages={messages} busy={busy} />
      <div className="relative shrink-0 border-t border-border/60 bg-gradient-to-t from-background via-background/95 to-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="mx-auto w-full max-w-3xl">
          <SlashComposer
            variant="dock"
            value={draft}
            onChange={onDraftChange}
            onSubmit={onSubmit}
            gateway={gateway}
            onStop={onStop}
            busy={busy}
            autoFocus={autoFocus}
          />
        </div>
      </div>
    </div>
  );
}
