import { Button } from "@work4you/ui/ui/components/button";
import { FileText, ImageIcon, Link, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ThinComposerAttachment } from "./attachments";

export interface ComposerAttachmentListProps {
  attachments: ThinComposerAttachment[];
  onRemove?: (id: string) => void;
  className?: string;
}

export function ComposerAttachmentList({
  attachments,
  onRemove,
  className,
}: ComposerAttachmentListProps) {
  if (!attachments.length) return null;

  return (
    <div
      className={cn("flex max-w-full flex-wrap gap-1.5 px-1 pb-1", className)}
      data-slot="composer-attachments"
    >
      {attachments.map((attachment) => (
        <AttachmentPill
          key={attachment.occurrenceId || attachment.id}
          attachment={attachment}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function AttachmentPill({
  attachment,
  onRemove,
}: {
  attachment: ThinComposerAttachment;
  onRemove?: (id: string) => void;
}) {
  const uploading = attachment.uploadState === "uploading";
  const errored = attachment.uploadState === "error";
  const Icon =
    attachment.kind === "image"
      ? ImageIcon
      : attachment.kind === "url"
        ? Link
        : FileText;

  return (
    <div
      className={cn(
        "group flex max-w-[14rem] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs",
        errored
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border/50 bg-muted/25 text-foreground",
      )}
      title={attachment.detail || attachment.label}
    >
      {attachment.kind === "image" && attachment.thumbnailUrl ? (
        <img
          src={attachment.thumbnailUrl}
          alt=""
          className="h-5 w-5 shrink-0 rounded object-cover"
        />
      ) : uploading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 truncate font-medium">{attachment.label}</span>
      {onRemove ? (
        <Button
          type="button"
          size="icon"
          ghost
          aria-label={`Remove ${attachment.label}`}
          className="h-5 w-5 shrink-0 rounded-md text-muted-foreground opacity-70 hover:opacity-100"
          onClick={() => onRemove(attachment.id)}
          disabled={uploading}
        >
          <X className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
}
