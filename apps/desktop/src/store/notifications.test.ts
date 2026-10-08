import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  $notifications,
  clearNotifications,
  dismissNotification,
  isDiskFullErrorMessage,
  NOTIFICATION_CATEGORY_ENABLED,
  type NotificationCategory,
  notify,
  notifyError
} from './notifications'

beforeEach(() => {
  clearNotifications()
})

function lastMessage(): string {
  return $notifications.get()[0]?.message ?? ''
}

// Regression for #39365: a gateway auth 401 (bad API_SERVER_KEY) must not be
// summarized as a provider (OpenAI/OpenRouter) API key problem.
test('gateway_auth_failed error is summarized as gateway auth, not provider key', () => {
  notifyError(
    new Error(
      '401 {"error": {"message": "Invalid gateway API key (API_SERVER_KEY)", "type": "gateway_auth_error", "code": "gateway_auth_failed"}}'
    ),
    'Request failed'
  )

  expect(lastMessage()).toContain('API_SERVER_KEY')
  expect(lastMessage()).not.toMatch(/OpenAI/i)
})

test('provider invalid_api_key error still maps to the OpenAI summary', () => {
  notifyError(
    new Error('401 {"error": {"message": "Incorrect API key provided", "code": "invalid_api_key"}}'),
    'Request failed'
  )

  expect(lastMessage()).toMatch(/OpenAI rejected the API key/i)
})

test('disk-full / ENOSPC errors toast a free-space message', () => {
  expect(isDiskFullErrorMessage('OSError: [Errno 28] No space left on device')).toBe(true)
  expect(isDiskFullErrorMessage('sqlite3.OperationalError: database or disk is full')).toBe(true)
  expect(isDiskFullErrorMessage('disk full: session storage could not be written — free some disk space')).toBe(true)
  expect(isDiskFullErrorMessage('This is often a full disk — free some space')).toBe(true)
  expect(isDiskFullErrorMessage('session storage could not be written: permission denied')).toBe(false)
  expect(isDiskFullErrorMessage('network timeout')).toBe(false)

  notifyError(new Error('OSError: [Errno 28] No space left on device: state.db'), 'Prompt failed')

  expect(lastMessage()).toMatch(/Disk full/i)
  expect(lastMessage()).toMatch(/free some space/i)
})

test('session storage write failure is treated as disk-full class', () => {
  notifyError(
    new Error('disk full: session storage could not be written — free some disk space and try again'),
    'Prompt failed'
  )

  expect(lastMessage()).toMatch(/Disk full/i)
})

afterEach(() => {
  clearNotifications()
  vi.useRealTimers()
})

test.each<NotificationCategory>(['credits-50', 'credits-75', 'updates', 'connections', 'settings', 'files', 'pets'])(
  'suppresses %s without losing the ability to re-enable its action',
  category => {
    const action = vi.fn()
    const onDismiss = vi.fn()
    const input = { category, message: 'notice', action: { label: 'Continue', onClick: action }, onDismiss }
    notify(input)
    expect($notifications.get()).toEqual([])
    expect(onDismiss).not.toHaveBeenCalled()
    NOTIFICATION_CATEGORY_ENABLED[category] = true

    try {
      const id = notify(input)
      expect($notifications.get()).toHaveLength(1)
      $notifications.get()[0].action?.onClick()
      dismissNotification(id)
      expect(action).toHaveBeenCalledOnce()
      expect(onDismiss).toHaveBeenCalledOnce()
    } finally {
      NOTIFICATION_CATEGORY_ENABLED[category] = false
    }
  }
)

test('unifies legacy positions and preserves sticky errors, info expiry, replacement and queue cap', () => {
  vi.useFakeTimers()
  const error = notify({ id: 'error', kind: 'error', message: 'Failed', placement: 'default' })
  notify({ id: 'info', message: 'Done', placement: 'bottom-right' })
  expect($notifications.get().every(item => item.placement === 'bottom-right')).toBe(true)
  vi.advanceTimersByTime(5000)
  expect($notifications.get().map(item => item.id)).toEqual([error])
  notify({ id: error, kind: 'error', message: 'Retry failed' })
  expect($notifications.get()).toHaveLength(1)

  for (let i = 0; i < 4; i++) {
    notify({ id: `task-${i}`, message: 'Task complete' })
  }

  expect($notifications.get().map(item => item.id)).toEqual(['task-3', 'task-2', 'task-1', 'task-0'])
})

test('a suppressed replacement cancels its prior timer without calling onDismiss', () => {
  vi.useFakeTimers()
  const onDismiss = vi.fn()
  notify({ id: 'usage', message: '90%', durationMs: 100, onDismiss })
  notify({ id: 'usage', message: '75%', category: 'credits-75' })
  expect($notifications.get()).toEqual([])
  vi.advanceTimersByTime(1000)
  expect(onDismiss).not.toHaveBeenCalled()
})
