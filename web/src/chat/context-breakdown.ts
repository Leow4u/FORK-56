export interface ContextUsageCategory {
  color: string;
  id: string;
  label: string;
  tokens: number;
}

export interface ContextBreakdown {
  categories: ContextUsageCategory[];
  context_max: number;
  context_percent: number;
  context_used: number;
  estimated_total: number;
  model?: string;
}

export function parseContextBreakdown(payload: unknown): ContextBreakdown | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const categories = Array.isArray(p.categories)
    ? p.categories
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const c = row as Record<string, unknown>;
          if (typeof c.id !== "string" || typeof c.label !== "string") {
            return null;
          }
          return {
            id: c.id,
            label: c.label,
            color: typeof c.color === "string" ? c.color : "var(--primary)",
            tokens: typeof c.tokens === "number" ? c.tokens : 0,
          };
        })
        .filter((c): c is ContextUsageCategory => c !== null)
    : [];

  return {
    categories,
    context_max: typeof p.context_max === "number" ? p.context_max : 0,
    context_percent: typeof p.context_percent === "number" ? p.context_percent : 0,
    context_used: typeof p.context_used === "number" ? p.context_used : 0,
    estimated_total:
      typeof p.estimated_total === "number" ? p.estimated_total : 0,
    model: typeof p.model === "string" ? p.model : undefined,
  };
}

export function mergeGaugeUsage(
  usage: {
    total?: number;
    contextMax?: number;
    contextUsed?: number;
    contextPercent?: number;
  } | null,
  breakdown: ContextBreakdown | null,
): {
  contextMax: number;
  contextUsed: number;
  contextPercent: number;
  total: number;
} {
  if (breakdown) {
    return {
      contextMax: breakdown.context_max,
      contextUsed: breakdown.context_used,
      contextPercent: breakdown.context_percent,
      total: usage?.total ?? 0,
    };
  }
  return {
    contextMax: usage?.contextMax ?? 0,
    contextUsed: usage?.contextUsed ?? usage?.total ?? 0,
    contextPercent: usage?.contextPercent ?? 0,
    total: usage?.total ?? 0,
  };
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

export function contextMeterLabel(gauge: {
  contextMax: number;
  contextUsed: number;
  contextPercent: number;
  total: number;
}): string {
  if (gauge.contextMax > 0) {
    return `${Math.round(gauge.contextPercent)}%`;
  }
  if (gauge.total > 0) return `${compactNumber(gauge.total)} tok`;
  return "—";
}
