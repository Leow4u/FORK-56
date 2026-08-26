import { Button } from "@work4you/ui/ui/components/button";
import {
  Clipboard,
  FileText,
  ImageIcon,
  Link,
  MessageSquareText,
  Plus,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { cn } from "@/lib/utils";

import { PROMPT_SNIPPETS } from "./attachments";

export interface ComposerAttachMenuProps {
  disabled?: boolean;
  onPickFiles: (files: FileList | File[]) => void;
  onPickImages: (files: FileList | File[]) => void;
  onPasteClipboardImage: () => void | Promise<void>;
  onAddUrl: (url: string) => void;
  onInsertSnippet: (text: string) => void;
  className?: string;
}

/**
 * ``+`` attach menu — desktop ContextMenu contract, browser pickers.
 */
export function ComposerAttachMenu({
  disabled = false,
  onPickFiles,
  onPickImages,
  onPasteClipboardImage,
  onAddUrl,
  onInsertSnippet,
  className,
}: ComposerAttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (list?.length) onPickFiles(list);
    event.target.value = "";
    setOpen(false);
  };

  const onImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (list?.length) onPickImages(list);
    event.target.value = "";
    setOpen(false);
  };

  const submitUrl = useCallback(() => {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    onAddUrl(trimmed);
    setUrlValue("");
    setUrlOpen(false);
    setOpen(false);
  }, [onAddUrl, urlValue]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <input
        ref={filesRef}
        type="file"
        multiple
        className="hidden"
        onChange={onFilesChange}
      />
      <input
        ref={imagesRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/tiff,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff,.tif"
        className="hidden"
        onChange={onImagesChange}
      />

      <Button
        type="button"
        size="icon"
        ghost
        disabled={disabled}
        aria-label="Add context"
        title="Add context"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "mb-0.5 h-8 w-8 rounded-lg text-muted-foreground",
          open && "bg-muted/40 text-foreground",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-4 w-4" />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-40 mb-2 w-56 overflow-hidden rounded-xl border border-border/60 bg-background/95 p-1 shadow-lg backdrop-blur-sm"
        >
          <p className="px-2 pb-0.5 pt-1 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Attach
          </p>
          <MenuItem
            icon={FileText}
            label="Files…"
            onSelect={() => filesRef.current?.click()}
          />
          <MenuItem
            icon={ImageIcon}
            label="Images…"
            onSelect={() => imagesRef.current?.click()}
          />
          <MenuItem
            icon={Clipboard}
            label="Paste image"
            onSelect={() => {
              setOpen(false);
              void onPasteClipboardImage();
            }}
          />
          <MenuItem
            icon={Link}
            label="URL…"
            onSelect={() => {
              setUrlOpen(true);
              setSnippetsOpen(false);
            }}
          />
          <div className="my-1 h-px bg-border/50" />
          <MenuItem
            icon={MessageSquareText}
            label="Prompt snippets…"
            onSelect={() => {
              setSnippetsOpen(true);
              setUrlOpen(false);
            }}
          />
          <div className="my-1 h-px bg-border/50" />
          <p className="px-2 py-1 text-[0.7rem] text-muted-foreground/80">
            Tip: type <kbd className="rounded border border-border/50 px-1">@</kbd>{" "}
            for paths on the agent
          </p>

          {urlOpen ? (
            <div className="mt-1 space-y-1.5 border-t border-border/50 px-2 py-2">
              <label className="text-[0.7rem] text-muted-foreground">URL</label>
              <input
                autoFocus
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitUrl();
                  }
                }}
                placeholder="https://"
                className="w-full rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-xs outline-none focus:border-border"
              />
              <Button
                type="button"
                size="sm"
                className="h-7 w-full text-xs"
                disabled={!urlValue.trim()}
                onClick={submitUrl}
              >
                Attach URL
              </Button>
            </div>
          ) : null}

          {snippetsOpen ? (
            <div className="mt-1 space-y-0.5 border-t border-border/50 px-1 py-1">
              {PROMPT_SNIPPETS.map((snippet) => (
                <button
                  key={snippet.key}
                  type="button"
                  role="menuitem"
                  className="flex w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/40"
                  onClick={() => {
                    onInsertSnippet(snippet.text);
                    setSnippetsOpen(false);
                    setOpen(false);
                  }}
                >
                  {snippet.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof FileText;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/40"
      onClick={onSelect}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}
