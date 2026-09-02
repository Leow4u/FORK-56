import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BLOCKED_SESSION_SLUGS, sessionToolkitSlugs } from './allowlist.js'
import {
  createComposioClient,
  formatComposioError,
  statusFromAccount,
  toComposioUserId,
} from './composio.js'

test('statusFromAccount maps Composio account states', () => {
  assert.equal(statusFromAccount('ACTIVE'), 'active')
  assert.equal(statusFromAccount('EXPIRED'), 'expired')
  assert.equal(statusFromAccount('INITIATED'), 'initiated')
  assert.equal(statusFromAccount(''), 'disconnected')
})

test('createSession posts user_id, allowlist, and callback_url', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
    calls.push({ url: String(input), body })
    return new Response(
      JSON.stringify({
        session_id: 'sess-1',
        mcp: { url: 'https://mcp.composio.dev/s1' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    callbackUrl: 'https://connectors-api.work4you.ai/connected',
    fetchImpl,
  })
  const session = await client.createSession('portal-sub-1', { gmail: 'ac_gmail' })
  assert.equal(session.sessionId, 'sess-1')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://backend.composio.dev/api/v3.1/tool_router/session')
  assert.equal(calls[0].body.user_id, 'portal-sub-1')
  const toolkits = calls[0].body.toolkits as { enable: string[] }
  assert.deepEqual(toolkits.enable, sessionToolkitSlugs())
  for (const blocked of BLOCKED_SESSION_SLUGS) {
    assert.equal(toolkits.enable.includes(blocked), false, blocked)
  }
  const manage = calls[0].body.manage_connections as { callback_url: string }
  assert.equal(manage.callback_url, 'https://connectors-api.work4you.ai/connected')
  assert.deepEqual(calls[0].body.auth_configs, { gmail: 'ac_gmail' })
})

test('getSession returns null on 404', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response('{"error":"missing"}', { status: 404 })
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const session = await client.getSession('gone')
  assert.equal(session, null)
})

test('toComposioUserId keeps safe ids and hashes Privy DIDs 1:1', () => {
  assert.equal(toComposioUserId('portal-sub-1'), 'portal-sub-1')
  const did = 'did:privy:cmt2abcdefghijklmnopqrstuv'
  const mapped = toComposioUserId(did)
  assert.match(mapped, /^w4y_[a-f0-9]{64}$/)
  assert.equal(mapped.includes(':'), false)
  assert.equal(toComposioUserId(did), mapped)
  assert.notEqual(toComposioUserId('did:privy:other'), mapped)
})

test('formatComposioError keeps the public message and redacts keys', () => {
  assert.equal(
    formatComposioError(400, {
      error: {
        message: 'user_id format is invalid',
        suggested_fix: 'use ak_leakedsecret identifiers',
      },
    }),
    'composio_400: user_id format is invalid — use ak_*** identifiers',
  )
  assert.equal(formatComposioError(502, null), 'composio_502')
})

test('createSession hashes DID user ids', async () => {
  const calls: Array<{ body: Record<string, unknown> }> = []
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls.push({ body: JSON.parse(String(init?.body || '{}')) })
    return new Response(
      JSON.stringify({ session_id: 'sess-1', mcp: { url: 'https://mcp.composio.dev/s1' } }),
      { status: 200 },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  await client.createSession('did:privy:abc', {})
  assert.equal(calls[0].body.user_id, toComposioUserId('did:privy:abc'))
})

test('createSession retries with an empty enable list after a 400 allowlist', async () => {
  const enableCalls: Array<string[] | undefined> = []
  let n = 0
  const fetchImpl: typeof fetch = async (_input, init) => {
    n += 1
    const body = JSON.parse(String(init?.body || '{}')) as { toolkits?: { enable?: string[] } }
    enableCalls.push(body.toolkits?.enable)
    if (n === 1) {
      return new Response(
        JSON.stringify({ error: { message: 'invalid toolkit granola_mcp' } }),
        { status: 400 },
      )
    }
    return new Response(
      JSON.stringify({ session_id: 'sess-2', mcp: { url: 'https://mcp.composio.dev/s2' } }),
      { status: 200 },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const session = await client.createSession('user-a', {})
  assert.equal(session.sessionId, 'sess-2')
  assert.deepEqual(enableCalls[0], sessionToolkitSlugs())
  assert.deepEqual(enableCalls[1], [])
})

test('authorize uses v3.1 session link', async () => {
  const urls: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input))
    return new Response(
      JSON.stringify({
        redirect_url: 'https://connect.composio.dev/googlecalendar',
        connected_account_id: 'ca-1',
      }),
      { status: 201 },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const link = await client.authorize(
    'sess-1',
    'googlecalendar',
    'https://connectors-api.work4you.ai/connected',
    'did:privy:abc',
  )
  assert.equal(link.redirectUrl, 'https://connect.composio.dev/googlecalendar')
  assert.equal(
    urls[0],
    'https://backend.composio.dev/api/v3.1/tool_router/session/sess-1/link',
  )
  assert.equal(urls.some((url) => url.includes('/api/v3/tool_router/')), false)
})

test('authorize falls back to connected_accounts/link after session link 400', async () => {
  const urls: string[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    urls.push(url)
    if (url.includes('/tool_router/session/') && url.endsWith('/link')) {
      return new Response(
        JSON.stringify({ error: { message: 'connected account already defined' } }),
        { status: 400 },
      )
    }
    if (url.includes('/auth_configs') && (!init?.method || init.method === 'GET')) {
      return new Response(
        JSON.stringify({
          items: [{ id: 'ac_gcal', status: 'ENABLED', is_composio_managed: true }],
        }),
        { status: 200 },
      )
    }
    if (url.endsWith('/connected_accounts/link')) {
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
      assert.equal(body.auth_config_id, 'ac_gcal')
      assert.equal(body.user_id, toComposioUserId('did:privy:abc'))
      return new Response(
        JSON.stringify({ redirect_url: 'https://connect.composio.dev/hosted', id: 'ca-9' }),
        { status: 201 },
      )
    }
    return new Response('{}', { status: 500 })
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const link = await client.authorize(
    'sess-1',
    'googlecalendar',
    'https://connectors-api.work4you.ai/connected',
    'did:privy:abc',
  )
  assert.equal(link.redirectUrl, 'https://connect.composio.dev/hosted')
  assert.ok(urls.some((url) => url.endsWith('/api/v3.1/connected_accounts/link')))
})
