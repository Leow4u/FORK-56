import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { JWTPayload } from 'jose'

import {
  hasGatewayScope,
  isOpenAIAudioCovered,
  scopeList,
  type InvokeClaims,
} from './auth.js'
import { createApp } from './app.js'
import type { AuthorizeDenied, AuthorizeOk } from './billing.js'
import { isAllowedOpenAIAudioRoute } from './paths.js'
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
  openai?: (path: string, init?: RequestInit) => Promise<Response>
  usdPerRequest?: number
  hasOpenAIKey?: boolean
  hasBillingSecret?: boolean
}) {
  return createApp({
    config: {
      hasOpenAIKey: overrides.hasOpenAIKey ?? true,
      hasBillingSecret: overrides.hasBillingSecret ?? true,
      usdPerRequest: overrides.usdPerRequest ?? 0,
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
      overrides.debit ||
      (async () => ({ ok: true, status: 200, body: {} })),
    openaiFetch:
      overrides.openai ||
      (async () =>
        new Response(JSON.stringify({ text: 'hello' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })),
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

test('isOpenAIAudioCovered: paid access always covers', () => {
  assert.equal(isOpenAIAudioCovered({} as JWTPayload, true), true)
})

test('isOpenAIAudioCovered: tool-pool can deny openai-audio', () => {
  const payload = {
    tool_access: {
      enabled: true,
      coverage: { firecrawl: true, 'openai-audio': false },
    },
  } as JWTPayload
  assert.equal(isOpenAIAudioCovered(payload, false), false)
})

test('isOpenAIAudioCovered: tool-pool can allow openai-audio', () => {
  const payload = {
    tool_access: { enabled: true, coverage: { 'openai-audio': true } },
  } as JWTPayload
  assert.equal(isOpenAIAudioCovered(payload, false), true)
})

test('isOpenAIAudioCovered: missing claims fail open to NAS', () => {
  assert.equal(isOpenAIAudioCovered({} as JWTPayload, null), true)
})

test('allowlist is audio STT/TTS only', () => {
  assert.equal(isAllowedOpenAIAudioRoute('POST', '/v1/audio/transcriptions'), true)
  assert.equal(isAllowedOpenAIAudioRoute('POST', '/v1/audio/speech'), true)
  assert.equal(isAllowedOpenAIAudioRoute('POST', '/v1/audio/translations'), true)
  assert.equal(isAllowedOpenAIAudioRoute('POST', '/v1/audio/speech/'), true)
  assert.equal(isAllowedOpenAIAudioRoute('POST', '/v1/chat/completions'), false)
  assert.equal(isAllowedOpenAIAudioRoute('GET', '/v1/models'), false)
  assert.equal(isAllowedOpenAIAudioRoute('POST', '/v1/audio/../chat/completions'), false)
})

test('GET /healthz does not require auth', async () => {
  const app = appFor({})
  const res = await app.request('http://gateway.test/healthz')
  assert.equal(res.status, 200)
  const json = (await res.json()) as { service: string; openai: boolean }
  assert.equal(json.service, 'work4you-openai-audio-gateway')
  assert.equal(json.openai, true)
})

test('transcription without bearer is 401', async () => {
  const app = appFor({})
  const res = await app.request('http://gateway.test/v1/audio/transcriptions', {
    method: 'POST',
    body: '{}',
  })
  assert.equal(res.status, 401)
})

test('transcriptions proxies with platform key, not the Portal token', async () => {
  resetRateLimitWindows()
  const seen: Array<{ path: string; auth: string | null; hasBody: boolean }> =
    []
  const app = appFor({
    openai: async (path, init) => {
      const headers = new Headers(init?.headers)
      seen.push({
        path,
        auth: headers.get('authorization'),
        hasBody: Boolean(init?.body),
      })
      return new Response(JSON.stringify({ text: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  const form = new FormData()
  form.set('model', 'whisper-1')
  form.set('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }), 'a.wav')
  const res = await app.request('http://gateway.test/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: 'Bearer portal-token' },
    body: form,
  })
  assert.equal(res.status, 200)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].path, '/v1/audio/transcriptions')
  assert.equal(seen[0].auth, null)
  assert.equal(seen[0].hasBody, true)
  const json = (await res.json()) as { text: string }
  assert.equal(json.text, 'ok')
})

test('speech proxies binary audio and forwards idempotency', async () => {
  resetRateLimitWindows()
  const seen: Array<{ path: string; idem: string | null }> = []
  const audio = new Uint8Array([0xff, 0xfb, 0x90])
  const app = appFor({
    openai: async (path, init) => {
      const headers = new Headers(init?.headers)
      seen.push({ path, idem: headers.get('x-idempotency-key') })
      return new Response(audio, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      })
    },
  })
  const res = await app.request('http://gateway.test/v1/audio/speech', {
    method: 'POST',
    headers: {
      authorization: 'Bearer portal-token',
      'content-type': 'application/json',
      'x-idempotency-key': 'tts-call-123',
    },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', input: 'hi', voice: 'alloy' }),
  })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'audio/mpeg')
  assert.equal(seen[0].path, '/v1/audio/speech')
  assert.equal(seen[0].idem, 'tts-call-123')
  const buf = new Uint8Array(await res.arrayBuffer())
  assert.deepEqual(Array.from(buf), [0xff, 0xfb, 0x90])
})

test('blocked OpenAI routes stay 404 and never hit upstream', async () => {
  let hits = 0
  const app = appFor({
    openai: async () => {
      hits += 1
      return new Response('nope', { status: 200 })
    },
  })
  const res = await app.request('http://gateway.test/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer portal-token' },
    body: '{}',
  })
  assert.equal(res.status, 404)
  assert.equal(hits, 0)
})

test('NAS 402 is returned as OpenAI-shaped error', async () => {
  const app = appFor({
    authorize: async () => ({
      allowed: false,
      status: 402,
      body: { message: 'Account has no usable credits' },
    }),
  })
  const res = await app.request('http://gateway.test/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: 'Bearer portal-token' },
    body: '{}',
  })
  assert.equal(res.status, 402)
  const json = (await res.json()) as { error: { message: string } }
  assert.match(json.error.message, /credits/)
})

test('missing platform key is 503', async () => {
  const app = appFor({ hasOpenAIKey: false })
  const res = await app.request('http://gateway.test/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: 'Bearer portal-token' },
    body: '{}',
  })
  assert.equal(res.status, 503)
})

test('debit uses a flat USD rate when configured', async () => {
  resetRateLimitWindows()
  const debits: Array<{ amountUsd: number; purpose?: string }> = []
  const app = appFor({
    usdPerRequest: 0.006,
    openai: async () =>
      new Response(JSON.stringify({ text: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    debit: async (params) => {
      debits.push({ amountUsd: params.amountUsd, purpose: params.purpose })
      return { ok: true, status: 200, body: {} }
    },
  })
  const res = await app.request('http://gateway.test/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: 'Bearer portal-token' },
    body: '{}',
  })
  assert.equal(res.status, 200)
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(debits.length, 1)
  assert.equal(debits[0].amountUsd, 0.006)
  assert.equal(debits[0].purpose, 'openai-audio:transcriptions')
})
