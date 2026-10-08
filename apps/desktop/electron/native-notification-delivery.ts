import { createEventDeduper } from './event-dedupe'

export interface Work4YouNotification {
  /** Explicit Settings test only: allow delivery while a Work4You window is focused. */
  test?: boolean
  title?: string
  body?: string
  silent?: boolean
  kind?: string
  sessionId?: string
  /** Dedupe discriminator for session-less notifications (e.g. plugin id). */
  tag?: string
  /** Absolute icon path for Electron `Notification`. */
  icon?: string
  /** Resolved hash-router path opened on body click (plugin / deeplink-compatible). */
  activate?: string
  /** Renderer handle for onActivate / onAction callbacks. */
  notifyId?: string
  actions?: { id: string; text: string; activate?: string }[]
}

/** Main owns focus across all app windows; a background renderer cannot know it. */
export function createNativeNotificationDelivery({
  isSupported,
  isAppFocused,
  show
}: {
  isSupported: () => boolean
  isAppFocused: () => boolean
  show: (payload: Work4YouNotification) => void
}) {
  const isDuplicate = createEventDeduper()

  return (payload: Work4YouNotification = {}): boolean => {
    if (!isSupported() || (payload.test !== true && isAppFocused())) {
      return false
    }

    // Check focus first so a suppressed event doesn't claim the dedupe slot.
    // Keep the existing success result when another window already delivered it.
    if (isDuplicate(`${payload.kind ?? ''}:${payload.sessionId ?? payload.tag ?? ''}`)) {
      return true
    }

    show(payload)

    return true
  }
}
