import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { bindCompletionNotify, onKanbanEventsFrame } from '@/plugins/kanban/completion-notify'
import {
  dispatchPluginNativeNotification,
  setNativeNotifyEnabled,
  setNativeNotifyKind
} from '@/store/native-notifications'
import { $notifications, clearNotifications } from '@/store/notifications'
import { __resetNativeNotifyBaselineForTests } from '@/store/notify-baseline'

vi.mock('@work4you/plugin-sdk', async () => ({
  host: { notify: (await import('@/store/notifications')).notify, navigate: vi.fn() }
}))

const originalBridge = window.work4youDesktop
const native = vi.fn(async () => true)
let focused = true
let hidden = false
let board = 0

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(++board * 2000)
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  window.work4youDesktop = { ...originalBridge, notify: native } as Window['work4youDesktop']
  native.mockClear()
  clearNotifications()
  setNativeNotifyEnabled(true)
  setNativeNotifyKind('plugin', true)
  __resetNativeNotifyBaselineForTests()
  bindCompletionNotify(async <T>() => ({ latest_event_id: 0 }) as T, undefined, {
    notify: input => dispatchPluginNativeNotification('kanban', input),
    openExternal: async () => false,
    revealPath: async () => false,
    writeClipboard: async () => false
  })
})

afterEach(() => {
  clearNotifications()
  window.work4youDesktop = originalBridge
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it.each(['focused', 'alt-tab', 'minimized'] as const)('delivers a Kanban completion only once when %s', async mode => {
  focused = mode === 'focused'
  hidden = mode === 'minimized'
  const event = { id: 1, task_id: 'task-1', kind: 'completed', payload: { summary: 'Ready for review' } }
  await onKanbanEventsFrame(`board-${board}`, [event])
  expect($notifications.get()).toHaveLength(focused ? 1 : 0)
  expect(native).toHaveBeenCalledTimes(focused ? 0 : 1)
  const expectedToasts = focused ? 1 : 0
  focused = true
  hidden = false
  window.dispatchEvent(new Event('focus'))
  await onKanbanEventsFrame(`board-${board}`, [event])
  expect($notifications.get()).toHaveLength(expectedToasts)
  expect(native).toHaveBeenCalledTimes(expectedToasts ? 0 : 1)
})
