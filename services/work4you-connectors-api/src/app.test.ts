import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ALLOWLIST,
  BLOCKED_SESSION_SLUGS,
  POPULAR_SLUGS,
  getAllowlistApp,
  isAllowlisted,
  sectionForComposioCategory,
  sessionToolkitSlugs,
} from './allowlist.js'
import { createApp, type AppConfig, type AppDeps } from './app.js'
import { AuthError, type ConnectorClaims } from './auth.js'
import type { ComposioPort, ComposioSession, ConnectedAccount } from './composio.js'
import { TokenStore } from './tokens.js'

function claims(sub: string): ConnectorClaims {
  return { sub, orgId: 'org_1', raw: { sub } }
}

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    publicBaseUrl: 'https://connectors-api.work4you.ai',
    composioApiKey: 'ak_test',
    hasComposioKey: true,
    authConfigId: () => undefined,
    ...overrides,
  }
}

class FakeComposio implements ComposioPort {
  sessions = new Map<string, ComposioSession>()
  accounts = new Map<string, ConnectedAccount[]>()
  createdFor: string[] = []
  updated: Array<{ sessionId: string; slugs: string[] }> = []
  authorized: Array<{ sessionId: string; toolkit: string; callbackUrl: string }> = []
  disabled: string[] = []
  createCalls = 0

  async createSession(userId: string): Promise<ComposioSession> {
    this.createCalls += 1
    this.createdFor.push(userId)
    const session: ComposioSession = {
      sessionId: `sess-${userId}`,
      mcpUrl: `https://mcp.composio.dev/${userId}`,
    }
    this.sessions.set(session.sessionId, session)
    return session
  }

  async getSession(sessionId: string): Promise<ComposioSession | null> {
    return this.sessions.get(sessionId) ?? null
  }

  async updateSessionToolkits(sessionId: string, slugs: string[]): Promise<void> {
    this.updated.push({ sessionId, slugs })
  }

  async authorize(sessionId: string, toolkit: string, callbackUrl: string) {
    this.authorized.push({ sessionId, toolkit, callbackUrl })
    return {
      redirectUrl: `https://connect.composio.dev/${toolkit}`,
      connectedAccountId: `ca-${toolkit}`,
    }
  }

  async listAccounts(userId: string): Promise<ConnectedAccount[]> {
    return this.accounts.get(userId) ?? []
  }

  async disableAccount(accountId: string): Promise<void> {
    this.disabled.push(accountId)
  }
}

function verifyFor(users: Record<string, string>) {
  return async (authorization: string | undefined): Promise<ConnectorClaims> => {
    if (!authorization?.startsWith('Bearer ')) {
      throw new AuthError('missing_bearer', 401)
    }
    const token = authorization.slice('Bearer '.length)
    if (token.startsWith('sk-')) {
      throw new AuthError('api_keys_not_supported', 401)
    }
    const sub = users[token]
    if (!sub) throw new AuthError('invalid_token', 401)
    if (sub === 'default') throw new AuthError('missing_sub', 401)
    return claims(sub)
  }
}

function harness(opts?: {
  composio?: FakeComposio
  tokens?: TokenStore
  users?: Record<string, string>
  config?: AppConfig
  fetchImpl?: typeof fetch
}) {
  const composio = opts?.composio ?? new FakeComposio()
  const tokens = opts?.tokens ?? new TokenStore()
  const users = opts?.users ?? { jwt_a: 'user-a', jwt_b: 'user-b', jwt_default: 'default' }
  const deps: AppDeps = {
    config: opts?.config ?? config(),
    composio,
    tokens,
    verifyBearer: verifyFor(users),
    sleep: async () => undefined,
    fetchImpl: opts?.fetchImpl,
  }
  return { app: createApp(deps), composio, tokens, deps }
}

test('healthz does not require auth or a Composio key', async () => {
  const { app } = harness({
    config: config({ hasComposioKey: false, composioApiKey: '' }),
  })
  const res = await app.request('/healthz')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.service, 'work4you-connectors-api')
  assert.equal(body.composio, false)
})

test('bootstrap without bearer is 401', async () => {
  const { app } = harness()
  const res = await app.request('/v1/bootstrap', { method: 'POST' })
  assert.equal(res.status, 401)
})

test('bootstrap rejects static Portal API keys', async () => {
  const { app } = harness()
  const res = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-work4you-secret' },
  })
  assert.equal(res.status, 401)
  const body = await res.json()
  assert.equal(body.error, 'api_keys_not_supported')
})

test('bootstrap rejects missing/default sub', async () => {
  const { app } = harness()
  const res = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_default' },
  })
  assert.equal(res.status, 401)
  const body = await res.json()
  assert.equal(body.error, 'missing_sub')
})

test('bootstrap issues an opaque MCP token and never echoes the Composio key', async () => {
  const { app, composio } = harness()
  const res = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.mcp.name, 'work4you_apps')
  assert.equal(body.mcp.url, 'https://connectors-api.work4you.ai/mcp')
  assert.equal(body.mcp.token_env, 'WORK4YOU_APPS_MCP_TOKEN')
  assert.match(body.mcp.token, /^w4y-c-[0-9a-f]+$/)
  assert.equal(body.user_id, 'user-a')
  const dumped = JSON.stringify(body)
  assert.equal(dumped.includes('ak_test'), false)
  assert.deepEqual(composio.createdFor, ['user-a'])
})

test('bootstrap reuses the session for the same sub', async () => {
  const { app, composio } = harness()
  const first = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a' },
  })
  const second = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(composio.createCalls, 1)
  const a = await first.json()
  const b = await second.json()
  assert.equal(a.mcp.token, b.mcp.token)
})

test('apps catalog is the allowlist and never includes native/blocked slugs', async () => {
  const { app } = harness()
  const res = await app.request('/v1/apps', {
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  const slugs: string[] = body.apps.map((row: { slug: string }) => row.slug)
  assert.ok(slugs.includes('gmail'))
  assert.ok(slugs.includes('googlecalendar'))
  assert.ok(slugs.includes('granola_mcp'))
  assert.equal(slugs.includes('notion'), false)
  assert.equal(slugs.includes('firecrawl'), false)
  assert.equal(slugs.includes('exa'), false)
  assert.equal(slugs.includes('linear'), false)
  const granola = body.apps.find((row: { slug: string }) => row.slug === 'granola_mcp')
  assert.equal(granola.name, 'Granola')
  const instagram = body.apps.find((row: { slug: string }) => row.slug === 'instagram')
  assert.equal(instagram.notes, 'instagram_business_creator')
  assert.deepEqual(body.popular, [...POPULAR_SLUGS])
})

test('authorize unknown or blocked slug is 404', async () => {
  const { app } = harness()
  for (const slug of ['notion', 'firecrawl', 'not-a-real-app']) {
    const res = await app.request(`/v1/apps/${slug}/authorize`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer jwt_a',
        'content-type': 'application/json',
      },
      body: '{}',
    })
    assert.equal(res.status, 404, slug)
  }
})

test('authorize allowlisted slug returns a connect link', async () => {
  const { app, composio } = harness()
  const res = await app.request('/v1/apps/hubspot/authorize', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ callback_url: 'https://connectors-api.work4you.ai/connected' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.redirect_url, 'https://connect.composio.dev/hubspot')
  assert.equal(composio.authorized[0]?.toolkit, 'hubspot')
})

test('wait reports connected once the account is ACTIVE', async () => {
  const composio = new FakeComposio()
  composio.accounts.set('user-a', [
    { id: 'ca-1', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app } = harness({ composio })
  const res = await app.request('/v1/apps/gmail/wait?timeout_ms=0', {
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.connected, true)
  assert.equal(body.status, 'active')
})

test('disconnect disables the matching account', async () => {
  const composio = new FakeComposio()
  composio.accounts.set('user-a', [
    { id: 'ca-gmail', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app } = harness({ composio })
  const res = await app.request('/v1/apps/gmail/disconnect', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  assert.deepEqual(composio.disabled, ['ca-gmail'])
})

test('MCP proxy rejects unknown tokens and isolates users', async () => {
  const hits: Array<{ url: string; apiKey: string | null; authorization: string | null }> = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers)
    hits.push({
      url: String(input),
      apiKey: headers.get('x-api-key'),
      authorization: headers.get('authorization'),
    })
    return new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const { app, tokens } = harness({ fetchImpl })
  const bootA = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a' },
  })
  const bootB = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_b' },
  })
  const tokenA = (await bootA.json()).mcp.token as string
  const tokenB = (await bootB.json()).mcp.token as string
  assert.notEqual(tokenA, tokenB)
  assert.equal(tokens.get(tokenA)?.sub, 'user-a')
  assert.equal(tokens.get(tokenB)?.sub, 'user-b')

  const denied = await app.request('/mcp', {
    method: 'POST',
    headers: { authorization: 'Bearer w4y-c-deadbeef' },
    body: '{}',
  })
  assert.equal(denied.status, 401)

  const proxied = await app.request('/mcp', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokenA}`,
      'content-type': 'application/json',
    },
    body: '{"jsonrpc":"2.0"}',
  })
  assert.equal(proxied.status, 200)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].url, 'https://mcp.composio.dev/user-a')
  assert.equal(hits[0].apiKey, 'ak_test')
  assert.equal(hits[0].authorization, null)
})

test('connected page is a close-this-window landing', async () => {
  const { app } = harness()
  const res = await app.request('/connected')
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /close this window/i)
})

test('allowlist never enables blocked native/search slugs', () => {
  const enabled = new Set(sessionToolkitSlugs())
  for (const blocked of BLOCKED_SESSION_SLUGS) {
    assert.equal(enabled.has(blocked), false, blocked)
    assert.equal(isAllowlisted(blocked), false, blocked)
  }
  assert.ok(getAllowlistApp('gmail'))
  assert.equal(sectionForComposioCategory('not a real category'), 'other')
  assert.equal(sectionForComposioCategory('crm'), 'crm')
  for (const slug of POPULAR_SLUGS) {
    assert.ok(enabled.has(slug), slug)
  }
  assert.equal(ALLOWLIST.filter((app) => app.slug === 'canva').length, 1)
  assert.equal(ALLOWLIST.filter((app) => app.slug === 'canva_mcp').length, 1)
})
