/**
 * Work4You OpenAI audio tool gateway (STT + TTS).
 *
 * Client (OpenAI SDK) → Bearer (Portal token) → NAS authorize →
 * OpenAI (platform key) → optional NAS debit.
 * OPENAI_API_KEY never appears in client-facing auth or branding.
 */
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { cors } from 'hono/cors'

import type { InvokeClaims } from './auth.js'
import type { AuthorizeDenied, AuthorizeOk } from './billing.js'
import type { OpenAIFetch } from './openai.js'
import { isAllowedOpenAIAudioRoute, routePurpose } from './paths.js'
import { checkAndConsumeRateLimit } from './rate-limit.js'

export type AppConfigView = {
  hasOpenAIKey: boolean
  hasBillingSecret: boolean
  usdPerRequest: number
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
  openaiFetch: OpenAIFetch
  rateLimit?: typeof checkAndConsumeRateLimit
}

type Variables = {
  claims: InvokeClaims
  requestId: string
  billing: AuthorizeOk
}
type AppEnv = { Variables: Variables }

function openaiError(
  c: Context<AppEnv>,
  status: 401 | 402 | 403 | 404 | 429 | 503,
  message: string,
  extra?: Record<string, unknown>,
) {
  return c.json(
    {
      error: {
        message,
        type: 'invalid_request_error',
        code: extra?.code || message,
        ...extra,
      },
    },
    status,
  )
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>()
  const consumeRateLimit = deps.rateLimit || checkAndConsumeRateLimit

  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: [
        'Authorization',
        'Content-Type',
        'OpenAI-Beta',
        'X-Idempotency-Key',
      ],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  )

  app.get('/healthz', (c) =>
    c.json({
      status: 'ok',
      service: 'work4you-openai-audio-gateway',
      openai: deps.config.hasOpenAIKey,
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
      return openaiError(c, code, message)
    }
  }

  async function requireBillingGates(c: Context<AppEnv>, next: Next) {
    const claims = c.get('claims')
    const authz = await deps.authorizeOrg(claims.orgId)
    if (!authz.allowed) {
      const status = (authz.status === 402 ? 402 : 503) as 402 | 503
      return openaiError(
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
      return openaiError(
        c,
        429,
        `Rate limit exceeded: ${rl.used}/${rl.limit} requests per minute`,
        { code: rl.code, limit: rl.limit, used: rl.used },
      )
    }

    await next()
  }

  async function proxyOpenAI(c: Context<AppEnv>) {
    const method = c.req.method
    const path = new URL(c.req.url).pathname
    if (!isAllowedOpenAIAudioRoute(method, path)) {
      return openaiError(c, 404, 'Not found')
    }

    const claims = c.get('claims')
    const requestId = c.get('requestId')
    const incoming = new Headers()
    const contentType = c.req.header('content-type')
    if (contentType) incoming.set('content-type', contentType)
    const accept = c.req.header('accept')
    if (accept) incoming.set('accept', accept)
    const idempotency = c.req.header('x-idempotency-key')
    if (idempotency) incoming.set('x-idempotency-key', idempotency)
    const beta = c.req.header('openai-beta')
    if (beta) incoming.set('openai-beta', beta)

    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : await c.req.arrayBuffer()

    const upstream = await deps.openaiFetch(path, {
      method,
      body: body && body.byteLength > 0 ? body : undefined,
      headers: incoming,
    })

    if (upstream.ok && deps.config.usdPerRequest > 0) {
      void deps
        .debitOrg({
          orgId: claims.orgId,
          amountUsd: deps.config.usdPerRequest,
          idempotencyKey: `oai-audio:${requestId}`,
          purpose: routePurpose(path),
          apiKeyId: claims.apiKeyId,
        })
        .catch((err) => console.error('[debit] failed', err))
    }

    const outHeaders = new Headers()
    outHeaders.set(
      'content-type',
      upstream.headers.get('content-type') || 'application/json',
    )
    outHeaders.set('x-work4you-request-id', requestId)
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    })
  }

  app.use('/v1/*', requireInvoke)
  app.use('/v1/*', async (c, next) => {
    if (!deps.config.hasOpenAIKey) {
      return openaiError(
        c,
        503,
        'Audio upstream is not configured (OPENAI_API_KEY)',
      )
    }
    if (!deps.config.hasBillingSecret) {
      return openaiError(
        c,
        503,
        'Billing bridge is not configured (INFERENCE_BILLING_SECRET)',
      )
    }
    await next()
  })
  app.use('/v1/*', requireBillingGates)
  app.all('/v1/*', proxyOpenAI)

  app.notFound((c) => openaiError(c as Context<AppEnv>, 404, 'Not found'))

  return app
}
