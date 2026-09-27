import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createOpenAIFetch, openaiAudioHeaders } from './openai.js'

test('openaiAudioHeaders uses the platform key and drops client auth', () => {
  const incoming = new Headers({
    authorization: 'Bearer portal-token',
    'x-api-key': 'portal-token',
    'content-type': 'multipart/form-data; boundary=abc',
    'x-idempotency-key': 'tts-1',
  })
  const headers = openaiAudioHeaders('sk-platform', incoming)
  assert.equal(headers.get('authorization'), 'Bearer sk-platform')
  assert.equal(headers.get('x-api-key'), null)
  assert.equal(
    headers.get('content-type'),
    'multipart/form-data; boundary=abc',
  )
  assert.equal(headers.get('x-idempotency-key'), 'tts-1')
})

test('createOpenAIFetch never forwards the Portal bearer', async () => {
  const seen: string[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push(new Headers(init?.headers).get('authorization') || '')
    assert.equal(String(input), 'https://api.openai.com/v1/audio/transcriptions')
    return new Response('{}', { status: 200 })
  }
  const run = createOpenAIFetch({
    apiUrl: 'https://api.openai.com',
    apiKey: 'sk-platform',
    timeoutMs: 1000,
    fetchImpl,
  })
  await run('/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: 'Bearer portal-token' },
    body: '{}',
  })
  assert.deepEqual(seen, ['Bearer sk-platform'])
})
