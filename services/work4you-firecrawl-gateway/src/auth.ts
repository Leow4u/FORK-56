/**
 * Verify Portal OAuth JWTs via JWKS, or static sk-work4you-… API keys
 * via NAS /api/internal/api-keys/resolve — same path as inference-api.
 *
 * Tool calls from the agent send the Portal access token as the Firecrawl
 * SDK api_key (Bearer). Default login scope is inference:invoke; device
 * step-up also requests tool:invoke. Either scope is enough here so an
 * existing Portal login already works.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { config } from './config.js'

export const TOOL_INVOKE_SCOPE = 'tool:invoke'
export const INFERENCE_INVOKE_SCOPE = 'inference:invoke'

export type InvokeClaims = {
  sub: string
  orgId: string
  sessionId: string | null
  apiKeyId: string | null
  scope: string
  clientId: string | null
  paidAccess: boolean | null
  paidPlan: boolean | null
  subscriptionTier: number | null
  jti: string | null
  raw: JWTPayload
  via: 'jwt' | 'api_key'
}

const jwks = createRemoteJWKSet(
  new URL(`${config.portalIssuer.replace(/\/$/, '')}/.well-known/jwks.json`),
)

export function scopeList(scope: unknown): string[] {
  if (typeof scope !== 'string') return []
  return scope.split(/\s+/).filter(Boolean)
}

export function hasGatewayScope(scopes: string[]): boolean {
  return scopes.includes(TOOL_INVOKE_SCOPE) || scopes.includes(INFERENCE_INVOKE_SCOPE)
}

/**
 * Paid Portal access always covers Firecrawl. Free tool-pool coverage is
 * the JWT `tool_access.coverage.firecrawl` flag (same map as
 * work4you_cli.work4you_account.TOOL_COVERAGE_CATEGORIES). Missing claims
 * fail open to the NAS credit wall — do not invent a second entitlement.
 */
export function isFirecrawlCovered(
  payload: JWTPayload,
  paidAccess: boolean | null,
): boolean {
  if (paidAccess === true) return true
  const ta = payload.tool_access
  if (!ta || typeof ta !== 'object') return true
  const rec = ta as Record<string, unknown>
  if (rec.enabled === true) {
    const coverage = rec.coverage
    if (coverage && typeof coverage === 'object') {
      const firecrawl = (coverage as Record<string, unknown>).firecrawl
      if (firecrawl === false) return false
    }
    return true
  }
  if (rec.enabled === false && paidAccess === false) return false
  return true
}

async function resolveStaticApiKey(token: string): Promise<InvokeClaims> {
  const res = await fetch(
    `${config.portalBillingBaseUrl}/api/internal/api-keys/resolve`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.inferenceBillingSecret}`,
        'x-work4you-billing-key': config.inferenceBillingSecret,
      },
      body: JSON.stringify({ token }),
    },
  )
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw Object.assign(new Error('invalid_api_key'), { status: 401 })
  }
  const orgId = typeof body.orgId === 'string' ? body.orgId : ''
  const keyId = typeof body.keyId === 'string' ? body.keyId : ''
  if (!orgId || !keyId) {
    throw Object.assign(new Error('invalid_api_key'), { status: 401 })
  }
  const paidPlan =
    typeof body.paid_plan === 'boolean'
      ? body.paid_plan
      : typeof body.subscription_tier === 'number'
        ? body.subscription_tier > 0
        : null
  return {
    sub: `api_key:${keyId}`,
    orgId,
    sessionId: null,
    apiKeyId: keyId,
    scope: `${INFERENCE_INVOKE_SCOPE} ${TOOL_INVOKE_SCOPE}`,
    clientId: 'portal-api-key',
    paidAccess:
      typeof body.paid_access === 'boolean' ? body.paid_access : null,
    paidPlan,
    subscriptionTier:
      typeof body.subscription_tier === 'number'
        ? body.subscription_tier
        : null,
    jti: keyId,
    raw: body as JWTPayload,
    via: 'api_key',
  }
}

export async function verifyInvokeBearer(
  authorization: string | undefined,
): Promise<InvokeClaims> {
  if (!authorization?.startsWith('Bearer ')) {
    throw Object.assign(new Error('missing_bearer'), { status: 401 })
  }
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) {
    throw Object.assign(new Error('missing_bearer'), { status: 401 })
  }

  if (token.startsWith('sk-')) {
    if (!token.startsWith('sk-work4you-')) {
      throw Object.assign(new Error('invalid_api_key'), { status: 401 })
    }
    if (!config.hasBillingSecret()) {
      throw Object.assign(new Error('billing_not_configured'), { status: 503 })
    }
    return resolveStaticApiKey(token)
  }

  let payload: JWTPayload
  try {
    const verified = await jwtVerify(token, jwks, {
      issuer: config.portalIssuer,
    })
    payload = verified.payload
  } catch {
    throw Object.assign(new Error('invalid_token'), { status: 401 })
  }

  const scopes = scopeList(payload.scope)
  if (!hasGatewayScope(scopes)) {
    throw Object.assign(new Error('insufficient_scope'), { status: 403 })
  }

  const orgId =
    (typeof payload.org_id === 'string' && payload.org_id) ||
    (typeof payload.orgId === 'string' && payload.orgId) ||
    ''
  if (!orgId) {
    throw Object.assign(new Error('missing_org'), { status: 401 })
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  if (!sub) {
    throw Object.assign(new Error('missing_sub'), { status: 401 })
  }

  const subscriptionTier =
    typeof payload.subscription_tier === 'number'
      ? payload.subscription_tier
      : null
  const paidAccess =
    typeof payload.paid_access === 'boolean' ? payload.paid_access : null

  if (!isFirecrawlCovered(payload, paidAccess)) {
    throw Object.assign(new Error('firecrawl_not_covered'), { status: 403 })
  }

  return {
    sub,
    orgId,
    sessionId:
      typeof payload.session_id === 'string' ? payload.session_id : null,
    apiKeyId: null,
    scope: scopes.join(' '),
    clientId:
      typeof payload.client_id === 'string'
        ? payload.client_id
        : typeof payload.aud === 'string'
          ? payload.aud
          : null,
    paidAccess,
    paidPlan: subscriptionTier != null ? subscriptionTier > 0 : null,
    subscriptionTier,
    jti: typeof payload.jti === 'string' ? payload.jti : null,
    raw: payload,
    via: 'jwt',
  }
}
