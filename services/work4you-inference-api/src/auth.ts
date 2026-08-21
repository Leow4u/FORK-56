/**
 * Verify Portal OAuth invoke JWTs via JWKS, or static sk-work4you-… API keys
 * via NAS /api/internal/api-keys/resolve.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { config } from './config.js'

export type InvokeClaims = {
  sub: string
  orgId: string
  sessionId: string | null
  apiKeyId: string | null
  scope: string
  clientId: string | null
  paidAccess: boolean | null
  /** True when org is on Plus/Super/Ultra (not Free plan). */
  paidPlan: boolean | null
  subscriptionTier: number | null
  tierId: string | null
  jti: string | null
  raw: JWTPayload
  via: 'jwt' | 'api_key'
}

const jwks = createRemoteJWKSet(
  new URL(`${config.portalIssuer.replace(/\/$/, '')}/.well-known/jwks.json`),
)

function scopeList(scope: unknown): string[] {
  if (typeof scope !== 'string') return []
  return scope.split(/\s+/).filter(Boolean)
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
    scope: 'inference:invoke',
    clientId: 'portal-api-key',
    paidAccess:
      typeof body.paid_access === 'boolean' ? body.paid_access : null,
    paidPlan,
    subscriptionTier:
      typeof body.subscription_tier === 'number'
        ? body.subscription_tier
        : null,
    tierId: typeof body.tier_id === 'string' ? body.tier_id : null,
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
  if (!scopes.includes('inference:invoke')) {
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
    paidAccess:
      typeof payload.paid_access === 'boolean' ? payload.paid_access : null,
    paidPlan:
      subscriptionTier != null ? subscriptionTier > 0 : null,
    subscriptionTier,
    tierId: null,
    jti: typeof payload.jti === 'string' ? payload.jti : null,
    raw: payload,
    via: 'jwt',
  }
}
