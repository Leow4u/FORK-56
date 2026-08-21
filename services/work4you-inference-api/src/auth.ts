/**
 * Verify Portal OAuth invoke JWTs via JWKS.
 * Claims we need: org_id, scope containing inference:invoke.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { config } from './config.js'

export type InvokeClaims = {
  sub: string
  orgId: string
  sessionId: string | null
  scope: string
  clientId: string | null
  paidAccess: boolean | null
  subscriptionTier: number | null
  jti: string | null
  raw: JWTPayload
}

const jwks = createRemoteJWKSet(
  new URL(`${config.portalIssuer.replace(/\/$/, '')}/.well-known/jwks.json`),
)

function scopeList(scope: unknown): string[] {
  if (typeof scope !== 'string') return []
  return scope.split(/\s+/).filter(Boolean)
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

  // Static Portal API keys (sk-…) land in a later fatia — reject for now
  // with a clear signal so clients don't confuse with OR BYOK.
  if (token.startsWith('sk-')) {
    throw Object.assign(new Error('static_api_keys_not_enabled'), {
      status: 401,
    })
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

  return {
    sub,
    orgId,
    sessionId:
      typeof payload.session_id === 'string' ? payload.session_id : null,
    scope: scopes.join(' '),
    clientId:
      typeof payload.client_id === 'string'
        ? payload.client_id
        : typeof payload.aud === 'string'
          ? payload.aud
          : null,
    paidAccess:
      typeof payload.paid_access === 'boolean' ? payload.paid_access : null,
    subscriptionTier:
      typeof payload.subscription_tier === 'number'
        ? payload.subscription_tier
        : null,
    jti: typeof payload.jti === 'string' ? payload.jti : null,
    raw: payload,
  }
}
