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
  canLoadEarlier?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
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

function ReasoningBlock({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl justify-start">
      <details
        className="max-w-full rounded-lg border border-border/35 bg-muted/10 px-3 py-2 text-xs text-muted-foreground"
        open={Boolean(streaming)}
      >
        <summary className="cursor-pointer select-none font-medium text-muted-foreground/90">
          Reasoning
        </summary>
        <p className="mt-2 whitespace-pre-wrap break-words font-mono leading-relaxed">
          {text}
          {streaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-muted-foreground/60 align-middle"
            />
          )}
        </p>
      </details>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const isSystem = message.role === "system";
  const isReasoning = message.role === "reasoning";

  if (isTool) {
    return <ToolLine text={message.text} />;
  }

  if (isReasoning) {
    return <ReasoningBlock text={message.text} streaming={message.streaming} />;
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

export function MessageList({
  messages,
  busy = false,
  canLoadEarlier = false,
  loadingEarlier = false,
  onLoadEarlier,
  className,
}: MessageListProps) {
  const { t } = useI18n();
  const thinkingLabel = t.thinChat?.thinking ?? "Thinking…";
  const scrollLabel = t.thinChat?.scrollToBottom ?? "Scroll to bottom";
  const loadEarlierLabel = t.thinChat?.loadEarlier ?? "Load earlier messages";

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
        {canLoadEarlier && onLoadEarlier && (
          <div className="mx-auto flex w-full max-w-3xl justify-center">
            <button
              type="button"
              disabled={loadingEarlier}
              onClick={onLoadEarlier}
              className="rounded-full border border-border/50 bg-muted/20 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground disabled:opacity-50"
            >
              {loadingEarlier ? t.common.loading : loadEarlierLabel}
            </button>
          </div>
        )}
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
