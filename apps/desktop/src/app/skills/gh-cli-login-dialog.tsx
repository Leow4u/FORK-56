import { useEffect, useRef, useState } from 'react'

import { type GhLoginPoll, type GhLoginStart } from '@/api/system'
import { DeviceCode } from '@/components/device-code'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ErrorBanner } from '@/components/ui/error-state'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { connectGhCli, type GhCliLoginHandle, isGhMissingError } from '@/lib/gh-cli-connect'
import { Loader2 } from '@/lib/icons'
import { type ProfileScope } from '@/work4you'

type Phase =
  | { kind: 'starting' }
  | { kind: 'polling'; start: GhLoginStart; copied: boolean }
  | { kind: 'error'; message: string; start?: GhLoginStart }

const COPY_FLASH_MS = 1200

/**
 * Capabilities → MCP "GitHub CLI" Connect: shows the device code, opens
 * github.com/login/device, waits for the backend to report that `gh` holds
 * the credential. Cancelling (or closing) tells the backend to drop the
 * session so a stray approval can't land later.
 */
export function GhCliLoginDialog({
  onConnected,
  onOpenChange,
  open,
  profile
}: {
  onConnected: (result: GhLoginPoll) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  profile?: ProfileScope
}) {
  const { t } = useI18n()
  const m = t.settings.mcp.ghCli
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' })
  const handle = useRef<GhCliLoginHandle | null>(null)
  const flash = useRef<null | number>(null)

  const terminalMessage = (poll: GhLoginPoll) =>
    poll.status === 'denied'
      ? m.denied
      : poll.status === 'expired'
        ? m.expired
        : poll.error_message && poll.error_message !== 'cancelled'
          ? poll.error_message
          : m.failed

  // One flow per open. The epoch guards a flow started for a previous open
  // from painting into (or resolving) the next one.
  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    if (!open) {
      return
    }

    let live = true
    setPhase({ kind: 'starting' })

    void (async () => {
      let flow: GhCliLoginHandle

      try {
        flow = await connectGhCli({ open: openExternalLink, profile })
      } catch (err) {
        if (live) {
          setPhase({
            kind: 'error',
            message: isGhMissingError(err) ? m.missing : err instanceof Error ? err.message : m.failed
          })
        }

        return
      }

      if (!live) {
        void flow.cancel()

        return
      }

      handle.current = flow
      setPhase({ kind: 'polling', start: flow.start, copied: false })

      try {
        const poll = await flow.done

        if (!live) {
          return
        }

        if (poll.status === 'approved') {
          handle.current = null
          onConnected(poll)
          onOpenChange(false)
        } else if (poll.error_message !== 'cancelled') {
          setPhase({ kind: 'error', message: terminalMessage(poll), start: flow.start })
        }
      } catch (err) {
        if (live) {
          setPhase({ kind: 'error', message: err instanceof Error ? err.message : m.failed, start: flow.start })
        }
      }
    })()

    return () => {
      live = false

      if (flash.current !== null) {
        window.clearTimeout(flash.current)
        flash.current = null
      }

      const current = handle.current
      handle.current = null

      if (current) {
        void current.cancel()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a flow is bound to one open; strings/callbacks are read at event time
  }, [open, profile])

  const copyCode = async () => {
    if (phase.kind !== 'polling') {
      return
    }

    try {
      await navigator.clipboard.writeText(phase.start.user_code)
    } catch {
      return
    }

    setPhase(current => (current.kind === 'polling' ? { ...current, copied: true } : current))

    if (flash.current !== null) {
      window.clearTimeout(flash.current)
    }

    flash.current = window.setTimeout(() => {
      flash.current = null
      setPhase(current => (current.kind === 'polling' ? { ...current, copied: false } : current))
    }, COPY_FLASH_MS)
  }

  const verificationUrl = phase.kind === 'starting' ? null : (phase.start?.verification_url ?? null)

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m.dialogTitle}</DialogTitle>
          <DialogDescription>{m.dialogBody}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {phase.kind === 'starting' ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {t.common.connecting}
            </div>
          ) : null}

          {phase.kind === 'polling' ? (
            <>
              <DeviceCode code={phase.start.user_code} copied={phase.copied} onCopy={() => void copyCode()} />
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {m.waiting}
              </div>
            </>
          ) : null}

          {phase.kind === 'error' ? <ErrorBanner>{phase.message}</ErrorBanner> : null}
        </div>

        <DialogFooter className="sm:justify-between">
          {verificationUrl ? (
            <Button onClick={() => openExternalLink(verificationUrl)} size="xs" variant="text">
              {m.reopen}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => onOpenChange(false)} size="xs" variant="outline">
            {phase.kind === 'error' ? t.common.close : t.common.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
