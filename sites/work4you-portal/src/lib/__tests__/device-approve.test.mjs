/**
 * Device-approve helpers + authorized success copy.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/device-approve.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canSubmitDeviceUserCode,
  deviceAuthorizedCopy,
  deviceVerificationPath,
  isDeviceAuthorizedPreview,
  normalizeDeviceUserCode,
  safePortalNextPath,
} from '../device-approve.ts'

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

describe('device authorized copy', () => {
  it('shows Autorizado and a discreet close-window hint', () => {
    const copy = deviceAuthorizedCopy()
    assert.equal(copy.title, 'Autorizado')
    assert.match(copy.hint, /feche essa janela/i)
    assert.match(copy.hint, /volte ao aplicativo/i)
    assert.doesNotMatch(copy.hint, /sessão continua sozinha/i)
    assert.doesNotMatch(copy.title, /autorizar dispositivo/i)
  })

  it('enables the layout preview only for step=done', () => {
    assert.equal(isDeviceAuthorizedPreview(true, 'done'), true)
    assert.equal(isDeviceAuthorizedPreview(true, 'DONE'), true)
    assert.equal(isDeviceAuthorizedPreview(true, 'form'), false)
    assert.equal(isDeviceAuthorizedPreview(false, 'done'), false)
  })
})
