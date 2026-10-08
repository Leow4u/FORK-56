import { describe, expect, it, vi } from 'vitest'

import { createNativeNotificationDelivery } from './native-notification-delivery'

describe('native delivery across windows', () => {
  it('suppresses a background renderer while another app window is focused, without reserving the dedupe slot', () => {
    const show = vi.fn()
    const isAppFocused = vi.fn(() => true)
    const deliver = createNativeNotificationDelivery({ isAppFocused, isSupported: () => true, show })
    const payload = { kind: 'credits', title: 'Credit access restored' }

    expect(deliver(payload)).toBe(false)
    expect(show).not.toHaveBeenCalled()

    isAppFocused.mockReturnValue(false)
    expect(deliver(payload)).toBe(true)
    expect(show).toHaveBeenCalledExactlyOnceWith(payload)
    // A second window receives the same event: only one OS notification.
    expect(deliver(payload)).toBe(true)
    expect(show).toHaveBeenCalledOnce()
  })

  it('lets the explicit Settings test through in focus, but still requires OS support', () => {
    const show = vi.fn()
    const isSupported = vi.fn(() => true)
    const deliver = createNativeNotificationDelivery({ isAppFocused: () => true, isSupported, show })
    expect(deliver({ kind: 'turnDone', title: 'Test', test: true })).toBe(true)
    expect(show).toHaveBeenCalledOnce()
    isSupported.mockReturnValue(false)
    expect(deliver({ kind: 'turnDone', title: 'Test', test: true })).toBe(false)
    expect(show).toHaveBeenCalledOnce()
  })
})
