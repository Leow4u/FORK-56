import { cn } from "@/lib/utils";

/** Floating pill — micro-actions and suggestion chips above the composer. */
export const composerFloatingPill = cn(
  "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5",
  "border border-border/65 bg-background/90 backdrop-blur-md",
  "text-xs font-normal text-muted-foreground transition-colors",
  "hover:bg-muted/50 hover:text-foreground",
);

/** Horizontal strip bracketing the composer surface (top pills / underside). */
export const composerFloatingStrip = "flex flex-wrap items-center gap-1.5 px-[5px]";

/** Glassy composer input card. */
export const composerSurface = cn(
  "relative w-full overflow-visible rounded-2xl border border-border/65",
  "bg-background/90 shadow-sm backdrop-blur-md",
  "transition-[border-color,box-shadow] focus-within:border-border focus-within:shadow-md",
);
