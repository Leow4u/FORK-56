import { compactNumber } from '@/lib/format'
import type { ContextBreakdown, UsageStats } from '@/types/work4you'

/** Occupancy for the composer meter — 0% when the session has no max. */
export function contextUsagePercent(usage: Pick<UsageStats, 'context_percent'>): number {
  return Math.max(0, Math.min(100, Math.round(usage.context_percent ?? 0)))
}

export function contextUsagePercentLabel(usage: Pick<UsageStats, 'context_percent'>): string {
  return `${contextUsagePercent(usage)}%`
}

/** Hover line for the circular chip — percent plus used/max when the window is known. */
export function contextUsageOccupancyTip(
  usage: Pick<UsageStats, 'context_max' | 'context_percent' | 'context_used'>,
  tokenSummary: (used: string, max: string) => string
): string {
  const percent = contextUsagePercentLabel(usage)

  if (!usage.context_max) {
    return percent
  }

  return `${percent} · ${tokenSummary(`~${compactNumber(usage.context_used ?? 0)}`, compactNumber(usage.context_max))}`
}

/** Same merge the statusbar gauge uses: breakdown wins when present. */
export function mergeContextGaugeUsage(usage: UsageStats, breakdown: ContextBreakdown | null): UsageStats {
  if (!breakdown) {
    return usage
  }

  return {
    ...usage,
    context_max: breakdown.context_max,
    context_percent: breakdown.context_percent,
    context_used: breakdown.context_used
  }
}
