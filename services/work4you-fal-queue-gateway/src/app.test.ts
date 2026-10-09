import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { JWTPayload } from 'jose'

import {
  extractInvokeToken,
  hasGatewayScope,
  isFalCovered,
  scopeList,
  type InvokeClaims,
} from './auth.js'
import { createApp } from './app.js'
import type { AuthorizeDenied, AuthorizeOk } from './billing.js'
import {
  isAllowedFalRoute,
  parseFalQueueRoute,
  rewriteQueueUrls,
} from './paths.js'
import { resetRateLimitWindows } from './rate-limit.js'

function claims(overrides: Partial<InvokeClaims> = {}): InvokeClaims {
  return {
    sub: 'user_1',
    orgId: 'org_1',
    sessionId: null,
    apiKeyId: null,
    scope: 'inference:invoke',
    clientId: 'cli',
    paidAccess: true,
    paidPlan: true,
    subscriptionTier: 1,
    jti: 'jti',
    raw: { sub: 'user_1', org_id: 'org_1' },
    via: 'jwt',
    ...overrides,
  }
}

const allowBilling: AuthorizeOk = {
  allowed: true,
  paidPlan: true,
  tierId: 'plus',
  subscriptionTier: 1,
  rateLimit: { rpm: 50, tpm: 500_000 },
}

type AppDebit = (params: {
  orgId: string
  amountUsd: number
  idempotencyKey: string
  purpose?: string
  apiKeyId?: string | null
}) => Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>

function appFor(overrides: {
  verify?: (authorization: string | undefined) => Promise<InvokeClaims>
  authorize?: (orgId: string) => Promise<AuthorizeOk | AuthorizeDenied>
  debit?: AppDebit
  fal?: (path: string, init?: RequestInit) => Promise<Response>
  usdPerRequest?: number
  hasFalKey?: boolean
  hasBillingSecret?: boolean
  falQueueUrl?: string
}) {
  return createApp({
    config: {
      hasFalKey: overrides.hasFalKey ?? true,
      hasBillingSecret: overrides.hasBillingSecret ?? true,
      usdPerRequest: overrides.usdPerRequest ?? 0,
      falQueueUrl: overrides.falQueueUrl ?? 'https://queue.fal.run',
    },
    verifyBearer:
      overrides.verify ||
      (async (authorization) => {
        const token = extractInvokeToken(authorization)
        if (token !== 'portal-token') {
          throw Object.assign(new Error('invalid_token'), { status: 401 })
        }
        return claims()
      }),
    authorizeOrg: overrides.authorize || (async () => allowBilling),
    debitOrg:
      overrides.debit ||
      (async () => ({ ok: true, status: 200, body: {} })),
    falFetch:
      overrides.fal ||
      (async () =>
        new Response(
          JSON.stringify({
            request_id: 'r1',
            response_url: 'https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/r1',
            status_url:
              'https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/r1/status',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )),
  })
}

test('scopeList splits Portal scope strings', () => {
  assert.deepEqual(scopeList('inference:invoke tool:invoke'), [
    'inference:invoke',
    'tool:invoke',
  ])
})

test('hasGatewayScope accepts inference:invoke or tool:invoke', () => {
  assert.equal(hasGatewayScope(['inference:invoke']), true)
  assert.equal(hasGatewayScope(['tool:invoke']), true)
  assert.equal(hasGatewayScope(['billing:manage']), false)
})

test('extractInvokeToken accepts Key and Bearer', () => {
  assert.equal(extractInvokeToken('Key abc'), 'abc')
  assert.equal(extractInvokeToken('Bearer abc'), 'abc')
  assert.equal(extractInvokeToken('Basic abc'), null)
  assert.equal(extractInvokeToken(undefined), null)
})

test('isFalCovered: paid access always covers', () => {
  assert.equal(isFalCovered({} as JWTPayload, true), true)
})

test('isFalCovered: tool-pool can deny fal', () => {
  const payload = {
    tool_access: { enabled: true, coverage: { fal: false, firecrawl: true } },
  } as JWTPayload
  assert.equal(isFalCovered(payload, false), false)
})

test('isFalCovered: tool-pool can allow fal', () => {
  const payload = {
    tool_access: { enabled: true, coverage: { fal: true } },
  } as JWTPayload
  assert.equal(isFalCovered(payload, false), true)
})

test('isFalCovered: missing claims fail open to NAS', () => {
  assert.equal(isFalCovered({} as JWTPayload, null), true)
})

test('allowlist is image queue apps only', () => {
  assert.equal(isAllowedFalRoute('POST', '/fal-ai/flux-2/klein/9b'), true)
  assert.equal(
    isAllowedFalRoute('GET', '/fal-ai/flux-2/klein/9b/requests/abc12345/status', '?logs=1'),
    true,
  )
  assert.equal(
    isAllowedFalRoute('GET', '/fal-ai/flux-2/klein/9b/requests/abc12345'),
    true,
  )
  assert.equal(
    isAllowedFalRoute('PUT', '/fal-ai/flux-2/klein/9b/requests/abc12345/cancel'),
    true,
  )
  assert.equal(isAllowedFalRoute('POST', '/fal-ai/veo3.1'), false)
  assert.equal(
    isAllowedFalRoute('POST', '/fal-ai/flux-2/klein/9b', '?fal_webhook=https://x'),
    false,
  )
  assert.equal(isAllowedFalRoute('POST', '/fal-ai/../flux-2/klein/9b'), false)
})

test('rewriteQueueUrls rewrites queue.fal.run and leaves CDN URLs', () => {
  const out = rewriteQueueUrls(
    {
      response_url: 'https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/r1',
      image: 'https://v3.fal.media/files/x.png',
    },
    'https://queue.fal.run',
    'https://fal-queue-gateway.work4you.ai',
  ) as { response_url: string; image: string }
  assert.equal(
    out.response_url,
    'https://fal-queue-gateway.work4you.ai/fal-ai/flux-2/klein/9b/requests/r1',
  )
  assert.equal(out.image, 'https://v3.fal.media/files/x.png')
})

test('GET /healthz does not require auth', async () => {
  const app = appFor({})
  const res = await app.request('http://gateway.test/healthz')
  assert.equal(res.status, 200)
  const json = (await res.json()) as { service: string; fal: boolean }
  assert.equal(json.service, 'work4you-fal-queue-gateway')
  assert.equal(json.fal, true)
})

test('GET /health/liveliness is public', async () => {
  const app = appFor({})
  const res = await app.request('http://gateway.test/health/liveliness')
  assert.equal(res.status, 200)
  assert.equal(((await res.json()) as { status: string }).status, "I'm alive!")
})

test('submit without token is 401', async () => {
  const app = appFor({})
  const res = await app.request('http://gateway.test/fal-ai/flux-2/klein/9b', {
    method: 'POST',
    body: JSON.stringify({ prompt: 'x' }),
  })
  assert.equal(res.status, 401)
})

test('Key portal token is accepted the same as Bearer', async () => {
  resetRateLimitWindows()
  const app = appFor({})
  const res = await app.request('http://gateway.test/fal-ai/flux-2/klein/9b', {
    method: 'POST',
    headers: {
      authorization: 'Key portal-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ prompt: 'a cat' }),
  })
  assert.equal(res.status, 200)
})

test('submit rewrites queue URLs onto the gateway origin', async () => {
  resetRateLimitWindows()
  const app = appFor({})
  const res = await app.request(
    'https://fal-queue-gateway.work4you.ai/fal-ai/flux-2/klein/9b',
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer portal-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'a cat' }),
    },
  )
  assert.equal(res.status, 200)
  const json = (await res.json()) as { response_url: string }
  assert.equal(
    json.response_url,
    'https://fal-queue-gateway.work4you.ai/fal-ai/flux-2/klein/9b/requests/r1',
  )
})

test('submit POSTs NAS authorize + RPM; status GET does not', async () => {
  resetRateLimitWindows()
  let nasCalls = 0
  let upstream: string[] = []
  const app = appFor({
    authorize: async () => {
      nasCalls += 1
      return allowBilling
    },
    fal: async (path) => {
      upstream.push(path)
      return new Response(JSON.stringify({ status: 'IN_QUEUE' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  const submit = await app.request('http://gateway.test/fal-ai/flux-2/klein/9b', {
    method: 'POST',
    headers: {
      authorization: 'Key portal-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ prompt: 'x' }),
  })
  assert.equal(submit.status, 200)
  assert.equal(nasCalls, 1)

  const status = await app.request(
    'http://gateway.test/fal-ai/flux-2/klein/9b/requests/abc12345/status?logs=1',
    { headers: { authorization: 'Key portal-token' } },
  )
  assert.equal(status.status, 200)
  assert.equal(nasCalls, 1, 'status poll must not hit NAS')
  assert.equal(upstream.length, 2)
  assert.match(upstream[1], /\/status\?logs=1$/)
})

test('video family is 404 and never hits upstream', async () => {
  let hits = 0
  const app = appFor({
    fal: async () => {
      hits += 1
      return new Response('nope', { status: 200 })
    },
  })
  const res = await app.request('http://gateway.test/fal-ai/veo3.1', {
    method: 'POST',
    headers: { authorization: 'Key portal-token' },
    body: '{}',
  })
  assert.equal(res.status, 404)
  assert.equal(hits, 0)
})

test('webhook query is 404 even with a token', async () => {
  let hits = 0
  const app = appFor({
    fal: async () => {
      hits += 1
      return new Response('nope', { status: 200 })
    },
  })
  const res = await app.request(
    'http://gateway.test/fal-ai/flux-2/klein/9b?fal_webhook=https://evil.example/hook',
    {
      method: 'POST',
      headers: { authorization: 'Key portal-token' },
      body: '{}',
    },
  )
  assert.equal(res.status, 404)
  assert.equal(hits, 0)
})

test('NAS 402 is returned on submit', async () => {
  const app = appFor({
    authorize: async () => ({
      allowed: false,
      status: 402,
      body: { message: 'Account has no usable credits' },
    }),
  })
  const res = await app.request('http://gateway.test/fal-ai/flux-2/klein/9b', {
    method: 'POST',
    headers: {
      authorization: 'Key portal-token',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  assert.equal(res.status, 402)
  const json = (await res.json()) as { success: boolean; error: string }
  assert.equal(json.success, false)
  assert.match(json.error, /credits/)
})

test('missing platform key is 503 on an allowed app', async () => {
  const app = appFor({ hasFalKey: false })
  const res = await app.request('http://gateway.test/fal-ai/flux-2/klein/9b', {
    method: 'POST',
    headers: { authorization: 'Key portal-token' },
    body: '{}',
  })
  assert.equal(res.status, 503)
  assert.match(await res.text(), /FAL_KEY/)
})

test('platform FAL_KEY is applied in falFetch, not the portal token', async () => {
  resetRateLimitWindows()
  const seen: Array<{ path: string; auth: string | null }> = []
  const app = appFor({
    fal: async (path, init) => {
      const headers = new Headers(init?.headers)
      seen.push({ path, auth: headers.get('authorization') })
      return new Response(JSON.stringify({ request_id: 'x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const res = await app.request('http://gateway.test/fal-ai/flux-2/klein/9b', {
    method: 'POST',
    headers: {
      authorization: 'Key portal-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ prompt: 'x' }),
  })
  assert.equal(res.status, 200)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].path, '/fal-ai/flux-2/klein/9b')
  // createApp tests stub falFetch — the stub must not see the portal token.
  assert.equal(seen[0].auth, null)
})

test('successful result GET debits once per FAL request id', async () => {
  resetRateLimitWindows()
  const debits: Array<{ usd: number; key: string }> = []
  const app = appFor({
    usdPerRequest: 0.04,
    fal: async () =>
      new Response(
        JSON.stringify({ images: [{ url: 'https://v3.fal.media/files/x.png' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    debit: async (params) => {
      debits.push({ usd: params.amountUsd, key: params.idempotencyKey })
      return { ok: true, status: 200, body: {} }
    },
  })
  const res = await app.request(
    'http://gateway.test/fal-ai/flux-2/klein/9b/requests/abc12345',
    { headers: { authorization: 'Key portal-token' } },
  )
  assert.equal(res.status, 200)
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(debits.length, 1)
  assert.equal(debits[0].usd, 0.04)
  assert.equal(debits[0].key, 'fal:fal-ai/flux-2/klein/9b:abc12345')
  assert.match(await res.text(), /v3\.fal\.media/)
})

test('parseFalQueueRoute classifies submit/status/result/cancel', () => {
  assert.equal(parseFalQueueRoute('POST', '/fal-ai/clarity-upscaler')?.kind, 'submit')
  assert.equal(
    parseFalQueueRoute('GET', '/openai/gpt-image-2/edit/requests/id123456')?.kind,
    'result',
  )
  assert.equal(
    parseFalQueueRoute(
      'GET',
      '/openai/gpt-image-2/edit/requests/id123456/status',
    )?.kind,
    'status',
  )
  assert.equal(
    parseFalQueueRoute(
      'PUT',
      '/openai/gpt-image-2/edit/requests/id123456/cancel',
    )?.kind,
    'cancel',
  )
})
