import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $nativeNotifyPrefs, setNativeNotifyEnabled, setNativeNotifyKind } from '@/store/native-notifications'
import { $notifications, clearNotifications, notify } from '@/store/notifications'
import { __resetNativeNotifyBaselineForTests } from '@/store/notify-baseline'
import { clearAllPrompts, sessionApprovalRequest } from '@/store/prompts'
import { $activeSessionId } from '@/store/session'

import { renderMessageStream } from './test-harness'

const originalBridge = window.work4youDesktop
const originalPrefs = $nativeNotifyPrefs.get()
const native = vi.fn(async () => true)
let hidden = false
let focused = true
let sequence = 0

beforeEach(() => {
  hidden = false
  focused = true
  vi.spyOn(window.document, 'hasFocus').mockImplementation(() => focused)
  vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden)
  window.work4youDesktop = { ...originalBridge, notify: native } as Window['work4youDesktop']
  native.mockClear()
  setNativeNotifyEnabled(true)

  for (const kind of ['approval', 'credits', 'turnError'] as const) {
    setNativeNotifyKind(kind, true)
  }

  __resetNativeNotifyBaselineForTests()
  clearNotifications()
})

afterEach(() => {
  cleanup()
  clearNotifications()
  clearAllPrompts()
  $activeSessionId.set(null)
  window.work4youDesktop = originalBridge
  $nativeNotifyPrefs.set(originalPrefs)
  vi.restoreAllMocks()
})

describe('gateway events choose a single notification channel', () => {
  it.each(['focused', 'alt-tab', 'minimized'] as const)(
    'routes errors when %s and preserves the transcript on return',
    mode => {
      const sid = `error-channel-${++sequence}`
      $activeSessionId.set(sid)
      const stream = renderMessageStream(sid)
      focused = mode === 'focused'
      hidden = mode === 'minimized'
      act(() => stream.handleEvent({ type: 'error', session_id: sid, payload: { message: 'Service unavailable' } }))
      expect(native).toHaveBeenCalledTimes(mode === 'focused' ? 0 : 1)
      expect($notifications.get()).toHaveLength(mode === 'focused' ? 1 : 0)
      expect(stream.state().messages.some(message => message.error === 'Service unavailable')).toBe(true)
      focused = true
      hidden = false
      act(() => window.dispatchEvent(new Event('focus')))
      expect($notifications.get()).toHaveLength(mode === 'focused' ? 1 : 0)
      expect(stream.state().messages.some(message => message.error === 'Service unavailable')).toBe(true)
    }
  )

  it('delivers a credit event natively without replaying a sticky toast when focus returns', () => {
    const stream = renderMessageStream(null)
    focused = false
    const key = `credits.depleted`
    act(() =>
      stream.handleEvent({
        type: 'notification.show',
        payload: { key, text: 'Credit access paused', level: 'error', kind: 'sticky' }
      })
    )
    expect(native).toHaveBeenCalledOnce()
    expect($notifications.get()).toEqual([])
    focused = true
    act(() => window.dispatchEvent(new Event('focus')))
    expect($notifications.get()).toEqual([])
  })

  it('does not create a fallback toast when native notifications are disabled', () => {
    const sid = `muted-channel-${++sequence}`
    $activeSessionId.set(sid)
    const stream = renderMessageStream(sid)
    setNativeNotifyEnabled(false)
    focused = false
    act(() => stream.handleEvent({ type: 'error', session_id: sid, payload: { message: 'Service unavailable' } }))
    expect(native).not.toHaveBeenCalled()
    focused = true
    act(() => window.dispatchEvent(new Event('focus')))
    expect($notifications.get()).toEqual([])
    expect(stream.state().messages.some(message => message.error === 'Service unavailable')).toBe(true)
  })

  it('keeps another chat’s approval pending in the app without an OS notification while focused', () => {
    $activeSessionId.set('foreground-chat')
    const stream = renderMessageStream('foreground-chat')
    const sid = `approval-channel-${++sequence}`
    act(() =>
      stream.handleEvent({
        type: 'approval.request',
        session_id: sid,
        payload: { command: 'mkdir output', request_id: sid, description: 'Create output folder' }
      })
    )
    expect(native).not.toHaveBeenCalled()
    expect(sessionApprovalRequest(sid).get()?.command).toBe('mkdir output')
    expect(stream.state(sid).needsInput).toBe(true)
  })

  it('quietly retires a foreground toast when the same id is updated in the background', () => {
    const onDismiss = vi.fn()
    notify({ id: 'sticky', kind: 'warning', message: 'First', onDismiss })
    expect($notifications.get()).toHaveLength(1)
    focused = false
    notify({ id: 'sticky', kind: 'warning', message: 'Updated', onDismiss })
    focused = true
    window.dispatchEvent(new Event('focus'))
    expect($notifications.get()).toEqual([])
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
