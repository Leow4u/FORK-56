import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createFirecrawlFetch, firecrawlHeaders } from './firecrawl.js'

test('firecrawlHeaders uses the platform key and drops client auth', () => {
  const incoming = new Headers({
    authorization: 'Bearer portal-token',
    'x-api-key': 'portal-token',
    'content-type': 'application/json',
  })
  const headers = firecrawlHeaders('fc-platform', incoming)
  assert.equal(headers.get('authorization'), 'Bearer fc-platform')
  assert.equal(headers.get('x-api-key'), null)
  assert.equal(headers.get('content-type'), 'application/json')
})

test('createFirecrawlFetch never forwards the Portal bearer', async () => {
  const seen: string[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push(new Headers(init?.headers).get('authorization') || '')
    assert.equal(String(input), 'https://api.firecrawl.dev/v2/search')
    return new Response('{}', { status: 200 })
  }
  const run = createFirecrawlFetch({
    apiUrl: 'https://api.firecrawl.dev',
    apiKey: 'fc-platform',
    timeoutMs: 1000,
    fetchImpl,
  })
  await run('/v2/search', {
    method: 'POST',
    headers: { authorization: 'Bearer portal-token' },
    body: '{}',
  })
  assert.deepEqual(seen, ['Bearer fc-platform'])
})
