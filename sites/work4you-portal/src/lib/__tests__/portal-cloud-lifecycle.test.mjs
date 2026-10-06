import assert from 'node:assert/strict'
import test from 'node:test'

import { canOpenCloudChat } from '../portal-cloud-lifecycle.ts'

test('canOpenCloudChat mirrors NAS policy for stopped wake', () => {
  const out = canOpenCloudChat({
    dashboardUrl: 'https://x.fly.dev',
    status: 'stopped',
    canUseCloud: true,
  })
  assert.equal(out.allowed, true)
  assert.equal(out.wakeOnOpen, true)
})
