import { useStore } from '@nanostores/react'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { CopyButton } from '@/components/ui/copy-button'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { AlertCircle, AlertTriangle, CheckCircle2, type IconComponent, Info } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  $notifications,
  type AppNotification,
  clearNotifications,
  dismissNotification,
  type NotificationKind
} from '@/store/notifications'

type ToneVariant = 'default' | 'destructive' | 'warning' | 'success'

const tone: Record<NotificationKind, { icon: IconComponent; iconClass: string; variant: ToneVariant }> = {
  error: { icon: AlertCircle, iconClass: 'text-destructive', variant: 'destructive' },
  warning: { icon: AlertTriangle, iconClass: 'text-(--ui-orange)', variant: 'warning' },
  info: { icon: Info, iconClass: 'text-muted-foreground', variant: 'default' },
  success: { icon: CheckCircle2, iconClass: 'text-(--ui-green)', variant: 'success' }
}

const STACK_SURFACE =
  'pointer-events-auto border border-(--stroke-work4you) bg-popover/95 shadow-work4you backdrop-blur-md'

export function NotificationStack() {
  const notifications = useStore($notifications)
  const { t } = useI18n()
  const lastNotificationIdRef = useRef<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const copy = t.notifications

  useEffect(() => {
    if (notifications.length <= 1) {
      setExpanded(false)
    }
  }, [notifications.length])

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    const latest = notifications[0]

    if (!latest || latest.id === lastNotificationIdRef.current) {
      return
    }

    lastNotificationIdRef.current = latest.id

    if (latest.kind === 'success') {
      triggerHaptic('success')
    } else if (latest.kind === 'error') {
      triggerHaptic('error')
    } else if (latest.kind === 'warning') {
      triggerHaptic('warning')
    }
  }, [notifications])

  if (notifications.length === 0) {
    return null
  }

  const visible = expanded ? notifications : notifications.slice(0, 1)
  const olderCount = notifications.length - 1

  // One body portal keeps every global notice above dialogs, in the same place.
  return createPortal(
    <div
      aria-label={copy.region}
      className="pointer-events-none fixed right-4 bottom-4 z-(--z-over-modal) flex max-h-[calc(100dvh-var(--titlebar-height,34px)-2rem)] w-[min(22.5rem,calc(100%-2rem))] flex-col gap-2"
      role="region"
    >
      <div className="pointer-events-auto -m-3 flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain p-3">
        {visible.map(notification => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </div>
      {olderCount > 0 && (
        <div
          className={cn(
            STACK_SURFACE,
            'flex shrink-0 flex-wrap items-center justify-between gap-1 rounded-lg px-2 py-1'
          )}
        >
          <Button
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
            size="sm"
            type="button"
            variant="text"
          >
            {expanded ? copy.hide : copy.more(olderCount)}
          </Button>
          <Button onClick={clearNotifications} size="sm" type="button" variant="text">
            {copy.clearAll}
          </Button>
        </div>
      )}
    </div>,
    document.body
  )
}

// Emphasize only the leading money figure ("$16.00" — the amount used) with the
// accent color (semibold), leaving the rest of the line in its default muted
// tone. No accent, or no figure in the message → render the text untouched.
function renderMessage(message: string, accent?: string): ReactNode {
  const match = accent ? /\$\d+(?:\.\d{2})?/.exec(message) : null

  if (!match) {
    return message
  }

  const start = match.index
  const end = start + match[0].length

  return (
    <>
      {message.slice(0, start)}
      <span className="font-semibold" style={{ color: accent }}>
        {match[0]}
      </span>
      {message.slice(end)}
    </>
  )
}

// AlertTitle defaults to a single-line clamp. Toast errors are often a full
// sentence, so the toast wraps — then caps height and scrolls instead of
// growing down the chat or clipping with an ellipsis.
export function toastTitleClassName() {
  return 'col-start-auto text-sm leading-5 tracking-normal line-clamp-none max-h-[4.5em] overflow-y-auto overscroll-contain whitespace-normal wrap-break-word'
}

function NotificationItem({ notification }: { notification: AppNotification }) {
  const styles = tone[notification.kind]
  const Icon = styles.icon
  const hasDetail = Boolean(notification.detail && notification.detail !== notification.message)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const { t } = useI18n()
  const copy = t.notifications

  // Nudge the icon down to sit on the first text line, in `ch` so it tracks the
  // toast's font size instead of a fixed rem. `accentColor` (when set) tints the
  // icon + message as a severity ramp, overriding the kind's default color.
  const accent = notification.accentColor
  const iconStyle: CSSProperties = { marginTop: '0.42ch', ...(accent ? { color: accent } : {}) }

  return (
    <Alert
      aria-live={notification.kind === 'error' ? 'assertive' : 'polite'}
      className={cn(
        STACK_SURFACE,
        'shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 rounded-(--card-radius) p-3 text-foreground'
      )}
      role={notification.kind === 'error' ? 'alert' : 'status'}
      variant="default"
    >
      {notification.icon ? (
        <Codicon className={styles.iconClass} name={notification.icon} size="1rem" style={iconStyle} />
      ) : (
        <Icon className={styles.iconClass} style={iconStyle} />
      )}
      <div className="col-start-2 min-w-0">
        {notification.title && (
          <AlertTitle className={toastTitleClassName()} title={notification.title}>
            {notification.title}
          </AlertTitle>
        )}
        <AlertDescription className="col-start-auto mt-0.5 w-full text-[0.8125rem] text-(--ui-text-secondary) [&_p]:leading-5">
          {notification.message !== notification.title && (
            <p className="m-0 whitespace-pre-wrap wrap-anywhere">{renderMessage(notification.message, accent)}</p>
          )}
          {notification.meta && <p className="m-0 text-xs text-muted-foreground tabular-nums">{notification.meta}</p>}
          {(notification.action || hasDetail) && (
            <div className="mt-2 flex w-full flex-wrap items-center gap-x-3 gap-y-2">
              {notification.action && (
                <Button
                  className="max-w-full whitespace-normal wrap-anywhere text-start"
                  onClick={() => {
                    notification.action?.onClick()
                    dismissNotification(notification.id)
                  }}
                  type="button"
                >
                  {notification.action.label}
                </Button>
              )}
              {hasDetail && (
                <Button
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen(value => !value)}
                  size="sm"
                  type="button"
                  variant="text"
                >
                  {copy.details}
                </Button>
              )}
            </div>
          )}
          {hasDetail && detailsOpen && <NotificationDetail detail={notification.detail || ''} />}
        </AlertDescription>
      </div>
      <Button
        aria-label={copy.dismiss}
        className="col-start-3 -me-1 text-muted-foreground"
        onClick={() => dismissNotification(notification.id)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Codicon name="close" size="0.875rem" />
      </Button>
    </Alert>
  )
}

function NotificationDetail({ detail }: { detail: string }) {
  const { t } = useI18n()
  const copy = t.notifications

  return (
    <div className="mt-2 w-full min-w-0 rounded-md bg-background/65 p-2 text-xs text-muted-foreground">
      <pre
        className="max-h-32 overflow-auto whitespace-pre-wrap wrap-anywhere font-mono text-xs leading-relaxed"
        data-selectable-text="true"
      >
        {detail}
      </pre>
      <CopyButton
        appearance="inline"
        className="mt-1 rounded px-1.5 py-0.5 text-[0.6875rem]"
        errorMessage={copy.copyDetailFailed}
        iconClassName="size-3"
        label={copy.copyDetail}
        text={detail}
      >
        {copy.copyDetail}
      </CopyButton>
    </div>
  )
}

export function InlineNotice({
  kind = 'info',
  title,
  children,
  className
}: {
  kind?: NotificationKind
  title?: string
  children: ReactNode
  className?: string
}) {
  const styles = tone[kind]
  const Icon = styles.icon

  return (
    <Alert className={cn('min-w-0', className)} role={kind === 'error' ? 'alert' : 'status'} variant={styles.variant}>
      <Icon />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className={cn(!title && 'row-start-1')}>{children}</AlertDescription>
    </Alert>
  )
}
