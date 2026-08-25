import { Composer } from "./composer";
import { MessageList } from "./message-list";
import type { ChatMessage } from "./types";

export interface SessionViewProps {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (text: string) => void;
  autoFocus?: boolean;
}

/**
 * Active conversation: scrollable transcript + docked composer.
 * No second chat sidebar — dashboard nav already owns Sessions.
 */
export function SessionView({
  messages,
  draft,
  onDraftChange,
  onSubmit,
  autoFocus = true,
}: SessionViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList messages={messages} />
      <div className="shrink-0 border-t border-border/60 bg-background/90 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-2xl">
          <Composer
            variant="dock"
            value={draft}
            onChange={onDraftChange}
            onSubmit={onSubmit}
            autoFocus={autoFocus}
          />
        </div>
      </div>
    </div>
  );
}
