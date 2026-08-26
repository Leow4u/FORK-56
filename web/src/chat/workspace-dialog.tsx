import { Button } from "@work4you/ui/ui/components/button";
import { FolderOpen, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export interface WorkspaceDialogProps {
  open: boolean;
  initialCwd?: string | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onOpen: (cwd: string) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}

/**
 * Open / clear the session workspace (agent-side path).
 * Desktop uses an OS folder picker; web enters a path visible to the gateway.
 */
export function WorkspaceDialog({
  open,
  initialCwd = null,
  busy = false,
  error = null,
  onClose,
  onOpen,
  onClear,
}: WorkspaceDialogProps) {
  const [value, setValue] = useState(initialCwd ?? "");

  useEffect(() => {
    if (open) setValue(initialCwd ?? "");
  }, [open, initialCwd]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Open project"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Open project</h2>
          </div>
          <Button
            type="button"
            size="icon"
            ghost
            className="h-7 w-7"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Path on the agent host (not your local machine). Chat and attachments
          work without a project; Files / Review need one open.
        </p>
        <label className="mb-1 block text-[0.7rem] text-muted-foreground">
          Working directory
        </label>
        <input
          autoFocus
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              void onOpen(value.trim());
            }
          }}
          placeholder="/path/on/agent"
          className={cn(
            "mb-2 w-full rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm",
            "outline-none focus:border-border",
          )}
        />
        {error ? (
          <p className="mb-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {initialCwd ? (
            <Button
              type="button"
              ghost
              size="sm"
              disabled={busy}
              onClick={() => void onClear()}
            >
              Clear project
            </Button>
          ) : null}
          <Button type="button" ghost size="sm" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !value.trim()}
            onClick={() => void onOpen(value.trim())}
          >
            {busy ? "Opening…" : "Open"}
          </Button>
        </div>
      </div>
    </div>
  );
}
