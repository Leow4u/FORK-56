import { Button } from "@work4you/ui/ui/components/button";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ComposerModelPillProps {
  label: string;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Model selector pill — lives inside the composer controls row (desktop ModelPill). */
export function ComposerModelPill({
  label,
  title,
  disabled = false,
  onClick,
  className,
}: ComposerModelPillProps) {
  return (
    <Button
      ghost
      size="sm"
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={cn(
        "h-7 max-w-[9rem] min-w-0 shrink-0 px-2 py-0 text-xs font-normal normal-case tracking-normal",
        className,
      )}
      title={title || label}
      aria-label={title || `Model: ${label}`}
    >
      <span className="flex min-w-0 items-center gap-0.5">
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </span>
    </Button>
  );
}
