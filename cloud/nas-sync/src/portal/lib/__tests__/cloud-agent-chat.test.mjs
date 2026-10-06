import assert from 'node:assert/strict'
import test from 'node:test'
import { cloudAgentChatUrl } from '../cloud-agent-chat.ts'

test('cloudAgentChatUrl appends /chat and trims trailing slash', () => {
  assert.equal(
    cloudAgentChatUrl('https://w4y-agent-abc.fly.dev/'),
    'https://w4y-agent-abc.fly.dev/chat',
  )
  assert.equal(
    cloudAgentChatUrl('https://w4y-agent-abc.fly.dev'),
    'https://w4y-agent-abc.fly.dev/chat',
  )
})

test('cloudAgentChatUrl rejects empty input', () => {
  assert.equal(cloudAgentChatUrl(null), null)
  assert.equal(cloudAgentChatUrl(''), null)
  assert.equal(cloudAgentChatUrl('   '), null)
})
