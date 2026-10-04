import { describe, expect, it } from 'vitest'

import type { MessagingEnvVarInfo } from '@/types/work4you'

import { googleChatMode, subscriptionProject } from './google-chat-config'

function envVar(key: string, value: null | string): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: false,
    is_set: Boolean(value),
    key,
    prompt: key,
    redacted_value: null,
    required: false,
    url: null,
    value
  }
}

describe('google chat config helpers', () => {
  it('reads the project out of a full subscription path only', () => {
    expect(subscriptionProject('projects/my-project/subscriptions/work4you-chat')).toBe('my-project')
    expect(subscriptionProject('work4you-chat')).toBeNull()
  })

  it('tells the saved mode from what is saved, Pub/Sub first', () => {
    expect(googleChatMode([])).toBe('pubsub')
    expect(googleChatMode([envVar('GOOGLE_CHAT_HTTP_EVENTS_URL', 'https://chat.example.com/events')])).toBe('http')
    expect(
      googleChatMode([
        envVar('GOOGLE_CHAT_HTTP_EVENTS_URL', 'https://chat.example.com/events'),
        envVar('GOOGLE_CHAT_SUBSCRIPTION_NAME', 'projects/p/subscriptions/s')
      ])
    ).toBe('pubsub')
  })
})
