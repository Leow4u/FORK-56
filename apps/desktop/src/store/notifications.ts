import { atom } from 'nanostores'

import { translateNow } from '@/i18n'
import { isWindowBackgrounded } from '@/lib/window-focus'

export type NotificationKind = 'error' | 'warning' | 'info' | 'success'

export type NotificationCategory =
  'general' | 'credits' | 'credits-50' | 'credits-75' | 'updates' | 'connections' | 'settings' | 'files' | 'pets'

// Reversible presentation switches. Keep emitters and their actions intact:
// changing a flag here restores that category without changing its workflow.
// Uncategorized notices (including external plugins) remain enabled.
export const NOTIFICATION_CATEGORY_ENABLED: Record<NotificationCategory, boolean> = {
  general: true,
  credits: true,
  'credits-50': false,
  'credits-75': false,
  updates: false,
  connections: false,
  settings: false,
  files: false,
  pets: false
}

export interface NotificationAction {
  label: string
  onClick: () => void
}

export type NotificationPlacement = 'default' | 'bottom-right'

export interface AppNotification {
  id: string
  kind: NotificationKind
  category?: NotificationCategory
  /** When set, renders this codicon instead of the default kind icon. */
  icon?: string
  /** When set, tints the icon and message with this CSS color (severity ramp). */
  accentColor?: string
  /** Secondary detail line rendered below the message, muted (e.g. "$220.00 cap"). */
  meta?: string
  title?: string
  message: string
  detail?: string
  action?: NotificationAction
  onDismiss?: () => void
  createdAt: number
  placement?: NotificationPlacement
}

export interface NotificationInput {
  id?: string
  kind?: NotificationKind
  category?: NotificationCategory
  icon?: string
  accentColor?: string
  meta?: string
  title?: string
  message: string
  detail?: string
  action?: NotificationAction
  onDismiss?: () => void
  durationMs?: number
  placement?: NotificationPlacement
}

let notificationCounter = 0
const timers = new Map<string, number>()

export const $notifications = atom<AppNotification[]>([])

function defaultDuration(kind: NotificationKind) {
  if (kind === 'error' || kind === 'warning') {
    return 0
  }

  return 5_000
}

function cleanErrorText(value: string) {
  return value.replace(/^Error:\s*/, '').trim()
}

/** True when an error string is a disk-full / ENOSPC / SQLITE_FULL failure. */
export function isDiskFullErrorMessage(message: string): boolean {
  return (
    /no space left on device/i.test(message) ||
    /not enough space/i.test(message) ||
    /database or disk is full/i.test(message) ||
    /\bENOSPC\b/i.test(message) ||
    /disk full/i.test(message) ||
    /full disk/i.test(message)
  )
}

const ERROR_SUMMARIES: { test: (msg: string) => boolean; summarize: (msg: string) => string }[] = [
  {
    // Disk full / ENOSPC — session DB write, backend crash, or any path that
    // bubbles "no space left" / SQLITE_FULL through notifyError. Match before
    // generic length truncation so the user gets a clear "free space" toast
    // instead of a silent send or a raw errno dump.
    test: isDiskFullErrorMessage,
    summarize: () => translateNow('notifications.errors.diskFull')
  },
  {
    test: msg => /['"]code['"]\s*:\s*['"]gateway_auth_failed['"]/i.test(msg),
    summarize: () => translateNow('notifications.errors.gatewayAuthFailed')
  },
  {
    test: msg => /incorrect api key provided/i.test(msg) || /['"]code['"]\s*:\s*['"]invalid_api_key['"]/i.test(msg),
    summarize: msg => {
      const status = msg.match(/(?:error code|status(?:Code)?)[^\d]*(\d{3})/i)?.[1]

      return status
        ? translateNow('notifications.errors.openaiRejectedApiKeyWithStatus', status)
        : translateNow('notifications.errors.openaiRejectedApiKey')
    }
  },
  {
    test: msg => /neither voice_tools_openai_key nor openai_api_key is set/i.test(msg),
    summarize: () => translateNow('notifications.errors.openaiTtsNeedsKey')
  },
  {
    test: msg => /ELEVENLABS_API_KEY not set/i.test(msg) || /ElevenLabs STT API error \(HTTP 401\)/i.test(msg),
    summarize: msg =>
      /ELEVENLABS_API_KEY not set/i.test(msg)
        ? translateNow('notifications.errors.elevenLabsNeedsKey')
        : translateNow('notifications.errors.elevenLabsRejectedKey')
  },
  {
    test: msg => /method not allowed/i.test(msg),
    summarize: () => translateNow('notifications.errors.methodNotAllowed')
  },
  {
    test: msg => /microphone permission/i.test(msg),
    summarize: () => translateNow('notifications.errors.microphonePermission')
  }
]

function summarizeErrorMessage(message: string, fallback: string) {
  const rule = ERROR_SUMMARIES.find(r => r.test(message))

  if (rule) {
    return rule.summarize(message)
  }

  return message.length > 180 ? fallback : message || fallback
}

// Exported so flows that surface errors inline (e.g. ConfirmDialog's onConfirm
// rethrow) can reuse the same IPC-unwrapping + summarizing as notifyError.
export function readableError(error: unknown, fallback: string): { message: string; detail?: string } {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback
  const unwrapped = raw.match(/Error invoking remote method '[^']+': Error: (.+)$/)?.[1] ?? raw
  const cleaned = cleanErrorText(unwrapped)
  const detail = cleaned.match(/"detail"\s*:\s*"([^"]+)"/)?.[1] ?? cleaned
  const summary = summarizeErrorMessage(detail, fallback)

  return { message: summary, detail: detail === summary ? undefined : detail }
}

export function notify(input: NotificationInput): string {
  const kind = input.kind ?? 'info'
  const id = input.id ?? `${Date.now()}-${notificationCounter++}`
  const category = input.category ?? 'general'

  window.clearTimeout(timers.get(id))
  timers.delete(id)

  if (NOTIFICATION_CATEGORY_ENABLED[category] === false || isWindowBackgrounded()) {
    // Toasts belong to the focused window. Background events use their existing
    // native notification paths; never queue a second toast to replay on return.
    // A quieter replacement (e.g. credit usage dropping from 90% to 75%)
    // must also retire the old visible notice. This is not a user dismissal.
    if ($notifications.get().some(item => item.id === id)) {
      $notifications.set($notifications.get().filter(item => item.id !== id))
    }

    return id
  }

  const notification: AppNotification = {
    id,
    kind,
    category,
    icon: input.icon,
    accentColor: input.accentColor,
    meta: input.meta,
    title: input.title,
    message: input.message,
    detail: input.detail,
    action: input.action,
    onDismiss: input.onDismiss,
    createdAt: Date.now(),
    // Accept legacy placement inputs from plugins, but use one global surface.
    placement: 'bottom-right'
  }

  $notifications.set([notification, ...$notifications.get().filter(item => item.id !== id)].slice(0, 4))

  const duration = input.durationMs ?? defaultDuration(kind)

  if (duration > 0) {
    timers.set(
      id,
      window.setTimeout(() => dismissNotification(id), duration)
    )
  }

  return id
}

export function notifyError(error: unknown, fallback: string, category?: NotificationCategory): string {
  const readable = readableError(error, fallback)

  return notify({
    category,
    kind: 'error',
    title: fallback,
    message: readable.message,
    detail: readable.detail
  })
}

export function dismissNotification(id: string) {
  window.clearTimeout(timers.get(id))
  timers.delete(id)
  const dismissed = $notifications.get().find(item => item.id === id)
  $notifications.set($notifications.get().filter(item => item.id !== id))
  dismissed?.onDismiss?.()
}

export function clearNotifications() {
  for (const timer of timers.values()) {
    window.clearTimeout(timer)
  }

  timers.clear()
  const all = $notifications.get()
  $notifications.set([])

  for (const item of all) {
    item.onDismiss?.()
  }
}
