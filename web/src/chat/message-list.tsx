import { useEffect, useRef } from "react";

import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

import type { ChatMessage } from "./types";

export interface MessageListProps {
  messages: ChatMessage[];
  className?: string;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system" || message.role === "tool";

  if (isSystem) {
    return (
      <div className="mx-auto max-w-2xl px-1 py-1">
        <p className="text-center text-xs text-muted-foreground">{message.text}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[min(100%,42rem)] px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-2xl rounded-br-md bg-foreground text-background"
            : "rounded-2xl rounded-bl-md text-foreground",
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

export function MessageList({ messages, className }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // jsdom has no layout engine — scrollIntoView is often missing in tests.
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-6",
        className,
      )}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={endRef} aria-hidden className="h-px w-full shrink-0" />
    </div>
  );
}
