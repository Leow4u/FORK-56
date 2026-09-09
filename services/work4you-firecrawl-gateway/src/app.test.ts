import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { JWTPayload } from 'jose'

import {
  hasGatewayScope,
  isFirecrawlCovered,
  scopeList,
  type InvokeClaims,
} from './auth.js'
import { createApp } from './app.js'
import type { AuthorizeDenied, AuthorizeOk } from './billing.js'
import { creditsUsedFromJson, isAllowedFirecrawlRoute } from './paths.js'
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

function appFor(overrides: {
  verify?: (authorization: string | undefined) => Promise<InvokeClaims>
  authorize?: (orgId: string) => Promise<AuthorizeOk | AuthorizeDenied>
  debit?: (...args: unknown[]) => Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>
  firecrawl?: (path: string, init?: RequestInit) => Promise<Response>
  usdPerCredit?: number
  hasFirecrawlKey?: boolean
  hasBillingSecret?: boolean
}) {
  return createApp({
    config: {
      hasFirecrawlKey: overrides.hasFirecrawlKey ?? true,
      hasBillingSecret: overrides.hasBillingSecret ?? true,
      usdPerCredit: overrides.usdPerCredit ?? 0,
    },
    verifyBearer:
      overrides.verify ||
      (async (authorization) => {
        if (!authorization?.startsWith('Bearer portal-token')) {
          throw Object.assign(new Error('invalid_token'), { status: 401 })
        }
        return claims()
      }),
    authorizeOrg: overrides.authorize || (async () => allowBilling),
    debitOrg:
      (overrides.debit as AppDebit) ||
      (async () => ({ ok: true, status: 200, body: {} })),
    firecrawlFetch:
      overrides.firecrawl ||
      (async () =>
        new Response(JSON.stringify({ success: true, data: { web: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })),
  })
}

type AppDebit = (params: {
  orgId: string
  amountUsd: number
  idempotencyKey: string
  purpose?: string
  apiKeyId?: string | null
}) => Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>

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

test('isFirecrawlCovered: paid access always covers', () => {
  assert.equal(isFirecrawlCovered({} as JWTPayload, true), true)
})

test('isFirecrawlCovered: tool-pool can deny firecrawl', () => {
  const payload = {
    tool_access: { enabled: true, coverage: { firecrawl: false, fal: true } },
  } as JWTPayload
  assert.equal(isFirecrawlCovered(payload, false), false)
})

test('isFirecrawlCovered: tool-pool can allow firecrawl', () => {
  const payload = {
    tool_access: { enabled: true, coverage: { firecrawl: true } },
  } as JWTPayload
  assert.equal(isFirecrawlCovered(payload, false), true)
})

test('isFirecrawlCovered: missing claims fail open to NAS', () => {
  assert.equal(isFirecrawlCovered({} as JWTPayload, null), true)
})

test('allowlist is search+scrape only', () => {
  assert.equal(isAllowedFirecrawlRoute('POST', '/v2/search'), true)
  assert.equal(isAllowedFirecrawlRoute('POST', '/v1/scrape'), true)
  assert.equal(isAllowedFirecrawlRoute('POST', '/v2/scrape/'), true)
  assert.equal(isAllowedFirecrawlRoute('POST', '/v2/crawl'), false)
  assert.equal(isAllowedFirecrawlRoute('GET', '/v2/team/credit-usage'), false)
  assert.equal(isAllowedFirecrawlRoute('POST', '/v2/../search'), false)
})

test('creditsUsedFromJson reads Firecrawl credit fields', () => {
  assert.equal(creditsUsedFromJson({ creditsUsed: 2 }), 2)
  assert.equal(creditsUsedFromJson({ data: { creditsUsed: 3 } }), 3)
  assert.equal(creditsUsedFromJson({ success: true }), 0)
})

test('GET /healthz does not require auth', async () => {
  const app = appFor({})
  const res = await app.request('http://gateway.test/healthz')
  assert.equal(res.status, 200)
  const json = (await res.json()) as { service: string; firecrawl: boolean }
  assert.equal(json.service, 'work4you-firecrawl-gateway')
  assert.equal(json.firecrawl, true)
})

test('search without bearer is 401', async () => {
  const app = appFor({})
  const res = await app.request('http://gateway.test/v2/search', {
    method: 'POST',
    body: JSON.stringify({ query: 'x' }),
  })
  assert.equal(res.status, 401)
})

test('search proxies with platform key, not the Portal token', async () => {
  resetRateLimitWindows()
  const seen: Array<{ path: string; auth: string | null }> = []
  const app = appFor({
    firecrawl: async (path, init) => {
      const headers = new Headers(init?.headers)
      seen.push({ path, auth: headers.get('authorization') })
      return new Response(JSON.stringify({ success: true, data: { web: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const res = await app.request('http://gateway.test/v2/search', {
    method: 'POST',
    headers: {
      authorization: 'Bearer portal-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: 'work4you' }),
  })
  assert.equal(res.status, 200)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].path, '/v2/search')
  assert.equal(seen[0].auth, null)
})

test('blocked Firecrawl routes stay 404 and never hit upstream', async () => {
  let hits = 0
  const app = appFor({
    firecrawl: async () => {
      hits += 1
      return new Response('nope', { status: 200 })
    },
  })
  const res = await app.request('http://gateway.test/v2/team/credit-usage', {
    method: 'GET',
    headers: { authorization: 'Bearer portal-token' },
  })
  assert.equal(res.status, 404)
  assert.equal(hits, 0)
})

test('NAS 402 is returned as Firecrawl-shaped error', async () => {
  const app = appFor({
    authorize: async () => ({
      allowed: false,
      status: 402,
      body: { message: 'Account has no usable credits' },
    }),
  })
  const res = await app.request('http://gateway.test/v2/scrape', {
    method: 'POST',
    headers: {
      authorization: 'Bearer portal-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url: 'https://example.com' }),
  })
  assert.equal(res.status, 402)
  const json = (await res.json()) as { success: boolean; error: string }
  assert.equal(json.success, false)
  assert.match(json.error, /credits/)
})

test('missing platform key is 503', async () => {
  const app = appFor({ hasFirecrawlKey: false })
  const res = await app.request('http://gateway.test/v2/search', {
    method: 'POST',
    headers: { authorization: 'Bearer portal-token' },
    body: '{}',
  })
  assert.equal(res.status, 503)
})

test('debit uses Firecrawl credits when a USD rate is configured', async () => {
  resetRateLimitWindows()
  const debits: number[] = []
  const app = appFor({
    usdPerCredit: 0.01,
    firecrawl: async () =>
      new Response(JSON.stringify({ success: true, creditsUsed: 4, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    debit: async (params: { amountUsd: number }) => {
      debits.push(params.amountUsd)
      return { ok: true, status: 200, body: {} }
    },
  })
  const res = await app.request('http://gateway.test/v1/scrape', {
    method: 'POST',
    headers: {
      authorization: 'Bearer portal-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url: 'https://example.com' }),
  })
  assert.equal(res.status, 200)
  await new Promise((r) => setTimeout(r, 20))
  assert.deepEqual(debits, [0.04])
})
