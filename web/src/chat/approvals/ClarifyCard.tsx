import { Button } from "@work4you/ui/ui/components/button";
import { HelpCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { ClarifyRequest } from "./types";

export interface ClarifyCardProps {
  request: ClarifyRequest;
  busy?: boolean;
  onAnswer: (answer: string, questionId?: string) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  className?: string;
}

export function ClarifyCard({
  request,
  busy = false,
  onAnswer,
  onSkip,
  className,
}: ClarifyCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const batch = request.questions.length > 0;
  const current = useMemo(() => {
    if (!batch) return null;
    return (
      request.questions.find((q) => !request.lockedAnswers?.[q.qid]) ?? null
    );
  }, [batch, request.lockedAnswers, request.questions]);

  const question = batch ? current?.question ?? "" : request.question;
  const choices = batch ? current?.choices : request.choices;
  const multiSelect = batch
    ? Boolean(current?.multiSelect)
    : request.multiSelect;
  const questionId = batch ? current?.qid : undefined;

  const send = useCallback(
    async (answer: string) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        await onAnswer(answer, questionId);
        setCustom("");
        setSelected([]);
      } finally {
        setSubmitting(false);
      }
    },
    [onAnswer, questionId, submitting],
  );

  if (batch && !current) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/30 p-3 text-sm",
        className,
      )}
      role="dialog"
      aria-label="Clarify"
    >
      <div className="mb-2 flex items-start gap-2">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 font-medium text-foreground">{question}</p>
      </div>

      {choices && choices.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {choices.map((choice) => {
            const active = selected.includes(choice);
            return (
              <Button
                key={choice}
                type="button"
                size="sm"
                ghost={!active}
                disabled={busy || submitting}
                className="h-7 text-xs"
                onClick={() => {
                  if (multiSelect) {
                    setSelected((prev) =>
                      prev.includes(choice)
                        ? prev.filter((c) => c !== choice)
                        : [...prev, choice],
                    );
                    return;
                  }
                  void send(choice);
                }}
              >
                {choice}
              </Button>
            );
          })}
        </div>
      ) : null}

      {multiSelect && selected.length > 0 ? (
        <Button
          type="button"
          size="sm"
          className="mb-2 h-7 text-xs"
          disabled={busy || submitting}
          onClick={() => void send(selected.join(", "))}
        >
          Submit selected
        </Button>
      ) : null}

      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const value = custom.trim();
          if (value) void send(value);
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Type an answer…"
          value={custom}
          disabled={busy || submitting}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          className="h-7 text-xs"
          disabled={busy || submitting || !custom.trim()}
        >
          Send
        </Button>
        <Button
          type="button"
          size="sm"
          ghost
          className="h-7 text-xs"
          disabled={busy || submitting}
          onClick={() => void onSkip()}
        >
          Skip
        </Button>
      </form>
    </div>
  );
}
