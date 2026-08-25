import { Button } from "@work4you/ui/ui/components/button";
import { ArrowUp, Plus, Square } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

import { composerSurface } from "./composer-dock-styles";

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  /** Centered EmptyHome vs bottom-docked SessionView. */
  variant?: "hero" | "dock";
  placeholder?: string;
  disabled?: boolean;
  /** When true, show Stop instead of Send. */
  busy?: boolean;
  onStop?: () => void;
  autoFocus?: boolean;
  className?: string;
  /** When true, popover/slash handler consumed the key. */
  onBeforeKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Controls between input and send (e.g. model pill). */
  trailingControls?: ReactNode;
  /** Show the attach/context `+` affordance (type @ for paths). */
  showAttachButton?: boolean;
}

/**
 * Shared chat composer — Enter sends, Shift+Enter inserts a newline.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  variant = "dock",
  placeholder = "Message Work4You…",
  disabled = false,
  busy = false,
  onStop,
  autoFocus = false,
  className,
  onBeforeKeyDown,
  trailingControls,
  showAttachButton = true,
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
    if (busy && !onStop) return;
    onSubmit(text);
  }, [busy, disabled, onStop, onSubmit, value]);

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy && !onStop) return;
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onBeforeKeyDown?.(event)) return;
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (busy && !onStop) return;
      submit();
    }
  };

  const canSend = Boolean(value.trim()) && !disabled && (!busy || Boolean(onStop));

  return (
    <form
      onSubmit={onFormSubmit}
      className={cn(
        composerSurface,
        variant === "hero" ? "px-3 py-3" : "px-2.5 py-2",
        className,
      )}
    >
      <div className="flex w-full items-end gap-2">
        {showAttachButton ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            className="mb-0.5 h-8 w-8 shrink-0 rounded-lg text-muted-foreground"
            aria-label="Add context — type @ for files"
            title="Type @ for files and folders"
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}

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
            "px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground",
            "outline-none focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />

        <div className="mb-0.5 flex shrink-0 items-center gap-1">
          {trailingControls}
          {busy && onStop ? (
            <Button
              type="button"
              size="icon"
              onClick={onStop}
              aria-label="Stop generating"
              className="h-8 w-8 shrink-0 rounded-lg"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              aria-label={busy ? "Steer message" : "Send message"}
              className="h-8 w-8 shrink-0 rounded-lg"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
