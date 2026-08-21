/**
 * Per-org sliding-window rate limits (Hermes Portal RPM / TPM).
 * In-process — fine for single Fly machine; multi-machine needs Redis later.
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
  /** Estimated tokens for this request (prompt ≈ + max_tokens). */
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

/** Adjust last sample to actual usage when known (optional bookkeeping). */
export function reconcileRateLimitTokens(params: {
  orgId: string
  estimatedTokens: number
  actualTokens: number
}): void {
  const now = Date.now()
  const prev = prune(windows.get(params.orgId) || [], now)
  for (let i = prev.length - 1; i >= 0; i--) {
    if (prev[i].tokens === params.estimatedTokens) {
      prev[i].tokens = Math.max(0, Math.floor(params.actualTokens))
      break
    }
  }
  windows.set(params.orgId, prev)
}

export function estimateRequestTokens(body: unknown): number {
  if (!body || typeof body !== 'object') return 256
  const b = body as Record<string, unknown>
  const maxOut = Number(b.max_tokens || b.max_completion_tokens || 1024)
  const out = Number.isFinite(maxOut) ? Math.min(Math.max(maxOut, 1), 128_000) : 1024

  let promptChars = 0
  if (typeof b.prompt === 'string') promptChars += b.prompt.length
  if (Array.isArray(b.messages)) {
    for (const m of b.messages as Array<Record<string, unknown>>) {
      const c = m.content
      if (typeof c === 'string') promptChars += c.length
      else if (Array.isArray(c)) promptChars += JSON.stringify(c).length
    }
  }
  // ~4 chars/token heuristic
  const promptTokens = Math.ceil(promptChars / 4)
  return promptTokens + out
}
