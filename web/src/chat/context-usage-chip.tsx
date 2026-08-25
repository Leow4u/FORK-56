import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { composerFloatingPill } from "./composer-dock-styles";
import type { ContextBreakdown } from "./context-breakdown";
import { contextMeterLabel } from "./context-breakdown";
import { ContextUsagePanel } from "./context-usage-panel";

export interface ContextUsageChipProps {
  breakdown: ContextBreakdown | null;
  loading: boolean;
  contextMax: number;
  contextUsed: number;
  contextPercent: number;
  total: number;
  busy?: boolean;
  className?: string;
}

function ContextRing({ percent }: { percent: number }) {
  const bounded = Math.max(0, Math.min(100, percent));
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (bounded / 100) * circumference;

  return (
    <svg
      className="h-4 w-4 shrink-0 -rotate-90"
      viewBox="0 0 18 18"
      aria-hidden
    >
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        className="stroke-border/60"
        strokeWidth="2"
      />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        className="stroke-primary"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ContextUsageChip({
  breakdown,
  loading,
  contextMax,
  contextUsed,
  contextPercent,
  total,
  busy = false,
  className,
}: ContextUsageChipProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const label = contextMeterLabel({
    contextMax,
    contextUsed,
    contextPercent,
    total,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      const panel = document.getElementById(panelId);
      if (panel?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, panelId]);

  const rect = open ? buttonRef.current?.getBoundingClientRect() : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          composerFloatingPill,
          "ml-auto tabular-nums",
          className,
        )}
        title="Session context usage"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {busy && contextMax <= 0 ? (
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-primary/60" />
        ) : contextMax > 0 ? (
          <ContextRing percent={contextPercent} />
        ) : null}
        <span className="text-[0.6875rem]">{label}</span>
      </button>

      {open && rect
        ? createPortal(
            <div
              id={panelId}
              role="dialog"
              aria-label="Context usage"
              className="fixed z-[200] rounded-2xl border border-border/65 bg-background/95 shadow-lg backdrop-blur-md"
              style={{
                bottom: window.innerHeight - rect.top + 8,
                right: Math.max(8, window.innerWidth - rect.right),
              }}
            >
              <ContextUsagePanel
                breakdown={breakdown}
                loading={loading}
                contextMax={contextMax}
                contextUsed={contextUsed}
                contextPercent={contextPercent}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
