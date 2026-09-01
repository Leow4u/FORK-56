/** Runtime config for the Work4You Apps connector broker. */

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback
}

export const config = {
  port: Number(process.env.PORT || 8080),
  portalIssuer: optional('PORTAL_ISSUER', 'https://portal.work4you.ai'),
  publicBaseUrl: optional(
    'PUBLIC_BASE_URL',
    'https://connectors-api.work4you.ai',
  ).replace(/\/$/, ''),
  composioApiBase: optional(
    'COMPOSIO_API_BASE',
    'https://backend.composio.dev',
  ).replace(/\/$/, ''),
  get composioApiKey(): string {
    const v = process.env.COMPOSIO_API_KEY?.trim()
    if (!v) throw new Error('COMPOSIO_API_KEY is not set')
    return v
  },
  hasComposioKey(): boolean {
    return Boolean(process.env.COMPOSIO_API_KEY?.trim())
  },
  /** Optional per-toolkit Composio auth config ids: COMPOSIO_AUTH_GMAIL=ac_… */
  authConfigId(slug: string): string | undefined {
    const key = `COMPOSIO_AUTH_${slug.replace(/[^a-z0-9]/gi, '').toUpperCase()}`
    const value = process.env[key]?.trim()
    return value || undefined
  },
}
