import type { ContextBreakdown } from "./context-breakdown";

interface ContextUsagePanelProps {
  breakdown: ContextBreakdown | null;
  loading: boolean;
  contextMax: number;
  contextUsed: number;
  contextPercent: number;
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

export function ContextUsagePanel({
  breakdown,
  loading,
  contextMax,
  contextUsed,
  contextPercent,
}: ContextUsagePanelProps) {
  const categories = breakdown?.categories ?? [];
  const segmentTotal =
    categories.reduce((sum, category) => sum + category.tokens, 0) ||
    contextUsed ||
    1;
  const percent = Math.max(0, Math.min(100, Math.round(contextPercent)));

  return (
    <div className="flex w-72 flex-col gap-3 p-3 text-xs" data-slot="context-usage-panel">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-foreground">Context usage</p>
        <span className="text-[0.6875rem] text-muted-foreground">
          ~{compactNumber(contextUsed)} / {compactNumber(contextMax)} tok
        </span>
      </div>

      <p className="text-[0.6875rem] text-foreground">{percent}% full</p>

      <div
        className="flex h-1.5 overflow-hidden rounded-full bg-border/50"
        data-slot="context-usage-bar"
      >
        {categories.map((category) => (
          <span
            className="h-full min-w-px"
            key={category.id}
            style={{
              background: category.color,
              width: `${(category.tokens / segmentTotal) * 100}%`,
            }}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-1.5">
        {categories.map((category) => (
          <li className="flex items-center justify-between gap-2" key={category.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: category.color }}
              />
              <span className="truncate text-muted-foreground">{category.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-foreground">
              {compactNumber(category.tokens)}
            </span>
          </li>
        ))}
      </ul>

      {loading && categories.length === 0 ? (
        <p className="text-[0.6875rem] text-muted-foreground">Loading…</p>
      ) : null}

      {!loading && categories.length === 0 ? (
        <p className="text-[0.6875rem] text-muted-foreground">No context data yet</p>
      ) : null}
    </div>
  );
}
