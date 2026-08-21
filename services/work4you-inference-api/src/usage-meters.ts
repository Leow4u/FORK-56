/** Parse OpenRouter usage → Portal Usage meters (Hermes cards). */

export type UsageMeters = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

function asNonNegInt(n: unknown): number {
  const v = Math.floor(Number(n))
  return Number.isFinite(v) && v > 0 ? v : 0
}

export function emptyUsageMeters(): UsageMeters {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
}

export function metersHaveTokens(m: UsageMeters): boolean {
  return (
    m.inputTokens > 0 ||
    m.outputTokens > 0 ||
    m.cacheReadTokens > 0 ||
    m.cacheWriteTokens > 0
  )
}

export function metersFromOpenRouterUsage(
  usage: Record<string, unknown> | null | undefined,
): UsageMeters {
  if (!usage) return emptyUsageMeters()
  const details =
    usage.prompt_tokens_details &&
    typeof usage.prompt_tokens_details === 'object'
      ? (usage.prompt_tokens_details as Record<string, unknown>)
      : null
  return {
    inputTokens: asNonNegInt(usage.prompt_tokens),
    outputTokens: asNonNegInt(usage.completion_tokens),
    cacheReadTokens: asNonNegInt(
      details?.cached_tokens ?? usage.cache_read_tokens,
    ),
    cacheWriteTokens: asNonNegInt(
      details?.cache_write_tokens ?? usage.cache_write_tokens,
    ),
  }
}
