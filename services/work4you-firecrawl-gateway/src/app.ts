/**
 * Work4You Firecrawl tool gateway.
 *
 * Client (Firecrawl SDK) → Bearer (Portal token) → NAS authorize →
 * Firecrawl (platform key) → optional NAS debit.
 * FIRECRAWL_API_KEY never appears in client-facing auth or branding.
 */
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { cors } from 'hono/cors'

import type { InvokeClaims } from './auth.js'
import type { AuthorizeDenied, AuthorizeOk } from './billing.js'
import type { FirecrawlFetch } from './firecrawl.js'
import { creditsUsedFromJson, isAllowedFirecrawlRoute } from './paths.js'
import {
  checkAndConsumeRateLimit,
  type RateLimitConfig,
} from './rate-limit.js'

export type AppConfigView = {
  hasFirecrawlKey: boolean
  hasBillingSecret: boolean
  usdPerCredit: number
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
  firecrawlFetch: FirecrawlFetch
  rateLimit?: typeof checkAndConsumeRateLimit
}

type Variables = {
  claims: InvokeClaims
  requestId: string
  billing: AuthorizeOk
}
type AppEnv = { Variables: Variables }

function firecrawlError(
  c: Context<AppEnv>,
  status: 401 | 402 | 403 | 404 | 429 | 503,
  error: string,
  extra?: Record<string, unknown>,
) {
  return c.json({ success: false, error, ...extra }, status)
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>()
  const consumeRateLimit = deps.rateLimit || checkAndConsumeRateLimit

  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['Authorization', 'Content-Type', 'X-API-KEY'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  )

  app.get('/healthz', (c) =>
    c.json({
      status: 'ok',
      service: 'work4you-firecrawl-gateway',
      firecrawl: deps.config.hasFirecrawlKey,
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
      return firecrawlError(
        c,
        code,
        message,
      )
    }
  }

  async function requireBillingGates(c: Context<AppEnv>, next: Next) {
    const claims = c.get('claims')
    const authz = await deps.authorizeOrg(claims.orgId)
    if (!authz.allowed) {
      const status = (authz.status === 402 ? 402 : 503) as 402 | 503
      return firecrawlError(
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
      return firecrawlError(
        c,
        429,
        `Rate limit exceeded: ${rl.used}/${rl.limit} requests per minute`,
        { code: rl.code, limit: rl.limit, used: rl.used },
      )
    }

    await next()
  }

  async function proxyFirecrawl(c: Context<AppEnv>) {
    const method = c.req.method
    const path = new URL(c.req.url).pathname
    if (!isAllowedFirecrawlRoute(method, path)) {
      return firecrawlError(c, 404, 'Not found')
    }

    const claims = c.get('claims')
    const requestId = c.get('requestId')
    const bodyText = method === 'GET' ? undefined : await c.req.text()

    const upstream = await deps.firecrawlFetch(path, {
      method,
      body: bodyText,
    })

    const text = await upstream.text()
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }

    if (upstream.ok && json && deps.config.usdPerCredit > 0) {
      const credits = creditsUsedFromJson(json)
      const amountUsd = credits * deps.config.usdPerCredit
      if (amountUsd > 0) {
        void deps
          .debitOrg({
            orgId: claims.orgId,
            amountUsd,
            idempotencyKey: `fc:${requestId}`,
            purpose: `firecrawl:${path}`,
            apiKeyId: claims.apiKeyId,
          })
          .catch((err) => console.error('[debit] failed', err))
      }
    }

    return new Response(text, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') || 'application/json',
        'x-work4you-request-id': requestId,
      },
    })
  }

  app.use('/v1/*', requireInvoke)
  app.use('/v2/*', requireInvoke)

  app.use('/v1/*', async (c, next) => {
    if (!deps.config.hasFirecrawlKey) {
      return firecrawlError(
        c,
        503,
        'Web tools upstream is not configured (FIRECRAWL_API_KEY)',
      )
    }
    if (!deps.config.hasBillingSecret) {
      return firecrawlError(
        c,
        503,
        'Billing bridge is not configured (INFERENCE_BILLING_SECRET)',
      )
    }
    await next()
  })
  app.use('/v2/*', async (c, next) => {
    if (!deps.config.hasFirecrawlKey) {
      return firecrawlError(
        c,
        503,
        'Web tools upstream is not configured (FIRECRAWL_API_KEY)',
      )
    }
    if (!deps.config.hasBillingSecret) {
      return firecrawlError(
        c,
        503,
        'Billing bridge is not configured (INFERENCE_BILLING_SECRET)',
      )
    }
    await next()
  })

  app.use('/v1/*', requireBillingGates)
  app.use('/v2/*', requireBillingGates)

  app.all('/v1/*', proxyFirecrawl)
  app.all('/v2/*', proxyFirecrawl)

  app.notFound((c) => firecrawlError(c as Context<AppEnv>, 404, 'Not found'))

  return app
}
