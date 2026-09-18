/**
 * Device-approve helpers + favicon invariant.
 * Run: node --experimental-strip-types --test cloud/nas-sync/src/portal/lib/__tests__/device-approve.test.mjs
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  canSubmitDeviceUserCode,
  deviceVerificationPath,
  normalizeDeviceUserCode,
  safePortalNextPath,
} from '../device-approve.ts'

const here = dirname(fileURLToPath(import.meta.url))
const VERCEL_TRIANGLE_FAVICON_MD5 = 'c30c7d42707a47a3f4591831641e50dc'

describe('safePortalNextPath', () => {
  it('allows in-app device return paths and rejects open redirects', () => {
    assert.equal(safePortalNextPath('/device?user_code=5X63-ZPDL'), '/device?user_code=5X63-ZPDL')
    assert.equal(safePortalNextPath('/login'), '/login')
    assert.equal(safePortalNextPath('https://evil.example/phish'), null)
    assert.equal(safePortalNextPath('//evil.example'), null)
    assert.equal(safePortalNextPath(''), null)
  })
})

describe('device user codes', () => {
  it('normalizes, builds the verification URL, and requires 8 characters', () => {
    assert.equal(normalizeDeviceUserCode('5x63-zpdl'), '5X63-ZPDL')
    assert.equal(deviceVerificationPath('5X63-ZPDL'), '/device?user_code=5X63-ZPDL')
    assert.equal(deviceVerificationPath(''), '/device')
    assert.equal(canSubmitDeviceUserCode('5X63-ZPDL'), true)
    assert.equal(canSubmitDeviceUserCode('SHORT'), false)
  })
})

describe('portal favicon', () => {
  it('is not the leftover Vercel triangle', () => {
    const nasIco = readFileSync(join(here, '../../../app/favicon.ico'))
    const viteIco = readFileSync(
      join(here, '../../../../../../sites/work4you-portal/public/favicon.ico')
    )
    for (const ico of [nasIco, viteIco]) {
      const digest = createHash('md5').update(ico).digest('hex')
      assert.notEqual(digest, VERCEL_TRIANGLE_FAVICON_MD5)
      assert.ok(ico.length > 1000)
      assert.equal(ico.subarray(0, 4).toString('hex'), '00000100')
    }
    assert.equal(nasIco.equals(viteIco), true)
  })
})
