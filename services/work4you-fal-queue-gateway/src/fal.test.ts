import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createFalFetch, falHeaders } from './fal.js'

test('falHeaders uses the platform Key and strips client Authorization', () => {
  const incoming = new Headers({
    authorization: 'Key portal-user-token',
    'content-type': 'application/json',
    'x-fal-client-timeout': '120',
    cookie: 'session=nope',
  })
  const h = falHeaders('platform-fal-secret', incoming)
  assert.equal(h.get('authorization'), 'Key platform-fal-secret')
  assert.equal(h.get('x-fal-client-timeout'), '120')
  assert.equal(h.get('cookie'), null)
})

test('createFalFetch posts to the queue origin with the platform key', async () => {
  let seenUrl = ''
  let seenAuth = ''
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    seenUrl = String(url)
    seenAuth = new Headers(init?.headers).get('authorization') || ''
    return new Response('{}', { status: 200 })
  }) as typeof fetch

  const run = createFalFetch({
    queueUrl: 'https://queue.fal.run',
    apiKey: 'platform-fal-secret',
    timeoutMs: 5_000,
    fetchImpl,
  })
  await run('/fal-ai/flux-2/klein/9b', {
    method: 'POST',
    headers: { authorization: 'Key portal-user-token' },
    body: '{"prompt":"x"}',
  })
  assert.equal(seenUrl, 'https://queue.fal.run/fal-ai/flux-2/klein/9b')
  assert.equal(seenAuth, 'Key platform-fal-secret')
})
