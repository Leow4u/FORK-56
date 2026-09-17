import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  NOTARY_WAIT_TIMEOUT_SEC,
  notarytoolProfileSubmitArgs,
  notarytoolSubmitArgs,
  shouldSkipAfterSignNotarize,
} from './notary-config.mjs'

test('CI afterSign skip is opt-in and off by default', () => {
  assert.equal(shouldSkipAfterSignNotarize({}), false)
  assert.equal(shouldSkipAfterSignNotarize({ WORK4YOU_SKIP_AFTERSIGN_NOTARIZE: '' }), false)
  assert.equal(shouldSkipAfterSignNotarize({ WORK4YOU_SKIP_AFTERSIGN_NOTARIZE: '0' }), false)
  assert.equal(shouldSkipAfterSignNotarize({ WORK4YOU_SKIP_AFTERSIGN_NOTARIZE: '1' }), true)
})

test('notarytool submit always waits with a finite timeout', () => {
  const args = notarytoolSubmitArgs('/tmp/Work4You.dmg', {
    keyPath: '/tmp/key.p8',
    keyId: 'KEYID',
    issuer: 'ISSUER',
  })
  assert.ok(args.includes('--wait'))
  assert.ok(args.includes('--timeout'))
  assert.equal(args[args.indexOf('--timeout') + 1], String(NOTARY_WAIT_TIMEOUT_SEC))
  assert.ok(NOTARY_WAIT_TIMEOUT_SEC > 0)
  assert.ok(NOTARY_WAIT_TIMEOUT_SEC < 90 * 60)

  const profileArgs = notarytoolProfileSubmitArgs('/tmp/Work4You.dmg', 'work4you')
  assert.equal(profileArgs[profileArgs.indexOf('--timeout') + 1], String(NOTARY_WAIT_TIMEOUT_SEC))
})
