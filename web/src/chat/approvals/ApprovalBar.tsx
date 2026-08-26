import { Button } from "@work4you/ui/ui/components/button";
import { ShieldAlert } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

import type { ApprovalChoice, ApprovalRequest } from "./types";
import { APPROVAL_LABELS, approvalOptions } from "./types";

export interface ApprovalBarProps {
  request: ApprovalRequest;
  busy?: boolean;
  onChoose: (choice: ApprovalChoice) => void | Promise<void>;
  className?: string;
}

export function ApprovalBar({
  request,
  busy = false,
  onChoose,
  className,
}: ApprovalBarProps) {
  const [submitting, setSubmitting] = useState<ApprovalChoice | null>(null);
  const opts = approvalOptions(request);

  const choose = useCallback(
    async (choice: ApprovalChoice) => {
      if (submitting) return;
      setSubmitting(choice);
      try {
        await onChoose(choice);
      } finally {
        setSubmitting(null);
      }
    },
    [onChoose, submitting],
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm",
        className,
      )}
      role="alertdialog"
      aria-label="Command approval"
    >
      <div className="mb-2 flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            {request.description || "Approve command?"}
          </p>
          {request.command ? (
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 font-mono text-[0.7rem] text-muted-foreground">
              {request.command}
            </pre>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((choice) => (
          <Button
            key={choice}
            type="button"
            size="sm"
            ghost={choice !== "deny"}
            destructive={choice === "deny"}
            disabled={busy || Boolean(submitting)}
            className="h-7 text-xs"
            onClick={() => void choose(choice)}
          >
            {submitting === choice ? "…" : APPROVAL_LABELS[choice]}
          </Button>
        ))}
      </div>
    </div>
  );
}
