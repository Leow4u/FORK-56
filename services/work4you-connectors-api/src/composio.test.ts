import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BLOCKED_SESSION_SLUGS, sessionToolkitSlugs } from './allowlist.js'
import { connectedAccountIdFromLinkPayload, createComposioClient, statusFromAccount } from './composio.js'

test('statusFromAccount maps Composio account states', () => {
  assert.equal(statusFromAccount('ACTIVE'), 'active')
  assert.equal(statusFromAccount('EXPIRED'), 'expired')
  assert.equal(statusFromAccount('INITIATED'), 'initiated')
  assert.equal(statusFromAccount('INITIALIZING'), 'initiated')
  assert.equal(statusFromAccount(''), 'disconnected')
})

test('connectedAccountIdFromLinkPayload does not treat link_token as the account id', () => {
  assert.equal(
    connectedAccountIdFromLinkPayload({
      link_token: 'lt-gmail',
      redirect_url: 'https://connect.composio.dev/gmail',
    }),
    null,
  )
  assert.equal(
    connectedAccountIdFromLinkPayload({
      link_token: 'lt-gmail',
      redirect_url: 'https://connect.composio.dev/gmail',
      data: { id: 'lt-gmail' },
    }),
    null,
  )
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
  const session = await client.createSession('portal-sub-1', { gmail: 'ac_gmail' }, ['gmail'])
  assert.equal(session.sessionId, 'sess-1')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://backend.composio.dev/api/v3.1/tool_router/session')
  assert.equal(calls[0].body.user_id, 'portal-sub-1')
  const toolkits = calls[0].body.toolkits as { enable: string[] }
  assert.deepEqual(toolkits.enable, ['gmail'])
  assert.deepEqual(sessionToolkitSlugs(), [])
  for (const blocked of BLOCKED_SESSION_SLUGS) {
    assert.equal(toolkits.enable.includes(blocked), false, blocked)
  }
  const manage = calls[0].body.manage_connections as { callback_url: string }
  assert.equal(manage.callback_url, 'https://connectors-api.work4you.ai/connected')
  assert.deepEqual(calls[0].body.auth_configs, { gmail: 'ac_gmail' })
})

test('getAccount reads one connected account by id', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.equal(String(input), 'https://backend.composio.dev/api/v3.1/connected_accounts/ca-1')
    return new Response(
      JSON.stringify({
        id: 'ca-1',
        status: 'ACTIVE',
        toolkit: { slug: 'gmail' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const account = await client.getAccount('ca-1')
  assert.equal(account?.id, 'ca-1')
  assert.equal(account?.toolkit, 'gmail')
  assert.equal(account?.status, 'ACTIVE')
})

test('getAccount reads ACTIVE from nested state when top-level status is missing', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        id: 'ca-1',
        toolkit: { slug: 'gmail' },
        state: { val: { status: 'ACTIVE' } },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const account = await client.getAccount('ca-1')
  assert.equal(account?.status, 'ACTIVE')
  assert.equal(account?.toolkit, 'gmail')
})

test('getAccount falls back to v3 when v3.1 returns 404', async () => {
  const urls: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input))
    if (String(input).includes('/api/v3.1/')) {
      return new Response('{"error":"missing"}', { status: 404 })
    }
    return new Response(
      JSON.stringify({
        id: 'ca-1',
        status: 'ACTIVE',
        toolkit: { slug: 'gmail' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const account = await client.getAccount('ca-1')
  assert.equal(account?.id, 'ca-1')
  assert.equal(account?.status, 'ACTIVE')
  assert.deepEqual(urls, [
    'https://backend.composio.dev/api/v3.1/connected_accounts/ca-1',
    'https://backend.composio.dev/api/v3/connected_accounts/ca-1',
  ])
})

test('listAccounts reads ACTIVE from nested state on v3.1', async () => {
  const urls: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input))
    return new Response(
      JSON.stringify({
        items: [
          {
            id: 'ca-link',
            toolkit: { slug: 'gmail' },
            status: 'INITIATED',
          },
          {
            id: 'ca-oauth',
            toolkit: { slug: 'gmail' },
            state: { val: { status: 'ACTIVE' } },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const accounts = await client.listAccounts('user-a::leona')
  assert.deepEqual(urls, [
    'https://backend.composio.dev/api/v3.1/connected_accounts?user_ids=user-a%3A%3Aleona&account_type=ALL',
  ])
  assert.equal(accounts.length, 2)
  assert.equal(accounts[0]?.status, 'INITIATED')
  assert.equal(accounts[1]?.id, 'ca-oauth')
  assert.equal(accounts[1]?.toolkit, 'gmail')
  assert.equal(accounts[1]?.status, 'ACTIVE')
})

test('getAccount returns null on 404', async () => {
  let calls = 0
  const fetchImpl: typeof fetch = async () => {
    calls += 1
    return new Response('{"error":"missing"}', { status: 404 })
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  assert.equal(await client.getAccount('gone'), null)
  assert.equal(calls, 2)
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

test('authorize reads connected account id from /link JSON shapes and redirect query', async () => {
  const cases: Array<{ body: Record<string, unknown>; expected: string }> = [
    {
      body: {
        link_token: 'lt-gmail',
        redirect_url: 'https://connect.composio.dev/gmail',
        connected_account_id: 'ca_pxlY9GfmtUyl2',
      },
      expected: 'ca_pxlY9GfmtUyl2',
    },
    {
      body: { redirect_url: 'https://connect.composio.dev/gmail', connected_account_id: 'ca-a' },
      expected: 'ca-a',
    },
    {
      body: { redirectUrl: 'https://connect.composio.dev/gmail', connectedAccountId: 'ca-b' },
      expected: 'ca-b',
    },
    {
      body: { redirect_url: 'https://connect.composio.dev/gmail', connection_id: 'ca-c' },
      expected: 'ca-c',
    },
    {
      body: {
        redirect_url: 'https://connect.composio.dev/gmail',
        data: { connected_account_id: 'ca-d' },
      },
      expected: 'ca-d',
    },
    {
      body: {
        redirect_url: 'https://connect.composio.dev/gmail',
        connected_account: { id: 'ca-e' },
      },
      expected: 'ca-e',
    },
    {
      body: {
        redirect_url: 'https://connect.composio.dev/gmail?connected_account_id=ca-f',
      },
      expected: 'ca-f',
    },
  ]

  for (const row of cases) {
    const urls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input))
      return new Response(JSON.stringify(row.body), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    }
    const client = createComposioClient({
      apiBase: 'https://backend.composio.dev',
      apiKey: 'ak_secret',
      fetchImpl,
    })
    const link = await client.authorize('sess-1', 'gmail', 'https://connectors-api.work4you.ai/connected')
    assert.deepEqual(urls, [
      'https://backend.composio.dev/api/v3.1/tool_router/session/sess-1/link',
    ])
    assert.equal(link.redirectUrl, String(row.body.redirect_url || row.body.redirectUrl))
    assert.equal(link.connectedAccountId, row.expected, JSON.stringify(row.body))
  }
})

test('getSession reads config.user_id', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.equal(
      String(input),
      'https://backend.composio.dev/api/v3.1/tool_router/session/sess-1',
    )
    return new Response(
      JSON.stringify({
        session_id: 'sess-1',
        mcp: { url: 'https://mcp.composio.dev/s1' },
        config: { user_id: 'user-a::leona' },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const session = await client.getSession('sess-1')
  assert.equal(session?.sessionId, 'sess-1')
  assert.equal(session?.userId, 'user-a::leona')
})

test('listSessionToolkits reads ACTIVE connected_account for this toolkit', async () => {
  const urls: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input))
    return new Response(
      JSON.stringify({
        items: [
          {
            slug: 'gmail',
            connected_account: { id: 'ca-oauth', status: 'ACTIVE' },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  const client = createComposioClient({
    apiBase: 'https://backend.composio.dev',
    apiKey: 'ak_secret',
    fetchImpl,
  })
  const accounts = await client.listSessionToolkits('sess-1', 'gmail')
  assert.deepEqual(urls, [
    'https://backend.composio.dev/api/v3.1/tool_router/session/sess-1/toolkits?limit=50&toolkits=gmail',
  ])
  assert.equal(accounts.length, 1)
  assert.equal(accounts[0]?.id, 'ca-oauth')
  assert.equal(accounts[0]?.toolkit, 'gmail')
  assert.equal(accounts[0]?.status, 'ACTIVE')
})
