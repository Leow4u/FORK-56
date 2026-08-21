/**
 * Work4You inference-api — Hermes-equivalent OpenAI-compatible gateway.
 *
 * Client → Bearer (Portal invoke JWT) → authorize NAS → OpenRouter (platform key)
 * → debit NAS. OpenRouter never appears in client-facing auth or branding.
 */
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { cors } from 'hono/cors'
import { randomUUID } from 'node:crypto'
import { verifyInvokeBearer, type InvokeClaims } from './auth.js'
import {
  authorizeOrg,
  costUsdFromUsage,
  debitOrg,
  type AuthorizeOk,
} from './billing.js'
import { config } from './config.js'
import { isModelFreeForPlan } from './model-access.js'
import { getModelPricing, openRouterFetch } from './openrouter.js'
import {
  checkAndConsumeRateLimit,
  estimateRequestTokens,
  reconcileRateLimitTokens,
} from './rate-limit.js'
import { metersFromOpenRouterUsage } from './usage-meters.js'

type Variables = {
  claims: InvokeClaims
  requestId: string
  billing: AuthorizeOk
  body: unknown
  estimatedTokens: number
}
type AppEnv = { Variables: Variables }

const app = new Hono<AppEnv>()

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Authorization', 'Content-Type', 'HTTP-Referer', 'X-Title'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
)

app.get('/healthz', (c) =>
  c.json({
    status: 'ok',
    service: 'work4you-inference-api',
    openrouter: config.hasOpenRouterKey(),
    billing: config.hasBillingSecret(),
  }),
)
app.get('/health/liveliness', (c) => c.json({ status: "I'm alive!" }))

async function requireInvoke(c: Context<AppEnv>, next: Next) {
  try {
    const claims = await verifyInvokeBearer(c.req.header('authorization'))
    c.set('claims', claims)
    c.set('requestId', randomUUID())
    await next()
  } catch (err) {
    const status = (err as { status?: number }).status || 401
    const message = err instanceof Error ? err.message : 'unauthorized'
    return c.json(
      {
        error: {
          message,
          type: status === 403 ? 'forbidden' : 'authentication_error',
          code: message,
        },
      },
      status as 401 | 403 | 503,
    )
  }
}

/**
 * Credits authorize + plan/rate-limit/model gates for metered POST routes.
 */
async function requireBillingGates(c: Context<AppEnv>, next: Next) {
  const claims = c.get('claims')
  const authz = await authorizeOrg(claims.orgId)
  if (!authz.allowed) {
    return c.json(
      {
        error: {
          message:
            (typeof authz.body.message === 'string' && authz.body.message) ||
            'Account has no usable credits',
          type: 'insufficient_quota',
          code: 'no_usable_credits',
        },
        ...authz.body,
      },
      402,
    )
  }
  c.set('billing', authz)

  const body = await c.req.json().catch(() => ({}))
  c.set('body', body)

  const estimatedTokens = estimateRequestTokens(body)
  c.set('estimatedTokens', estimatedTokens)
  const rl = checkAndConsumeRateLimit({
    orgId: claims.orgId,
    limit: authz.rateLimit,
    estimatedTokens,
  })
  if (!rl.ok) {
    c.header('Retry-After', String(rl.retryAfterSec))
    return c.json(
      {
        error: {
          message:
            rl.code === 'rate_limit_rpm'
              ? `Rate limit exceeded: ${rl.used}/${rl.limit} requests per minute`
              : `Rate limit exceeded: ${rl.used}/${rl.limit} tokens per minute`,
          type: 'rate_limit_exceeded',
          code: rl.code,
          limit: rl.limit,
          used: rl.used,
        },
      },
      429,
    )
  }

  const model = extractModel(body)
  const paidPlan =
    typeof claims.paidPlan === 'boolean' ? claims.paidPlan : authz.paidPlan
  if (!paidPlan && model !== 'unknown') {
    const pricing = await getModelPricing(model)
    if (!isModelFreeForPlan(model, pricing)) {
      return c.json(
        {
          error: {
            message: 'Modelo disponível apenas em planos pagos.',
            type: 'forbidden',
            code: 'paid_plan_required',
            model,
          },
        },
        403,
      )
    }
  }

  await next()
}

function stripClientAuth(body: unknown): unknown {
  return body
}

async function settleDebit(params: {
  orgId: string
  requestId: string
  model: string
  usage: Record<string, unknown> | null
  apiKeyId?: string | null
}) {
  try {
    const pricing = await getModelPricing(params.model)
    const amountUsd = costUsdFromUsage(params.usage, pricing)
    const meters = metersFromOpenRouterUsage(params.usage)
    if (!(amountUsd > 0) && !(meters.inputTokens > 0 || meters.outputTokens > 0 || meters.cacheReadTokens > 0 || meters.cacheWriteTokens > 0)) {
      return
    }
    await debitOrg({
      orgId: params.orgId,
      amountUsd: amountUsd > 0 ? amountUsd : 0,
      idempotencyKey: `inf:${params.requestId}`,
      purpose: `inference:${params.model}`,
      apiKeyId: params.apiKeyId,
      meters,
    })
  } catch (err) {
    console.error('[debit] failed', err)
  }
}

function extractUsage(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object') return null
  const usage = (json as { usage?: unknown }).usage
  if (!usage || typeof usage !== 'object') return null
  return usage as Record<string, unknown>
}

function extractModel(body: unknown, fallback = 'unknown'): string {
  if (body && typeof body === 'object' && typeof (body as { model?: unknown }).model === 'string') {
    return (body as { model: string }).model
  }
  return fallback
}

/** Proxy JSON OpenRouter responses with post-debit. */
async function proxyJson(c: Context<AppEnv>, orPath: string, body: unknown) {
  const claims = c.get('claims')
  const requestId = c.get('requestId')
  const model = extractModel(body)
  const estimatedTokens = c.get('estimatedTokens') || estimateRequestTokens(body)

  const upstream = await openRouterFetch(orPath, {
    method: 'POST',
    body: JSON.stringify(stripClientAuth(body)),
  })

  const text = await upstream.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }

  if (upstream.ok && json) {
    const usage = extractUsage(json)
    if (usage) {
      const actual =
        Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0)
      if (actual > 0) {
        reconcileRateLimitTokens({
          orgId: claims.orgId,
          estimatedTokens,
          actualTokens: actual,
        })
      }
    }
    void settleDebit({
      orgId: claims.orgId,
      requestId,
      model,
      usage,
      apiKeyId: claims.apiKeyId,
    })
  }

  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'x-work4you-request-id': requestId,
    },
  })
}

/** Stream SSE; debit from final usage chunk when present. */
async function proxyStream(c: Context<AppEnv>, orPath: string, body: unknown) {
  const claims = c.get('claims')
  const requestId = c.get('requestId')
  const model = extractModel(body)

  const upstream = await openRouterFetch(orPath, {
    method: 'POST',
    body: JSON.stringify(stripClientAuth(body)),
  })

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'x-work4you-request-id': requestId,
      },
    })
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastUsage: Record<string, unknown> | null = null

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        void settleDebit({
          orgId: claims.orgId,
          requestId,
          model,
          usage: lastUsage,
          apiKeyId: claims.apiKeyId,
        })
        controller.close()
        return
      }
      buffer += decoder.decode(value, { stream: true })
      // Parse complete SSE data lines for usage
      const parts = buffer.split('\n')
      buffer = parts.pop() || ''
      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const obj = JSON.parse(payload) as { usage?: Record<string, unknown> }
          if (obj.usage) lastUsage = obj.usage
        } catch {
          /* ignore partial */
        }
      }
      controller.enqueue(value)
    },
    cancel() {
      void reader.cancel()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-work4you-request-id': requestId,
    },
  })
}

app.use('/v1/*', requireInvoke)

app.use('/v1/*', async (c, next) => {
  if (!config.hasOpenRouterKey()) {
    return c.json(
      {
        error: {
          message: 'Inference upstream is not configured (OPENROUTER_API_KEY)',
          type: 'server_error',
          code: 'upstream_not_configured',
        },
      },
      503,
    )
  }
  if (!config.hasBillingSecret()) {
    return c.json(
      {
        error: {
          message: 'Billing bridge is not configured (INFERENCE_BILLING_SECRET)',
          type: 'server_error',
          code: 'billing_not_configured',
        },
      },
      503,
    )
  }
  await next()
})

app.get('/v1/models', async (c) => {
  // Catalog is public on OR; still require Portal JWT so only subscribers list.
  const upstream = await openRouterFetch('/models')
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'x-work4you-request-id': c.get('requestId'),
    },
  })
})

app.post('/v1/chat/completions', requireBillingGates, async (c) => {
  const body = c.get('body')
  const stream = Boolean((body as { stream?: boolean }).stream)
  if (stream) return proxyStream(c, '/chat/completions', body)
  return proxyJson(c, '/chat/completions', body)
})

app.post('/v1/completions', requireBillingGates, async (c) => {
  const body = c.get('body')
  const stream = Boolean((body as { stream?: boolean }).stream)
  if (stream) return proxyStream(c, '/completions', body)
  return proxyJson(c, '/completions', body)
})

app.post('/v1/embeddings', requireBillingGates, async (c) => {
  const body = c.get('body')
  return proxyJson(c, '/embeddings', body)
})

/** Anthropic Messages dual-wire (agent path for anthropic/*). */
app.post('/v1/messages', requireBillingGates, async (c) => {
  const body = c.get('body')
  const mapped = mapAnthropicToChat(body)
  const stream = Boolean((mapped as { stream?: boolean }).stream)
  if (stream) return proxyStream(c, '/chat/completions', mapped)
  return proxyJson(c, '/chat/completions', mapped)
})

function mapAnthropicToChat(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {}
  const b = body as Record<string, unknown>
  if (Array.isArray(b.messages) && b.model) {
    // Already chat-like or Anthropic messages — pass model + messages through
    // OpenRouter accepts OpenAI format; convert Anthropic system/messages if needed.
    const messages: Array<{ role: string; content: unknown }> = []
    if (typeof b.system === 'string' && b.system) {
      messages.push({ role: 'system', content: b.system })
    }
    if (Array.isArray(b.messages)) {
      for (const m of b.messages as Array<Record<string, unknown>>) {
        const role = String(m.role || 'user')
        messages.push({ role: role === 'assistant' ? 'assistant' : role, content: m.content })
      }
    }
    return {
      model: b.model,
      messages: messages.length ? messages : b.messages,
      max_tokens: b.max_tokens,
      stream: b.stream,
      temperature: b.temperature,
    }
  }
  return b
}

app.notFound((c) =>
  c.json(
    {
      error: {
        message: 'Not found',
        type: 'invalid_request_error',
        code: 'not_found',
      },
    },
    404,
  ),
)

const port = config.port
console.log(`[work4you-inference-api] listening on :${port}`)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
