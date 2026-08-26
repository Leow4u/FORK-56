import { Button } from "@work4you/ui/ui/components/button";
import { ArrowUp, Layers3, Plus, Square } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

import type { ThinComposerAttachment } from "./attachments";
import { isImageFile } from "./attachments";
import { ComposerAttachMenu } from "./composer-attach-menu";
import { ComposerAttachmentList } from "./composer-attachment-list";
import { composerSurface } from "./composer-dock-styles";

export type ComposerBusyAction = "send" | "stop" | "steer" | "queue";

export function resolveComposerBusyAction(
  busy: boolean,
  text: string,
  hasAttachments = false,
): ComposerBusyAction {
  const trimmed = text.trim();
  if (!busy) return "send";
  if (!trimmed && !hasAttachments) return "stop";
  if (trimmed.startsWith("/")) return "queue";
  // Desktop: attachments force queue (cannot steer with pending chips).
  if (hasAttachments) return "queue";
  if (!trimmed) return "stop";
  return "steer";
}

export interface ComposerAttachHandlers {
  attachments: ThinComposerAttachment[];
  onRemoveAttachment: (id: string) => void;
  onPickFiles: (files: FileList | File[]) => void;
  onPickImages: (files: FileList | File[]) => void;
  onPasteClipboardImage: () => void | Promise<void>;
  onAddUrl: (url: string) => void;
  onInsertSnippet: (text: string) => void;
  onDropFiles?: (files: File[]) => void;
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
  /** Show the attach/context ``+`` affordance. */
  showAttachButton?: boolean;
  attach?: ComposerAttachHandlers | null;
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
  attach = null,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasAttachments = Boolean(attach?.attachments.length);
  const hasText = Boolean(value.trim());
  const hasPayload = hasText || hasAttachments;
  const busyAction = useMemo(
    () => resolveComposerBusyAction(busy, value, hasAttachments),
    [busy, value, hasAttachments],
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
    if (disabled) return;
    const text = value.trim();
    if (!text && !hasAttachments) return;

    if (busyAction === "queue") {
      onQueue?.(text);
      return;
    }

    onSubmit(text);
  }, [busyAction, disabled, hasAttachments, onQueue, onSubmit, value]);

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

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (!attach) return;
      const files = event.clipboardData?.files;
      if (!files?.length) return;
      const images: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (file && isImageFile(file)) images.push(file);
      }
      if (!images.length) return;
      event.preventDefault();
      void attach.onPickImages(images);
    },
    [attach],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    if (!attach) return;
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, [attach]);

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!attach) return;
      const list = event.dataTransfer?.files;
      if (!list?.length) return;
      event.preventDefault();
      const files = Array.from(list);
      if (attach.onDropFiles) {
        attach.onDropFiles(files);
      } else {
        void attach.onPickFiles(files);
      }
    },
    [attach],
  );

  const showStop = busyAction === "stop";
  const showQueue = busyAction === "queue" && Boolean(onQueue);
  const canSend = hasPayload && !disabled && busyAction !== "stop";

  return (
    <form
      onSubmit={onFormSubmit}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        composerSurface,
        variant === "hero" ? "px-3 py-3" : "px-2.5 py-2",
        className,
      )}
    >
      {attach && attach.attachments.length > 0 ? (
        <ComposerAttachmentList
          attachments={attach.attachments}
          onRemove={attach.onRemoveAttachment}
        />
      ) : null}

      <div className="flex w-full items-end gap-2">
        {showAttachButton && attach ? (
          <ComposerAttachMenu
            disabled={disabled}
            onPickFiles={attach.onPickFiles}
            onPickImages={attach.onPickImages}
            onPasteClipboardImage={attach.onPasteClipboardImage}
            onAddUrl={attach.onAddUrl}
            onInsertSnippet={attach.onInsertSnippet}
          />
        ) : showAttachButton ? (
          <Button
            type="button"
            size="icon"
            ghost
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
          onPaste={onPaste}
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
              ghost
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
