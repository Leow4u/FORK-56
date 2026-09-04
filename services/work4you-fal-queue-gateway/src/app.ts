/**
 * Work4You FAL queue tool gateway.
 *
 * Client (fal_client) → Key/Bearer (Portal token) → NAS authorize (submit)
 * → FAL queue (platform FAL_KEY) → optional NAS debit on result.
 * FAL_KEY never appears in client-facing auth or branding.
 */
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { cors } from 'hono/cors'

import type { InvokeClaims } from './auth.js'
import type { AuthorizeDenied, AuthorizeOk } from './billing.js'
import type { FalFetch } from './fal.js'
import {
  falRequestIdFromRest,
  isAllowedFalRoute,
  parseFalQueueRoute,
  rewriteQueueUrls,
} from './paths.js'
import { checkAndConsumeRateLimit } from './rate-limit.js'

export type AppConfigView = {
  hasFalKey: boolean
  hasBillingSecret: boolean
  usdPerRequest: number
  falQueueUrl: string
}

export type AppDeps = {
  config: AppConfigView
  verifyBearer: (authorization: string | undefined) => Promise<InvokeClaims>
  authorizeOrg: (orgId: string) => Promise<AuthorizeOk | AuthorizeDenied>
  debitOrg: (params: {
    orgId: string
    amountUsd: number
    idempotencyKey: string
    purpose?: string
    apiKeyId?: string | null
  }) => Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>
  falFetch: FalFetch
  rateLimit?: typeof checkAndConsumeRateLimit
}

type Variables = {
  claims: InvokeClaims
  requestId: string
  billing: AuthorizeOk | null
}
type AppEnv = { Variables: Variables }

function falError(
  c: Context<AppEnv>,
  status: 401 | 402 | 403 | 404 | 429 | 503,
  error: string,
  extra?: Record<string, unknown>,
) {
  return c.json({ success: false, error, ...extra }, status)
}

function isHealthPath(pathname: string): boolean {
  return pathname === '/healthz' || pathname === '/health/liveliness'
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>()
  const consumeRateLimit = deps.rateLimit || checkAndConsumeRateLimit

  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['Authorization', 'Content-Type', 'X-API-KEY', 'X-Idempotency-Key'],
      allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    }),
  )

  app.get('/healthz', (c) =>
    c.json({
      status: 'ok',
      service: 'work4you-fal-queue-gateway',
      fal: deps.config.hasFalKey,
      billing: deps.config.hasBillingSecret,
    }),
  )
  app.get('/health/liveliness', (c) => c.json({ status: "I'm alive!" }))

  async function requireInvoke(c: Context<AppEnv>, next: Next) {
    try {
      const claims = await deps.verifyBearer(c.req.header('authorization'))
      c.set('claims', claims)
      c.set('requestId', randomUUID())
      await next()
    } catch (err) {
      const status = (err as { status?: number }).status || 401
      const message = err instanceof Error ? err.message : 'unauthorized'
      const code = status === 403 ? 403 : status === 503 ? 503 : 401
      return falError(c, code, message)
    }
  }

  async function requireConfigured(c: Context<AppEnv>, next: Next) {
    if (!deps.config.hasFalKey) {
      return falError(
        c,
        503,
        'Image generation upstream is not configured (FAL_KEY)',
      )
    }
    if (!deps.config.hasBillingSecret) {
      return falError(
        c,
        503,
        'Billing bridge is not configured (INFERENCE_BILLING_SECRET)',
      )
    }
    await next()
  }

  async function requireBillingOnSubmit(c: Context<AppEnv>, next: Next) {
    const route = parseFalQueueRoute(
      c.req.method,
      new URL(c.req.url).pathname,
      new URL(c.req.url).search,
    )
    if (!route || route.kind !== 'submit') {
      c.set('billing', null)
      return next()
    }

    const claims = c.get('claims')
    const authz = await deps.authorizeOrg(claims.orgId)
    if (!authz.allowed) {
      const status = (authz.status === 402 ? 402 : 503) as 402 | 503
      return falError(
        c,
        status,
        (typeof authz.body.message === 'string' && authz.body.message) ||
          'Account has no usable credits',
        { code: 'no_usable_credits', ...authz.body },
      )
    }
    c.set('billing', authz)

    const rl = consumeRateLimit({
      orgId: claims.orgId,
      limit: authz.rateLimit,
      estimatedTokens: 0,
    })
    if (!rl.ok) {
      c.header('Retry-After', String(rl.retryAfterSec))
      return falError(
        c,
        429,
        `Rate limit exceeded: ${rl.used}/${rl.limit} requests per minute`,
        { code: rl.code, limit: rl.limit, used: rl.used },
      )
    }

    await next()
  }

  async function proxyFal(c: Context<AppEnv>) {
    const method = c.req.method
    const url = new URL(c.req.url)
    const path = url.pathname
    const route = parseFalQueueRoute(method, path, url.search)
    if (!route) {
      return falError(c, 404, 'Not found')
    }

    const claims = c.get('claims')
    const requestId = c.get('requestId')
    const bodyText = method === 'GET' || method === 'HEAD' ? undefined : await c.req.text()
    const incoming = new Headers()
    const contentType = c.req.header('content-type')
    if (contentType) incoming.set('content-type', contentType)
    const idempotency = c.req.header('x-idempotency-key')
    if (idempotency) incoming.set('x-idempotency-key', idempotency)
    const accept = c.req.header('accept')
    if (accept) incoming.set('accept', accept)

    const upstreamPath = path + url.search
    const upstream = await deps.falFetch(upstreamPath, {
      method,
      body: bodyText,
      headers: incoming,
    })

    const text = await upstream.text()
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }

    const rewritten =
      json !== null
        ? rewriteQueueUrls(
            json,
            deps.config.falQueueUrl,
            `${url.protocol}//${url.host}`,
          )
        : null

    if (
      upstream.ok &&
      route.kind === 'result' &&
      deps.config.usdPerRequest > 0
    ) {
      const falId = falRequestIdFromRest(route.rest) || requestId
      void deps
        .debitOrg({
          orgId: claims.orgId,
          amountUsd: deps.config.usdPerRequest,
          idempotencyKey: `fal:${route.app}:${falId}`,
          purpose: `fal-queue:${route.app}`,
          apiKeyId: claims.apiKeyId,
        })
        .catch((err) => console.error('[debit] failed', err))
    }

    const outBody =
      rewritten !== null ? JSON.stringify(rewritten) : text
    return new Response(outBody, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') || 'application/json',
        'x-work4you-request-id': requestId,
      },
    })
  }

  app.use('*', async (c, next) => {
    if (isHealthPath(new URL(c.req.url).pathname)) return next()
    return requireInvoke(c, next)
  })
  app.use('*', async (c, next) => {
    if (isHealthPath(new URL(c.req.url).pathname)) return next()
    const url = new URL(c.req.url)
    if (!isAllowedFalRoute(c.req.method, url.pathname, url.search)) {
      return falError(c, 404, 'Not found')
    }
    await next()
  })
  app.use('*', async (c, next) => {
    if (isHealthPath(new URL(c.req.url).pathname)) return next()
    return requireConfigured(c, next)
  })
  app.use('*', async (c, next) => {
    if (isHealthPath(new URL(c.req.url).pathname)) return next()
    return requireBillingOnSubmit(c, next)
  })

  app.all('*', async (c) => {
    if (isHealthPath(new URL(c.req.url).pathname)) {
      return c.notFound()
    }
    return proxyFal(c)
  })

  app.notFound((c) => falError(c as Context<AppEnv>, 404, 'Not found'))

  return app
}
