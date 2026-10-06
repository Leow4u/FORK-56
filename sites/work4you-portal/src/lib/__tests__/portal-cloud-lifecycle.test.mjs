import assert from 'node:assert/strict'
import test from 'node:test'

import { canOpenCloudChat } from '../portal-cloud-lifecycle.ts'

test('canOpenCloudChat allows starting without wake flag', () => {
  const out = canOpenCloudChat({
    dashboardUrl: 'https://x.fly.dev',
    status: 'starting',
    canUseCloud: true,
  })
  assert.equal(out.allowed, true)
  assert.equal(out.wakeOnOpen, false)
})
