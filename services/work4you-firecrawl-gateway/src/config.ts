/** Runtime config for the Firecrawl tool gateway. */

function required(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`${name} is not set`)
  return v
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback
}

export const config = {
  port: Number(process.env.PORT || 8080),
  portalIssuer: optional('PORTAL_ISSUER', 'https://portal.work4you.ai'),
  portalBillingBaseUrl: optional(
    'PORTAL_BILLING_BASE_URL',
    'https://portal.work4you.ai',
  ).replace(/\/$/, ''),
  firecrawlApiUrl: optional(
    'FIRECRAWL_API_URL',
    'https://api.firecrawl.dev',
  ).replace(/\/$/, ''),
  get firecrawlApiKey(): string {
    return required('FIRECRAWL_API_KEY')
  },
  hasFirecrawlKey(): boolean {
    return Boolean(process.env.FIRECRAWL_API_KEY?.trim())
  },
  get inferenceBillingSecret(): string {
    return required('INFERENCE_BILLING_SECRET')
  },
  hasBillingSecret(): boolean {
    return Boolean(process.env.INFERENCE_BILLING_SECRET?.trim())
  },
  /** NAS debit per Firecrawl credit. 0 = authorize-only (no invented price). */
  usdPerCredit(): number {
    const raw = process.env.FIRECRAWL_USD_PER_CREDIT?.trim()
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 0
  },
  timeoutMs(): number {
    const raw = process.env.FIRECRAWL_TIMEOUT_MS?.trim()
    const n = raw ? Number(raw) : 90_000
    return Number.isFinite(n) && n > 0 ? n : 90_000
  },
}
