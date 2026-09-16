'use client'

import { useStore } from '@nanostores/react'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { WIDGET_SHELL_CLASS } from '@/components/chat/widget-shell'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { ChevronDown, Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $gateway } from '@/store/gateway'
import { notifyError } from '@/store/notifications'
import {
  type ApprovalRequest,
  clearApprovalRequest,
  registerApprovalInlineAnchor,
  replayPendingApproval,
  sessionApprovalInlineVisible,
  sessionApprovalRequest
} from '@/store/prompts'

import type { ToolPart } from './fallback-model'

// Inline approval card. Rendered under the pending tool row that raised the
// approval, wearing the same widget shell as clarify / MCP / files-changed so
// it reads as a conversation card rather than a system toolbar.
//
// Binding is POSITIONAL, not command-matched: the desktop `tool.start` payload
// carries no structured args (only tool_id/name/context — see
// tui_gateway/server.py::_on_tool_start), so we cannot join the approval to the
// row by command string. But `approval.request` only ever fires from the
// `terminal` / `execute_code` guards and the agent thread blocks on exactly one
// approval at a time, so the single pending row of those tools IS the row that
// raised it. The command/description text comes from `$approvalRequest` (the
// event payload), which is the only place that data reliably exists.
export const APPROVAL_TOOLS = new Set(['terminal', 'execute_code'])

const APPROVAL_SHELL_CLASS = `${WIDGET_SHELL_CLASS} text-[length:var(--conversation-text-font-size)] text-(--ui-text-primary)`

// Canonical gateway choices (ui-tui/src/components/prompts.tsx).
type ApprovalChoice = 'once' | 'session' | 'always' | 'deny'

export const PendingToolApproval: FC<{ part: ToolPart }> = ({ part }) => {
  // The tool row lives in whichever session's transcript rendered it — read
  // THAT session's approval (works for the primary and every tile).
  const sessionId = useStore(useSessionView().$runtimeId)
  const $request = useMemo(() => sessionApprovalRequest(sessionId), [sessionId])
  const request = useStore($request)

  if (!request || !APPROVAL_TOOLS.has(part.toolName)) {
    return null
  }

  return <InlineApprovalCard request={request} />
}

const InlineApprovalCard: FC<{ request: ApprovalRequest }> = ({ request }) => {
  useEffect(() => registerApprovalInlineAnchor(request.sessionId), [request.sessionId])

  return <ApprovalCard request={request} surface="inline" />
}

export const PendingApprovalFallback: FC = () => {
  const sessionId = useStore(useSessionView().$runtimeId)
  const $request = useMemo(() => sessionApprovalRequest(sessionId), [sessionId])
  const $inlineVisible = useMemo(() => sessionApprovalInlineVisible(sessionId), [sessionId])
  const request = useStore($request)
  const inlineVisible = useStore($inlineVisible)

  if (!request || inlineVisible) {
    return null
  }

  return (
    <div
      className="pointer-events-none absolute left-1/2 z-30 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2"
      data-slot="tool-approval-fallback"
      style={{ bottom: 'calc(var(--composer-measured-height) + 0.875rem)' }}
    >
      <div className="pointer-events-auto">
        <ApprovalCard request={request} surface="floating" />
      </div>
    </div>
  )
}

const ApprovalCard: FC<{ request: ApprovalRequest; surface: 'floating' | 'inline' }> = ({ request, surface }) => {
  const { t } = useI18n()
  const copy = t.assistant.approval
  const gateway = useStore($gateway)
  const [submitting, setSubmitting] = useState<ApprovalChoice | null>(null)
  // "Always allow" persists the pattern to ~/.work4you/config.yaml permanently, so
  // it goes through a confirm step rather than firing straight from the menu.
  const [confirmAlways, setConfirmAlways] = useState(false)
  const busy = submitting !== null
  // false when the backend won't honor a permanent allow (tirith warning) → hide "Always allow".
  const allowPermanent = request.allowPermanent !== false
  const choices = request.choices ?? (request.smartDenied ? ['once', 'deny'] : undefined)
  const allowSession = choices ? choices.includes('session') : true
  const allowAlways = choices ? choices.includes('always') : allowPermanent
  const hasMoreOptions = allowSession || allowAlways
  const command = request.command.trim()
  const reason = request.description.trim()

  const respond = useCallback(
    async (choice: ApprovalChoice) => {
      // Another card (or the keyboard path) may have already resolved this
      // approval; the map is the single source of truth, so bail if this
      // session's request is gone.
      if (busy || !sessionApprovalRequest(request.sessionId).get()) {
        return
      }

      if (!gateway) {
        notifyError(new Error(copy.gatewayDisconnected), copy.sendFailed)

        return
      }

      setSubmitting(choice)

      try {
        await gateway.request<{ resolved?: boolean }>('approval.respond', {
          choice,
          request_id: request.requestId,
          session_id: request.sessionId ?? undefined
        })
        triggerHaptic(choice === 'deny' ? 'cancel' : 'submit')
        clearApprovalRequest(request.sessionId, request.requestId)
        void replayPendingApproval(gateway, request.sessionId).catch(() => undefined)
      } catch (error) {
        notifyError(error, copy.sendFailed)
        setSubmitting(null)
      }
    },
    [busy, copy.gatewayDisconnected, copy.sendFailed, gateway, request.requestId, request.sessionId]
  )

  // ⌘/Ctrl+Enter → Allow, Esc → Not now.
  // While the confirm dialog is open it owns the keyboard (Esc closes it), so
  // the card-level shortcuts stand down to avoid denying the whole approval.
  useEffect(() => {
    if (confirmAlways) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void respond('once')
      } else if (event.key === 'Escape') {
        event.preventDefault()
        void respond('deny')
      }
    }

    window.addEventListener('keydown', onKeyDown, true)

    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [confirmAlways, respond])

  return (
    <div
      className={cn(surface === 'inline' && 'mt-1.5')}
      data-slot={surface === 'inline' ? 'tool-approval-inline' : 'tool-approval-actions'}
    >
      <div aria-label={copy.title} className={APPROVAL_SHELL_CLASS} role="group">
        <p className="font-medium leading-(--conversation-line-height)">{copy.title}</p>
        {reason ? <p className="mt-0.5 text-[0.6875rem] text-(--ui-text-tertiary)">{reason}</p> : null}
        {command ? (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-snug text-(--ui-text-secondary)">
            {command}
          </pre>
        ) : null}
      </div>

      <div className="mt-1 flex items-center justify-end gap-1">
        {hasMoreOptions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={copy.moreOptions} disabled={busy} size="xs" variant="text">
                {copy.more}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {allowSession && (
                <DropdownMenuItem onSelect={() => void respond('session')}>{copy.allowSession}</DropdownMenuItem>
              )}
              {allowAlways && (
                <DropdownMenuItem
                  onSelect={() => {
                    // Defer one tick so the menu fully unmounts before the dialog
                    // mounts — otherwise Radix's focus-return races the dialog and
                    // dismisses it via onInteractOutside.
                    setTimeout(() => setConfirmAlways(true), 0)
                  }}
                >
                  {copy.alwaysAllowMenu}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button disabled={busy} onClick={() => void respond('deny')} size="xs" variant="text">
          {submitting === 'deny' ? <Loader2 className="animate-spin" /> : copy.notNow}
        </Button>
        <Button disabled={busy} onClick={() => void respond('once')} size="xs">
          {submitting === 'once' ? <Loader2 className="animate-spin" /> : copy.allow}
        </Button>
      </div>

      <Dialog onOpenChange={setConfirmAlways} open={confirmAlways}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.alwaysTitle}</DialogTitle>
            <DialogDescription>{copy.alwaysDescription(request.description)}</DialogDescription>
          </DialogHeader>

          {command ? (
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-snug text-(--ui-text-secondary)">
              {command}
            </pre>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setConfirmAlways(false)} size="sm" variant="ghost">
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => {
                setConfirmAlways(false)
                void respond('always')
              }}
              size="sm"
              variant="destructive"
            >
              {copy.alwaysAllow}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
