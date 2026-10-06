import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canOpenCloudChat,
  cloudAgentStatusDetail,
  cloudInstanceLifecycleHint,
  cloudChatWakeHint,
} from '../portal-cloud-lifecycle.ts'

test('canOpenCloudChat allows online and stopped wake paths', () => {
  const base = {
    dashboardUrl: 'https://agent.example.fly.dev',
    canUseCloud: true,
  }
  assert.deepEqual(canOpenCloudChat({ ...base, status: 'online' }), {
    allowed: true,
    chatUrl: 'https://agent.example.fly.dev/chat',
    wakeOnOpen: false,
  })
  assert.deepEqual(canOpenCloudChat({ ...base, status: 'stopped' }), {
    allowed: true,
    chatUrl: 'https://agent.example.fly.dev/chat',
    wakeOnOpen: true,
  })
  assert.equal(canOpenCloudChat({ ...base, status: 'parked' }).allowed, false)
  assert.equal(canOpenCloudChat({ ...base, status: 'online', canUseCloud: false }).allowed, false)
})

test('cloudInstanceLifecycleHint mentions disk for online paid', () => {
  const hint = cloudInstanceLifecycleHint('online', true)
  assert.match(hint ?? '', /disco|adormece/i)
})

test('cloudAgentStatusDetail for parked free mentions disk', () => {
  const text = cloudAgentStatusDetail('parked', false)
  assert.match(text, /disco|pausa/i)
})

test('cloudChatWakeHint only when wakeOnOpen', () => {
  assert.equal(cloudChatWakeHint(false), null)
  assert.match(cloudChatWakeHint(true) ?? '', /acorda/i)
})
