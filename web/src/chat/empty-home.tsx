import { Typography } from "@work4you/ui/ui/components/typography/index";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

import { Composer } from "./composer";

const DEFAULT_SUGGESTIONS = [
  "What can you help me with?",
  "Summarize what we talked about last time",
  "What skills are available?",
  "Check if the gateway is healthy",
];

export interface EmptyHomeProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (text: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * First-paint chat surface: brand + one short line + centered composer.
 */
export function EmptyHome({
  draft,
  onDraftChange,
  onSubmit,
  autoFocus = true,
  disabled = false,
}: EmptyHomeProps) {
  const { t } = useI18n();
  const subtitle =
    t.thinChat?.emptySubtitle ??
    "Ask anything. Your agent runs on this machine.";
  const suggestions = t.thinChat?.suggestions ?? DEFAULT_SUGGESTIONS;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-16 pt-8">
      <div className="flex w-full max-w-3xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Typography
            mondwest
            className="text-display text-[1.75rem] leading-none tracking-[0.04em] text-foreground sm:text-[2rem]"
          >
            Work4You
          </Typography>
          <p className="max-w-md text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <Composer
          variant="hero"
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          autoFocus={autoFocus}
          disabled={disabled}
          className="w-full shadow-md"
        />

        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          {suggestions.map((label) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => onDraftChange(label)}
              className={cn(
                "rounded-full border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground",
                "transition-colors hover:border-border hover:bg-muted/35 hover:text-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
