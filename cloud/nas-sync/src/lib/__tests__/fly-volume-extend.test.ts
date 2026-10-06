/**
 * Volume extend contract against the Fly Machines API.
 * Run: node --import ./cloud/nas-sync/src/lib/__tests__/register-ts-resolve.mjs --test cloud/nas-sync/src/lib/__tests__/fly-volume-extend.test.ts
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { extendVolume } from '../fly-machines.ts'

interface SeenRequest {
  body: unknown
  method: string
  url: string
}

const realFetch = globalThis.fetch
let seen: SeenRequest[] = []

function answer(status: number, body: string) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      method: init?.method ?? 'GET',
      url: String(input),
    })
    return new Response(body, { status })
  }) as typeof fetch
}

describe('extendVolume', () => {
  beforeEach(() => {
    seen = []
    process.env.FLY_API_TOKEN = 'test-token'
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('grows the volume with PUT on the extend route', async () => {
    answer(200, '{"needs_restart":false}')
    await extendVolume({ appName: 'w4y-agent-a', volumeId: 'vol_1', sizeGb: 20 })
    assert.equal(seen.length, 1)
    assert.equal(seen[0].method, 'PUT')
    assert.ok(seen[0].url.endsWith('/apps/w4y-agent-a/volumes/vol_1/extend'))
    assert.deepEqual(seen[0].body, { size_gb: 20 })
  })

  it('treats a volume already at that size as done', async () => {
    answer(400, '{"error":"Invalid volume size - Specified volume size must be greater than 10"}')
    await extendVolume({ appName: 'w4y-agent-a', volumeId: 'vol_1', sizeGb: 10 })
  })

  it('still surfaces a missing volume', async () => {
    answer(404, '{"error":"volume not found"}')
    await assert.rejects(
      extendVolume({ appName: 'w4y-agent-a', volumeId: 'vol_gone', sizeGb: 20 }),
      /404/,
    )
  })
})
