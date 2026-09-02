import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BLOCKED_SESSION_SLUGS, sessionToolkitSlugs } from './allowlist.js'
import { createComposioClient, statusFromAccount } from './composio.js'

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
