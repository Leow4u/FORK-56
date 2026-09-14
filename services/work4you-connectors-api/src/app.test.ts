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
  toolkitLogoUrl,
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
  accountsById = new Map<string, ConnectedAccount>()
  createdFor: string[] = []
  lastEnable: string[] = []
  updated: Array<{ sessionId: string; slugs: string[] }> = []
  authorized: Array<{ sessionId: string; toolkit: string; callbackUrl: string }> = []
  disabled: string[] = []
  createCalls = 0
  listCalls = 0
  listUserIds: string[] = []

  async createSession(
    userId: string,
    _authConfigs: Record<string, string> = {},
    enable: string[] = [],
  ): Promise<ComposioSession> {
    this.createCalls += 1
    this.createdFor.push(userId)
    this.lastEnable = [...enable]
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
    this.lastEnable = [...slugs]
    this.updated.push({ sessionId, slugs: [...slugs] })
  }

  async authorize(sessionId: string, toolkit: string, callbackUrl: string) {
    this.authorized.push({ sessionId, toolkit, callbackUrl })
    const connectedAccountId = `ca-${toolkit}`
    this.accountsById.set(connectedAccountId, {
      id: connectedAccountId,
      toolkit,
      status: 'INITIATED',
    })
    return {
      redirectUrl: `https://connect.composio.dev/${toolkit}`,
      connectedAccountId,
    }
  }

  async getAccount(accountId: string): Promise<ConnectedAccount | null> {
    const direct = this.accountsById.get(accountId)
    if (direct) return direct
    for (const rows of this.accounts.values()) {
      const hit = rows.find((row) => row.id === accountId)
      if (hit) return hit
    }
    return null
  }

  async listAccounts(userId: string): Promise<ConnectedAccount[]> {
    this.listCalls += 1
    this.listUserIds.push(userId)
    return this.accounts.get(userId) ?? []
  }

  async disableAccount(accountId: string): Promise<void> {
    this.disabled.push(accountId)
    const row = this.accountsById.get(accountId)
    if (row) this.accountsById.set(accountId, { ...row, status: 'INACTIVE' })
    for (const [userId, rows] of this.accounts) {
      this.accounts.set(
        userId,
        rows.map((item) => (item.id === accountId ? { ...item, status: 'INACTIVE' } : item)),
      )
    }
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
  assert.equal(body.entity_id, 'user-a::default')
  const dumped = JSON.stringify(body)
  assert.equal(dumped.includes('ak_test'), false)
  assert.deepEqual(composio.createdFor, ['user-a::default'])
  assert.deepEqual(composio.lastEnable, [])
  assert.deepEqual(body.connected, [])
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
  assert.equal(granola.logo, 'https://logos.composio.dev/api/granola_mcp')
  const gmail = body.apps.find((row: { slug: string }) => row.slug === 'gmail')
  assert.equal(gmail.logo, 'https://logos.composio.dev/api/gmail')
  const instagram = body.apps.find((row: { slug: string }) => row.slug === 'instagram')
  assert.equal(instagram.notes, 'instagram_business_creator')
  assert.deepEqual(body.popular, [...POPULAR_SLUGS])
})

test('listing apps paints connected from stored slugs, not listAccounts', async () => {
  const composio = new FakeComposio()
  composio.accounts.set('user-a::default', [
    { id: 'ca-gmail-leaked', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ connected_apps: ['gmail'] }),
  })
  composio.listCalls = 0
  const res = await app.request('/v1/apps', {
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  const gmail = body.apps.find((row: { slug: string }) => row.slug === 'gmail')
  const hubspot = body.apps.find((row: { slug: string }) => row.slug === 'hubspot')
  assert.equal(gmail.connected, true)
  assert.equal(hubspot.connected, false)
  assert.equal(composio.listCalls, 0)
})

test('listing apps does not create a session or read listAccounts', async () => {
  const composio = new FakeComposio()
  composio.accounts.set('user-a::default', [
    { id: 'ca-gmail-leaked', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app } = harness({ composio })
  const res = await app.request('/v1/apps', {
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  const gmail = body.apps.find((row: { slug: string }) => row.slug === 'gmail')
  assert.equal(gmail.connected, false)
  assert.equal(composio.createCalls, 0)
  assert.equal(composio.listCalls, 0)
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
  assert.equal(body.connection_id, 'ca-hubspot')
  assert.equal(composio.authorized[0]?.toolkit, 'hubspot')
  assert.equal(composio.authorized[0]?.callbackUrl, 'https://connectors-api.work4you.ai/connected')
  assert.deepEqual(composio.lastEnable, ['hubspot'])
})

test('authorize default callback carries this HOME on /connected', async () => {
  const { app, composio } = harness()
  const res = await app.request('/v1/apps/gmail/authorize', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
      'x-work4you-profile': 'leona',
    },
    body: '{}',
  })
  assert.equal(res.status, 200)
  const expected = new URL('https://connectors-api.work4you.ai/connected')
  expected.searchParams.set('entity_id', 'user-a::leona')
  expected.searchParams.set('slug', 'gmail')
  assert.equal(composio.authorized[0]?.callbackUrl, expected.toString())
})

test('wait reports connected once THIS connection_id is ACTIVE', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-1', { id: 'ca-1', toolkit: 'gmail', status: 'ACTIVE' })
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a', 'content-type': 'application/json' },
    body: '{}',
  })
  const res = await app.request('/v1/apps/gmail/wait?timeout_ms=0&connection_id=ca-1', {
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.connected, true)
  assert.equal(body.status, 'active')
  assert.deepEqual(composio.lastEnable, ['gmail'])
  assert.deepEqual(tokens.getByEntityId('user-a::default')?.connectedSlugs, ['gmail'])
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, 'ca-1')
})

test('wait stamps THIS ACTIVE connection_id when toolkit is still empty', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-1', { id: 'ca-1', toolkit: '', status: 'ACTIVE' })
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a', 'content-type': 'application/json' },
    body: '{}',
  })
  const res = await app.request('/v1/apps/gmail/wait?timeout_ms=0&connection_id=ca-1', {
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.connected, true)
  assert.equal(body.status, 'active')
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, 'ca-1')
})

test('wait does not stamp THIS ACTIVE connection_id for a different toolkit', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-1', { id: 'ca-1', toolkit: 'notion', status: 'ACTIVE' })
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a', 'content-type': 'application/json' },
    body: '{}',
  })
  const res = await app.request('/v1/apps/gmail/wait?timeout_ms=0&connection_id=ca-1', {
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.connected, false)
  assert.equal(body.status, 'active')
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, undefined)
})

test('wait without connection_id does not treat another home Gmail as connected', async () => {
  const composio = new FakeComposio()
  composio.accounts.set('user-a::leo', [
    { id: 'ca-gmail-leaked', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  composio.accounts.set('user-a', [
    { id: 'ca-gmail-portal', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app } = harness({ composio })
  const res = await app.request('/v1/apps/gmail/wait?timeout_ms=0', {
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leo',
    },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.connected, false)
  assert.equal(composio.listCalls, 0)
  assert.equal(composio.createCalls, 0)
})

test('wait slice timeout does not drop extraEnable for a pending connection_id', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-pending', {
    id: 'ca-pending',
    toolkit: 'gmail',
    status: 'INITIATED',
  })
  const { app } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a', 'content-type': 'application/json' },
    body: '{}',
  })
  const updatesAfterBootstrap = composio.updated.length
  const res = await app.request('/v1/apps/gmail/wait?timeout_ms=0&connection_id=ca-pending', {
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.connected, false)
  assert.equal(body.status, 'initiated')
  assert.equal(composio.updated.length, updatesAfterBootstrap)
})

test('disconnect disables only the stored account id for this entity', async () => {
  const composio = new FakeComposio()
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a', 'content-type': 'application/json' },
    body: '{}',
  })
  tokens.stampApp('user-a::default', 'gmail', 'ca-gmail')
  const res = await app.request('/v1/apps/gmail/disconnect', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a' },
  })
  assert.equal(res.status, 200)
  assert.deepEqual(composio.disabled, ['ca-gmail'])
  assert.deepEqual(composio.lastEnable, [])
  assert.deepEqual(tokens.getByEntityId('user-a::default')?.connectedSlugs, [])
})

test('bootstrap with a HOME connected_apps list enables only those toolkits', async () => {
  const composio = new FakeComposio()
  composio.accounts.set('user-a::default', [
    { id: 'ca-gmail', toolkit: 'gmail', status: 'ACTIVE' },
    { id: 'ca-notion', toolkit: 'notion', status: 'ACTIVE' },
  ])
  const { app } = harness({ composio })
  const res = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ connected_apps: ['gmail'] }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.connected, ['gmail'])
  assert.deepEqual(composio.lastEnable, ['gmail'])
})

test('bootstrap ignores project connected_accounts when HOME has no slugs', async () => {
  const composio = new FakeComposio()
  composio.accounts.set('user-a::default', [
    { id: 'ca-gmail', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app } = harness({ composio })
  const res = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ connected_apps: [] }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.connected, [])
  assert.deepEqual(composio.lastEnable, [])
  assert.equal(composio.listCalls, 0)
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
  assert.equal(tokens.get(tokenA)?.entityId, 'user-a::default')
  assert.equal(tokens.get(tokenB)?.sub, 'user-b')
  assert.equal(tokens.get(tokenB)?.entityId, 'user-b::default')

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
  assert.equal(hits[0].url, 'https://mcp.composio.dev/user-a::default')
  assert.equal(hits[0].apiKey, 'ak_test')
  assert.equal(hits[0].authorization, null)
})

test('same Portal JWT with default vs leo homes gets two Composio sessions', async () => {
  const { app, composio, tokens } = harness()
  const defaultRes = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a' },
  })
  const leoRes = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leo',
    },
  })
  assert.equal(defaultRes.status, 200)
  assert.equal(leoRes.status, 200)
  const defaultBody = await defaultRes.json()
  const leoBody = await leoRes.json()
  assert.equal(defaultBody.user_id, 'user-a')
  assert.equal(leoBody.user_id, 'user-a')
  assert.equal(defaultBody.entity_id, 'user-a::default')
  assert.equal(leoBody.entity_id, 'user-a::leo')
  assert.notEqual(defaultBody.mcp.token, leoBody.mcp.token)
  assert.equal(composio.createCalls, 2)
  assert.deepEqual(composio.createdFor, ['user-a::default', 'user-a::leo'])
  assert.equal(tokens.get(defaultBody.mcp.token)?.entityId, 'user-a::default')
  assert.equal(tokens.get(leoBody.mcp.token)?.entityId, 'user-a::leo')
  assert.equal(tokens.get(defaultBody.mcp.token)?.sub, 'user-a')
  assert.equal(tokens.get(leoBody.mcp.token)?.sub, 'user-a')

  const leoAgain = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leo',
    },
  })
  assert.equal(leoAgain.status, 200)
  assert.equal(composio.createCalls, 2)
  const leoAgainBody = await leoAgain.json()
  assert.equal(leoAgainBody.mcp.token, leoBody.mcp.token)
})

test('disconnecting Gmail on leo does not disable default home Gmail', async () => {
  const composio = new FakeComposio()
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a', 'content-type': 'application/json' },
    body: JSON.stringify({ connected_apps: ['gmail'] }),
  })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leo',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ connected_apps: ['gmail'] }),
  })
  tokens.stampApp('user-a::default', 'gmail', 'ca-gmail-default')
  tokens.stampApp('user-a::leo', 'gmail', 'ca-gmail-leo')
  composio.accountsById.set('ca-gmail-default', {
    id: 'ca-gmail-default',
    toolkit: 'gmail',
    status: 'ACTIVE',
  })
  composio.accountsById.set('ca-gmail-leo', {
    id: 'ca-gmail-leo',
    toolkit: 'gmail',
    status: 'ACTIVE',
  })
  const res = await app.request('/v1/apps/gmail/disconnect', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leo',
    },
  })
  assert.equal(res.status, 200)
  assert.deepEqual(composio.disabled, ['ca-gmail-leo'])
  assert.equal(composio.accountsById.get('ca-gmail-default')?.status, 'ACTIVE')
  assert.equal(composio.accountsById.get('ca-gmail-leo')?.status, 'INACTIVE')
  assert.deepEqual(tokens.getByEntityId('user-a::leo')?.connectedSlugs, [])
  assert.deepEqual(tokens.getByEntityId('user-a::default')?.connectedSlugs, ['gmail'])
})

test('invalid X-Work4You-Profile is 400', async () => {
  const { app, composio } = harness()
  for (const profile of ['Leo', '../x', 'has space', 'a'.repeat(65)]) {
    const res = await app.request('/v1/bootstrap', {
      method: 'POST',
      headers: {
        authorization: 'Bearer jwt_a',
        'x-work4you-profile': profile,
      },
    })
    assert.equal(res.status, 400, profile)
    const body = await res.json()
    assert.equal(body.error, 'invalid_profile')
  }
  assert.equal(composio.createCalls, 0)
})

test('empty X-Work4You-Profile is the default home', async () => {
  const { app, composio } = harness()
  const res = await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': '  ',
    },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.entity_id, 'user-a::default')
  assert.deepEqual(composio.createdFor, ['user-a::default'])
})

test('connected page is a close-this-window landing', async () => {
  const { app } = harness()
  const res = await app.request('/connected')
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /close this window/i)
})

test('connected callback without entity_id does not stamp another home Gmail', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-gmail-leaked', {
    id: 'ca-gmail-leaked',
    toolkit: 'gmail',
    status: 'ACTIVE',
  })
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt_a', 'content-type': 'application/json' },
    body: '{}',
  })
  const res = await app.request(
    '/connected?status=success&connected_account_id=ca-gmail-leaked',
  )
  assert.equal(res.status, 200)
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, undefined)
  assert.equal(composio.listCalls, 0)
})

test('connected callback with this HOME entity_id stamps the OAuth account', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca_pBEYml0xR6OU', {
    id: 'ca_pBEYml0xR6OU',
    toolkit: 'gmail',
    status: 'ACTIVE',
  })
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
      'x-work4you-profile': 'leona',
    },
    body: '{}',
  })
  const res = await app.request(
    '/connected?entity_id=user-a%3A%3Aleona&slug=gmail&status=success&connected_account_id=ca_pBEYml0xR6OU',
  )
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /close this window/i)
  assert.equal(tokens.getByEntityId('user-a::leona')?.accountIds.gmail, 'ca_pBEYml0xR6OU')
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, undefined)
})

test('wait stamps THIS home when this entity listAccounts is ACTIVE and /link id is still INITIATED', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-gmail', {
    id: 'ca-gmail',
    toolkit: 'gmail',
    status: 'INITIATED',
  })
  composio.accounts.set('user-a::default', [
    { id: 'ca-gmail-leaked', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  composio.accounts.set('user-a::leona', [
    { id: 'ca-callback', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
      'x-work4you-profile': 'leona',
    },
    body: '{}',
  })
  const wait = await app.request('/v1/apps/gmail/wait?timeout_ms=0&connection_id=ca-gmail', {
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leona',
    },
  })
  assert.equal(wait.status, 200)
  const body = await wait.json()
  assert.equal(body.connected, true)
  assert.equal(body.status, 'active')
  assert.equal(tokens.getByEntityId('user-a::leona')?.accountIds.gmail, 'ca-callback')
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, undefined)
})

test('wait stamps THIS home from Portal sub listAccounts when entity list is empty', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-gmail', {
    id: 'ca-gmail',
    toolkit: 'gmail',
    status: 'INITIATED',
  })
  composio.accounts.set('user-a', [
    { id: 'ca_pBEYml0xR6OU', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
      'x-work4you-profile': 'leona',
    },
    body: '{}',
  })
  const wait = await app.request('/v1/apps/gmail/wait?timeout_ms=0&connection_id=ca-gmail', {
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leona',
    },
  })
  assert.equal(wait.status, 200)
  const body = await wait.json()
  assert.equal(body.connected, true)
  assert.equal(body.status, 'active')
  assert.equal(tokens.getByEntityId('user-a::leona')?.accountIds.gmail, 'ca_pBEYml0xR6OU')
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, undefined)
})

test('wait does not stamp leona from default profile entity listAccounts', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-gmail', {
    id: 'ca-gmail',
    toolkit: 'gmail',
    status: 'INITIATED',
  })
  composio.accounts.set('user-a::default', [
    { id: 'ca-gmail-leaked', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
      'x-work4you-profile': 'leona',
    },
    body: '{}',
  })
  const wait = await app.request('/v1/apps/gmail/wait?timeout_ms=0&connection_id=ca-gmail', {
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leona',
    },
  })
  assert.equal(wait.status, 200)
  const body = await wait.json()
  assert.equal(body.connected, false)
  assert.equal(tokens.getByEntityId('user-a::leona')?.accountIds.gmail, undefined)
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, undefined)
  assert.equal(composio.listUserIds.includes('user-a::default'), false)
  assert.deepEqual([...new Set(composio.listUserIds)].sort(), ['user-a', 'user-a::leona'])
})

test('wait does not stamp THIS home from another Portal user listAccounts while THIS /link id is pending', async () => {
  const composio = new FakeComposio()
  composio.accountsById.set('ca-gmail', {
    id: 'ca-gmail',
    toolkit: 'gmail',
    status: 'INITIATED',
  })
  composio.accounts.set('user-b', [
    { id: 'ca-other-portal', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  composio.accounts.set('user-b::default', [
    { id: 'ca-other-portal', toolkit: 'gmail', status: 'ACTIVE' },
  ])
  const { app, tokens } = harness({ composio })
  await app.request('/v1/bootstrap', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt_a',
      'content-type': 'application/json',
      'x-work4you-profile': 'leona',
    },
    body: '{}',
  })
  const wait = await app.request('/v1/apps/gmail/wait?timeout_ms=0&connection_id=ca-gmail', {
    headers: {
      authorization: 'Bearer jwt_a',
      'x-work4you-profile': 'leona',
    },
  })
  assert.equal(wait.status, 200)
  const body = await wait.json()
  assert.equal(body.connected, false)
  assert.equal(body.status, 'initiated')
  assert.equal(tokens.getByEntityId('user-a::leona')?.accountIds.gmail, undefined)
  assert.equal(tokens.getByEntityId('user-a::default')?.accountIds.gmail, undefined)
})

test('allowlist never enables blocked native/search slugs', () => {
  assert.deepEqual(sessionToolkitSlugs(), [])
  const enabled = new Set(sessionToolkitSlugs(['gmail', 'notion', ...BLOCKED_SESSION_SLUGS, ...POPULAR_SLUGS]))
  for (const blocked of BLOCKED_SESSION_SLUGS) {
    assert.equal(enabled.has(blocked), false, blocked)
    assert.equal(isAllowlisted(blocked), false, blocked)
  }
  assert.ok(enabled.has('gmail'))
  assert.equal(enabled.has('notion'), false)
  assert.ok(getAllowlistApp('gmail'))
  assert.equal(sectionForComposioCategory('not a real category'), 'other')
  assert.equal(sectionForComposioCategory('crm'), 'crm')
  for (const slug of POPULAR_SLUGS) {
    if (isAllowlisted(slug)) {
      assert.ok(enabled.has(slug), slug)
    } else {
      assert.equal(enabled.has(slug), false, slug)
    }
  }
  assert.equal(ALLOWLIST.filter((app) => app.slug === 'canva').length, 1)
  assert.equal(ALLOWLIST.filter((app) => app.slug === 'canva_mcp').length, 1)
  assert.equal(toolkitLogoUrl('gmail'), 'https://logos.composio.dev/api/gmail')
  assert.equal(toolkitLogoUrl('granola_mcp'), 'https://logos.composio.dev/api/granola_mcp')
  assert.equal(toolkitLogoUrl(''), '')
  assert.equal(toolkitLogoUrl('../gmail'), 'https://logos.composio.dev/api/gmail')
})
