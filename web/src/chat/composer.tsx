import { Button } from "@work4you/ui/ui/components/button";
import { ArrowUp } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  /** Centered EmptyHome vs bottom-docked SessionView. */
  variant?: "hero" | "dock";
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Shared chat composer — Enter sends, Shift+Enter inserts a newline.
 * Presentation only in step 2; gateway wiring lands in step 3.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  variant = "dock",
  placeholder = "Message Work4You…",
  disabled = false,
  autoFocus = false,
  className,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
  }, [autoFocus]);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, variant === "hero" ? 160 : 200);
    el.style.height = `${Math.max(next, variant === "hero" ? 52 : 44)}px`;
  }, [variant]);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
  }, [disabled, onSubmit, value]);

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const canSend = Boolean(value.trim()) && !disabled;

  return (
    <form
      onSubmit={onFormSubmit}
      className={cn(
        "flex w-full items-end gap-2 border border-border bg-background/80",
        variant === "hero" ? "rounded-2xl px-3 py-3 shadow-sm" : "rounded-xl px-2.5 py-2",
        className,
      )}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label="Message"
        className={cn(
          "min-h-[44px] max-h-[200px] flex-1 resize-none bg-transparent",
          "px-1.5 py-2 text-sm text-foreground placeholder:text-muted-foreground",
          "outline-none focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!canSend}
        aria-label="Send message"
        className="mb-0.5 shrink-0 rounded-lg"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </form>
  );
}
