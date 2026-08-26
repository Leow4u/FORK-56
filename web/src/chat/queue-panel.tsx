import { Button } from "@work4you/ui/ui/components/button";
import {
  CornerDownLeft,
  Layers3,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  isSteerableEntry,
  queuePreview,
  type QueuedPromptEntry,
} from "./composer-queue";

export interface QueuePanelProps {
  busy: boolean;
  entries: QueuedPromptEntry[];
  editingId?: string | null;
  parked?: boolean;
  onEdit: (entry: QueuedPromptEntry) => void;
  onDelete: (id: string) => void;
  onSendNow: (id: string) => void;
  onSteerNow?: (id: string) => void;
  onResume?: () => void;
  className?: string;
}

/**
 * Interactive queued-draft list (desktop QueuePanel subset).
 */
export function QueuePanel({
  busy,
  entries,
  editingId = null,
  parked = false,
  onEdit,
  onDelete,
  onSendNow,
  onSteerNow,
  onResume,
  className,
}: QueuePanelProps) {
  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        "mb-1.5 overflow-hidden rounded-lg border border-border/40 bg-muted/15",
        className,
      )}
      role="region"
      aria-label={parked ? "Paused queue" : "Message queue"}
    >
      <div className="flex h-7 items-center gap-1.5 border-b border-border/30 px-2 text-[0.7rem] text-muted-foreground">
        <Layers3 className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">
          {parked
            ? `${entries.length} paused`
            : `${entries.length} queued`}
        </span>
        {parked && onResume && (
          <Button
            type="button"
            size="sm"
            ghost
            className="h-6 px-1.5 text-[0.65rem]"
            onClick={onResume}
          >
            <Play className="mr-1 h-3 w-3" />
            Resume
          </Button>
        )}
      </div>
      <ul className="max-h-40 overflow-y-auto py-0.5">
        {entries.map((entry) => {
          const isEditing = editingId === entry.id;
          const canSteer =
            busy && Boolean(onSteerNow) && isSteerableEntry(entry);
          const preview = queuePreview(entry);
          return (
            <li
              key={entry.id}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5",
                isEditing && "bg-accent/30",
              )}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[0.73rem] leading-4 text-foreground/92"
                  title={preview}
                >
                  {preview}
                </p>
                {(entry.attachments.length > 0 || isEditing) && (
                  <p className="mt-0.5 text-[0.64rem] text-muted-foreground/80">
                    {entry.attachments.length > 0
                      ? `${entry.attachments.length} attachment${entry.attachments.length === 1 ? "" : "s"}`
                      : null}
                    {isEditing ? " · editing in composer" : null}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  ghost
                  className="h-6 w-6"
                  aria-label="Edit queued message"
                  disabled={Boolean(editingId) && !isEditing}
                  onClick={() => onEdit(entry)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                {canSteer && (
                  <Button
                    type="button"
                    size="icon"
                    ghost
                    className="h-6 w-6"
                    aria-label="Steer with this message"
                    disabled={isEditing}
                    onClick={() => onSteerNow?.(entry.id)}
                  >
                    <CornerDownLeft className="h-3 w-3 rotate-180" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  ghost
                  className="h-6 w-6"
                  aria-label={busy ? "Send next" : "Send now"}
                  disabled={isEditing}
                  onClick={() => onSendNow(entry.id)}
                >
                  <CornerDownLeft className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  ghost
                  className="h-6 w-6"
                  aria-label="Delete queued message"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
