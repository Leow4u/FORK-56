import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TelegramApiError, createTelegramClient } from './telegram.js'

const TOKEN = '1234567:manager-secret-token'

type Call = { url: string; init: RequestInit | undefined }

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init }
    calls.push(call)
    return respond(call)
  }) as typeof fetch
  return { calls, impl }
}

function ok(result: unknown): Response {
  return Response.json({ ok: true, result })
}

test('calls go to the Bot API as JSON POSTs', async () => {
  const { calls, impl } = fakeFetch(() => ok('7700000001:AAH-token'))
  const client = createTelegramClient({ token: TOKEN, apiBase: 'https://bot.example/', fetchImpl: impl })

  assert.equal(await client.getManagedBotToken(7_700_000_001), '7700000001:AAH-token')
  assert.equal(calls[0].url, `https://bot.example/bot${TOKEN}/getManagedBotToken`)
  assert.equal(calls[0].init?.method, 'POST')
  assert.equal(new Headers(calls[0].init?.headers).get('content-type'), 'application/json')
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { user_id: 7_700_000_001 })
})

test('getUpdates and deleteWebhook send what the loop asks for', async () => {
  const { calls, impl } = fakeFetch((call) => ok(call.url.endsWith('/getUpdates') ? [] : true))
  const client = createTelegramClient({ token: TOKEN, fetchImpl: impl })

  await client.deleteWebhook()
  assert.deepEqual(await client.getUpdates({ offset: 9, timeout: 50, allowed_updates: ['managed_bot'] }), [])

  assert.equal(calls[0].url, `https://api.telegram.org/bot${TOKEN}/deleteWebhook`)
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { drop_pending_updates: false })
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
    offset: 9,
    timeout: 50,
    allowed_updates: ['managed_bot'],
  })
})

test('a Bot API error keeps its code, description and retry hint', async () => {
  const { impl } = fakeFetch(() =>
    Response.json(
      { ok: false, error_code: 429, description: 'Too Many Requests: retry after 3', parameters: { retry_after: 3 } },
      { status: 429 },
    ),
  )
  const client = createTelegramClient({ token: TOKEN, fetchImpl: impl })

  await assert.rejects(client.getMe(), (err: unknown) => {
    assert.ok(err instanceof TelegramApiError)
    assert.equal(err.method, 'getMe')
    assert.equal(err.code, 429)
    assert.equal(err.description, 'Too Many Requests: retry after 3')
    assert.equal(err.retryAfter, 3)
    return true
  })
})

test('no error ever carries the manager bot token', async () => {
  const failures = [
    () => {
      throw new TypeError(`fetch failed for https://api.telegram.org/bot${TOKEN}/getMe`)
    },
    () => new Response('<html>bad gateway</html>', { status: 502 }),
    () => Response.json({ ok: false, error_code: 401, description: 'Unauthorized' }, { status: 401 }),
  ]
  for (const respond of failures) {
    const client = createTelegramClient({ token: TOKEN, fetchImpl: fakeFetch(respond).impl })
    await assert.rejects(client.getMe(), (err: unknown) => {
      assert.ok(err instanceof TelegramApiError)
      assert.equal(err.message.includes(TOKEN), false, err.message)
      assert.equal(JSON.stringify(err).includes(TOKEN), false)
      assert.equal(String(err.stack).includes(TOKEN), false)
      return true
    })
  }
})
