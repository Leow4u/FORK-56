import { Typography } from "@work4you/ui/ui/components/typography/index";

import { Composer } from "./composer";

export interface EmptyHomeProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (text: string) => void;
  autoFocus?: boolean;
}

/**
 * First-paint chat surface: brand + one short line + centered composer.
 * No secondary sidebar, stats, or cards — conversation UI only.
 */
export function EmptyHome({
  draft,
  onDraftChange,
  onSubmit,
  autoFocus = true,
}: EmptyHomeProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-16 pt-8">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Typography
            mondwest
            className="text-display text-[1.75rem] leading-none tracking-[0.04em] text-foreground sm:text-[2rem]"
          >
            Work4You
          </Typography>
          <p className="max-w-md text-sm text-muted-foreground">
            Ask anything. Your agent runs on this machine.
          </p>
        </div>

        <Composer
          variant="hero"
          value={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          autoFocus={autoFocus}
          className="w-full"
        />
      </div>
    </div>
  );
}
