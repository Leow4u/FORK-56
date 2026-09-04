/** Runtime config for the OpenAI audio tool gateway (STT + TTS). */

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
  openaiApiUrl: optional('OPENAI_API_URL', 'https://api.openai.com').replace(
    /\/$/,
    '',
  ),
  get openaiApiKey(): string {
    return required('OPENAI_API_KEY')
  },
  hasOpenAIKey(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim())
  },
  get inferenceBillingSecret(): string {
    return required('INFERENCE_BILLING_SECRET')
  },
  hasBillingSecret(): boolean {
    return Boolean(process.env.INFERENCE_BILLING_SECRET?.trim())
  },
  /** NAS debit per successful audio call. 0 = authorize-only (no invented price). */
  usdPerRequest(): number {
    const raw = process.env.OPENAI_AUDIO_USD_PER_REQUEST?.trim()
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 0
  },
  timeoutMs(): number {
    const raw = process.env.OPENAI_AUDIO_TIMEOUT_MS?.trim()
    const n = raw ? Number(raw) : 120_000
    return Number.isFinite(n) && n > 0 ? n : 120_000
  },
}
