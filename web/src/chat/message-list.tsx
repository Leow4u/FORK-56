import { ArrowDown } from "lucide-react";

import { Markdown } from "@/components/Markdown";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import type { ChatMessage } from "./types";
import { useStickToBottom } from "./use-stick-to-bottom";
import { shouldShowThinking } from "./thinking";

export interface MessageListProps {
  messages: ChatMessage[];
  /** Agent turn in flight — shows thinking dots before the first token. */
  busy?: boolean;
  className?: string;
}

function ThinkingRow({ label }: { label: string }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl justify-start">
      <div
        className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/40 bg-muted/25 px-4 py-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">{label}</span>
        <span className="flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
        </span>
        <span className="text-xs">{label}</span>
      </div>
    </div>
  );
}

function ToolLine({ text }: { text: string }) {
  const running = text.startsWith("▶");
  return (
    <div className="mx-auto flex w-full max-w-3xl justify-start">
      <div
        className={cn(
          "max-w-full rounded-lg border px-3 py-1.5 font-mono text-xs leading-snug",
          running
            ? "border-primary/25 bg-primary/5 text-primary/90"
            : "border-border/40 bg-muted/15 text-muted-foreground",
        )}
      >
        {text}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const isSystem = message.role === "system";

  if (isTool) {
    return <ToolLine text={message.text} />;
  }

  if (isSystem) {
    return (
      <div className="mx-auto max-w-3xl px-1 py-1">
        <p className="text-center text-xs text-muted-foreground">{message.text}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[min(100%,44rem)] px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-2xl rounded-br-md bg-foreground text-background shadow-sm"
            : "rounded-2xl rounded-bl-md border border-border/45 bg-muted/30 text-foreground shadow-sm",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : (
          <Markdown content={message.text} streaming={message.streaming} />
        )}
      </div>
    </div>
  );
}

export function MessageList({ messages, busy = false, className }: MessageListProps) {
  const { t } = useI18n();
  const thinkingLabel = t.thinChat?.thinking ?? "Thinking…";
  const scrollLabel = t.thinChat?.scrollToBottom ?? "Scroll to bottom";

  const { containerRef, endRef, showJump, scrollToBottom } = useStickToBottom([
    messages,
    busy,
  ]);

  const showThinking = shouldShowThinking(messages, busy);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        className={cn(
          "flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 py-6",
          className,
        )}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {showThinking && <ThinkingRow label={thinkingLabel} />}
        <div ref={endRef} aria-hidden className="h-px w-full shrink-0" />
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          aria-label={scrollLabel}
          className={cn(
            "absolute bottom-3 left-1/2 z-10 -translate-x-1/2",
            "flex h-8 w-8 items-center justify-center rounded-full",
            "border border-border/60 bg-background/90 text-muted-foreground shadow-md backdrop-blur-sm",
            "transition-colors hover:text-foreground",
          )}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
