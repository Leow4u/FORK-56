/**
 * Email OTP step copy — must not look like the desktop device token.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/login-email-code.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  PRIVY_EMAIL_BRANDING,
  applyEmailOtpBackspace,
  applyEmailOtpInput,
  isCompleteEmailOtp,
  isDevicePairingNext,
  isLoginEmailCodePreview,
  loginDevicePairingNotice,
  loginEmailCodeCopy,
  normalizeEmailOtp,
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
  it('asks for the inbox confirmation code and names the destination email', () => {
    const copy = loginEmailCodeCopy('  ana@empresa.com  ')
    assert.equal(copy.email, 'ana@empresa.com')
    assert.match(copy.title, /código de confirmação/i)
    assert.match(copy.leadBefore, /caixa/i)
    assert.match(copy.leadAfter, /código abaixo/i)
    assert.notEqual(copy.title, 'Código')
    assert.equal(copy.deviceHint, '')
    assert.match(copy.resendLead, /não recebeu o e-mail/i)
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

describe('email OTP digits', () => {
  it('normalizes paste, per-box input, and backspace without accepting letters', () => {
    assert.equal(normalizeEmailOtp('27-47-22'), '274722')
    assert.equal(normalizeEmailOtp('abc12'), '12')
    assert.equal(applyEmailOtpInput('', 0, '274722'), '274722')
    assert.equal(applyEmailOtpInput('27', 2, '4'), '274')
    assert.equal(isCompleteEmailOtp('274722'), true)
    assert.equal(isCompleteEmailOtp('27472'), false)
    assert.deepEqual(applyEmailOtpBackspace('274', 2), { code: '27', focus: 2 })
    assert.deepEqual(applyEmailOtpBackspace('27', 2), { code: '2', focus: 1 })
  })
})

describe('Privy email branding contract', () => {
  it('uses the public Work4You name and hosted favicon, not the dashboard slug', () => {
    assert.equal(PRIVY_EMAIL_BRANDING.dashboardAppName, 'Work4You')
    assert.notEqual(PRIVY_EMAIL_BRANDING.dashboardAppName.toLowerCase(), 'work4you-portal')
    assert.equal(
      PRIVY_EMAIL_BRANDING.emailLogoUrl,
      'https://portal.work4you.ai/brand/work4you-favicon-transparent-1024.png',
    )
  })

  it('ships a square PNG at the public favicon path used in OTP emails', () => {
    const pngPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../public/brand/work4you-favicon-transparent-1024.png',
    )
    const buf = fs.readFileSync(pngPath)
    assert.equal(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true)
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    assert.equal(width, height)
    assert.ok(width >= 64)
  })
})
