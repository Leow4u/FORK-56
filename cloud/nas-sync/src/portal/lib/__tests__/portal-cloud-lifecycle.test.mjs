import assert from 'node:assert/strict'
import test from 'node:test'

import { canOpenCloudChat, cloudAgentStatusDetail } from '../portal-cloud-lifecycle.ts'

test('canOpenCloudChat allows online, starting, and stopped wake', () => {
  const base = {
    dashboardUrl: 'https://agent.example.fly.dev',
    canUseCloud: true,
  }
  assert.equal(canOpenCloudChat({ ...base, status: 'online' }).allowed, true)
  assert.equal(canOpenCloudChat({ ...base, status: 'starting' }).allowed, true)
  assert.equal(
    canOpenCloudChat({ ...base, status: 'stopped' }).wakeOnOpen,
    true,
  )
  assert.equal(canOpenCloudChat({ ...base, status: 'parked' }).allowed, false)
})

test('cloudAgentStatusDetail stays minimal', () => {
  assert.equal(cloudAgentStatusDetail('online'), null)
  assert.match(cloudAgentStatusDetail('provisioning') ?? '', /momento/i)
})
