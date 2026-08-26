import { Button } from "@work4you/ui/ui/components/button";
import { KeyRound, Lock } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { cn } from "@/lib/utils";

import type { SecretRequest, SudoRequest } from "./types";

export interface SudoDialogProps {
  request: SudoRequest;
  busy?: boolean;
  onSubmit: (password: string) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

export function SudoDialog({
  request,
  busy = false,
  onSubmit,
  onCancel,
}: SudoDialogProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValue("");
    setSubmitting(false);
  }, [request.requestId]);

  const send = useCallback(
    async (password: string) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        await onSubmit(password);
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit, submitting],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(value);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sudo password"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting && !busy) {
          void onCancel();
        }
      }}
    >
      <form
        className="w-full max-w-sm rounded-xl border border-border/60 bg-background p-4 shadow-xl"
        onSubmit={handleSubmit}
      >
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Sudo password</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          The agent needs elevated privileges. Leave empty and cancel to refuse.
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          className="mb-3 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={value}
          disabled={busy || submitting}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            ghost
            size="sm"
            disabled={busy || submitting}
            onClick={() => void onCancel()}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy || submitting}>
            {submitting ? "Sending…" : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export interface SecretDialogProps {
  request: SecretRequest;
  busy?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

export function SecretDialog({
  request,
  busy = false,
  onSubmit,
  onCancel,
}: SecretDialogProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValue("");
    setSubmitting(false);
  }, [request.requestId]);

  const send = useCallback(
    async (secret: string) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        await onSubmit(secret);
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit, submitting],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Secret"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting && !busy) {
          void onCancel();
        }
      }}
    >
      <form
        className="w-full max-w-sm rounded-xl border border-border/60 bg-background p-4 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          void send(value);
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            {request.envVar ? `Secret · ${request.envVar}` : "Secret"}
          </h2>
        </div>
        <p className={cn("mb-3 text-xs text-muted-foreground")}>
          {request.prompt || "Enter the requested secret. Cancel to skip."}
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="off"
          className="mb-3 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={value}
          disabled={busy || submitting}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            ghost
            size="sm"
            disabled={busy || submitting}
            onClick={() => void onCancel()}
          >
            Skip
          </Button>
          <Button type="submit" size="sm" disabled={busy || submitting}>
            {submitting ? "Sending…" : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
