/**
 * Portal JWT verification for the connectors broker.
 *
 * Isolation key is `sub`. Static `sk-work4you-…` keys are rejected: those
 * mint `api_key:…` identities and would mix people in Composio.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { config } from './config.js'

export type ConnectorClaims = {
  sub: string
  orgId: string | null
  raw: JWTPayload
}

const jwks = createRemoteJWKSet(
  new URL(`${config.portalIssuer.replace(/\/$/, '')}/.well-known/jwks.json`),
)

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function verifyPortalBearer(
  authorization: string | undefined,
): Promise<ConnectorClaims> {
  if (!authorization?.startsWith('Bearer ')) {
    throw new AuthError('missing_bearer', 401)
  }
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) {
    throw new AuthError('missing_bearer', 401)
  }
  if (token.startsWith('sk-')) {
    throw new AuthError('api_keys_not_supported', 401)
  }

  let payload: JWTPayload
  try {
    const verified = await jwtVerify(token, jwks, {
      issuer: config.portalIssuer,
    })
    payload = verified.payload
  } catch {
    throw new AuthError('invalid_token', 401)
  }

  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  if (!sub || sub === 'default') {
    throw new AuthError('missing_sub', 401)
  }

  const orgId =
    (typeof payload.org_id === 'string' && payload.org_id) ||
    (typeof payload.orgId === 'string' && payload.orgId) ||
    null

  return { sub, orgId, raw: payload }
}
