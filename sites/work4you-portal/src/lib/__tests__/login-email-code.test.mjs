/**
 * Email OTP step copy — must not look like the desktop device token.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/login-email-code.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isDevicePairingNext,
  isLoginEmailCodePreview,
  loginDevicePairingNotice,
  loginEmailCodeCopy,
  shouldShowLoginAlternatives,
} from '../login-email-code.ts'

describe('login email-code layout', () => {
  it('hides OAuth and create-account chrome while awaiting the inbox code', () => {
    assert.equal(shouldShowLoginAlternatives(false), true)
    assert.equal(shouldShowLoginAlternatives(true), false)
  })

  it('treats /device next as desktop pairing without accepting protocol-relative URLs', () => {
    assert.equal(isDevicePairingNext('/device?user_code=QRL7-LDXA'), true)
    assert.equal(isDevicePairingNext('/device'), true)
    assert.equal(isDevicePairingNext('/orgs/abc'), false)
    assert.equal(isDevicePairingNext('//evil.example/device'), false)
    assert.equal(isDevicePairingNext(null), false)
  })

  it('enables the layout preview only for step=code', () => {
    assert.equal(isLoginEmailCodePreview(true, 'code'), true)
    assert.equal(isLoginEmailCodePreview(true, 'CODE'), true)
    assert.equal(isLoginEmailCodePreview(true, 'email'), false)
    assert.equal(isLoginEmailCodePreview(false, 'code'), false)
  })
})

describe('login email-code copy', () => {
  it('names the inbox and the destination email, not a generic Código', () => {
    const copy = loginEmailCodeCopy('  ana@empresa.com  ')
    assert.equal(copy.email, 'ana@empresa.com')
    assert.match(copy.leadBefore, /e-mail|código de verificação/i)
    assert.match(copy.label, /e-mail/i)
    assert.notEqual(copy.label, 'Código')
    assert.equal(copy.deviceHint, '')
    assert.match(copy.resend, /Reenviar/)
    assert.match(copy.useOtherEmail, /outro e-mail/i)
  })

  it('warns device-pairing users not to type the desktop token', () => {
    const copy = loginEmailCodeCopy('ana@empresa.com', true)
    assert.match(copy.deviceHint, /Desktop/)
    assert.match(copy.deviceHint, /não use o código/i)
    assert.match(loginDevicePairingNotice(true), /não o escreva aqui/i)
    assert.equal(loginDevicePairingNotice(false), '')
  })
})
