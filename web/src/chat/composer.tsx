import { Button } from "@work4you/ui/ui/components/button";
import { ArrowUp, Layers3, Plus, Square } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

import { composerSurface } from "./composer-dock-styles";

export type ComposerBusyAction = "send" | "stop" | "steer" | "queue";

export function resolveComposerBusyAction(
  busy: boolean,
  text: string,
): ComposerBusyAction {
  const trimmed = text.trim();
  if (!busy) return "send";
  if (!trimmed) return "stop";
  if (trimmed.startsWith("/")) return "queue";
  return "steer";
}

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  /** Centered EmptyHome vs bottom-docked SessionView. */
  variant?: "hero" | "dock";
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  onStop?: () => void;
  onQueue?: (text: string) => void;
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
  onQueue,
  autoFocus = false,
  className,
  onBeforeKeyDown,
  trailingControls,
  showAttachButton = true,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasText = Boolean(value.trim());
  const busyAction = useMemo(
    () => resolveComposerBusyAction(busy, value),
    [busy, value],
  );

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

  const dispatch = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;

    if (busyAction === "queue") {
      onQueue?.(text);
      return;
    }

    onSubmit(text);
  }, [busyAction, disabled, onQueue, onSubmit, value]);

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busyAction === "stop") return;
    dispatch();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onBeforeKeyDown?.(event)) return;
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (busyAction === "stop") return;
      dispatch();
    }
  };

  const showStop = busyAction === "stop";
  const showQueue = busyAction === "queue" && Boolean(onQueue);
  const canSend = hasText && !disabled && busyAction !== "stop";

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
          {showQueue ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={!canSend}
              aria-label="Queue message for next turn"
              className="h-8 w-8 shrink-0 rounded-lg"
              onClick={dispatch}
            >
              <Layers3 className="h-4 w-4" />
            </Button>
          ) : null}
          {showStop ? (
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
              aria-label={busyAction === "steer" ? "Steer message" : "Send message"}
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
