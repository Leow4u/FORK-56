/** Runtime config for the inference gateway. */

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
  openRouterBaseUrl: optional(
    'OPENROUTER_BASE_URL',
    'https://openrouter.ai/api/v1',
  ).replace(/\/$/, ''),
  /** Platform OpenRouter key — never exposed to clients. Lazy so /healthz boots. */
  get openRouterApiKey(): string {
    return required('OPENROUTER_API_KEY')
  },
  hasOpenRouterKey(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY?.trim())
  },
  /** Shared secret with NAS /api/internal/billing/* */
  get inferenceBillingSecret(): string {
    return required('INFERENCE_BILLING_SECRET')
  },
  hasBillingSecret(): boolean {
    return Boolean(process.env.INFERENCE_BILLING_SECRET?.trim())
  },
  /** Optional HTTP-Referer / X-Title for OpenRouter rankings. */
  openRouterHttpReferer: optional(
    'OPENROUTER_HTTP_REFERER',
    'https://portal.work4you.ai',
  ),
  openRouterXTitle: optional('OPENROUTER_X_TITLE', 'Work4You Portal'),
}
