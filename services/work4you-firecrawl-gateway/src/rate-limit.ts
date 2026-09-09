/**
 * Per-org sliding-window rate limits (same table as work4you-inference-api).
 * In-process — fine for a single Fly machine.
 */

export type RateLimitConfig = { rpm: number; tpm: number }

export const DEFAULT_TIER_RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: { rpm: 50, tpm: 500_000 },
  plus: { rpm: 400, tpm: 4_000_000 },
  super: { rpm: 800, tpm: 8_000_000 },
  ultra: { rpm: 1_600, tpm: 16_000_000 },
}

type Sample = { at: number; tokens: number }

const windows = new Map<string, Sample[]>()
const WINDOW_MS = 60_000

function prune(samples: Sample[], now: number): Sample[] {
  return samples.filter((s) => now - s.at < WINDOW_MS)
}

export type RateLimitResult =
  | { ok: true }
  | {
      ok: false
      code: 'rate_limit_rpm' | 'rate_limit_tpm'
      limit: number
      used: number
      retryAfterSec: number
    }

export function checkAndConsumeRateLimit(params: {
  orgId: string
  limit: RateLimitConfig
  estimatedTokens: number
}): RateLimitResult {
  const now = Date.now()
  const prev = prune(windows.get(params.orgId) || [], now)
  const rpmUsed = prev.length
  const tpmUsed = prev.reduce((a, s) => a + s.tokens, 0)

  if (rpmUsed >= params.limit.rpm) {
    const oldest = prev[0]?.at || now
    return {
      ok: false,
      code: 'rate_limit_rpm',
      limit: params.limit.rpm,
      used: rpmUsed,
      retryAfterSec: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    }
  }

  const nextTokens = Math.max(0, Math.floor(params.estimatedTokens))
  if (tpmUsed + nextTokens > params.limit.tpm) {
    const oldest = prev[0]?.at || now
    return {
      ok: false,
      code: 'rate_limit_tpm',
      limit: params.limit.tpm,
      used: tpmUsed,
      retryAfterSec: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    }
  }

  prev.push({ at: now, tokens: nextTokens })
  windows.set(params.orgId, prev)
  return { ok: true }
}

/** Test helper — drop in-memory windows. */
export function resetRateLimitWindows(): void {
  windows.clear()
}
