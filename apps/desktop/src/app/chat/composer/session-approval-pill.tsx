import { useStore } from '@nanostores/react'
import { useRef } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { ApprovalModeMenu } from '@/app/shell/approval-mode-menu'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { iconSize, Zap, ZapFilled } from '@/lib/icons'
import { setSessionApprovalMode } from '@/lib/session-approval'
import { cn } from '@/lib/utils'
import {
  $approvalModes,
  type ApprovalMode,
  approvalModeForProfile,
  setDraftSessionApprovalMode
} from '@/store/approval-mode'
import { notify } from '@/store/notifications'
import { $activeGatewayProfile } from '@/store/profile'
import { sessionTileDelegate } from '@/store/session-states'

import { ACTIVE_ICON_BTN, COMPOSER_PILL, GHOST_ICON_BTN } from './control-classes'

function patchSessionApprovalMode(runtimeId: string, mode: ApprovalMode | null) {
  sessionTileDelegate()?.updateSession(runtimeId, state =>
    state.approvalMode === mode ? state : { ...state, approvalMode: mode }
  )
}

/**
 * Per-conversation approval mode. A new chat inherits the profile default
 * until the user picks; that pick is pinned on the session. Settings → Safety
 * and the status bar stay the profile door.
 */
export function SessionApprovalPill({ compact = false, disabled }: { compact?: boolean; disabled: boolean }) {
  const { t } = useI18n()
  const view = useSessionView()
  const stored = useStore(view.$approvalMode)
  const runtimeId = useStore(view.$runtimeId)
  const profile = useStore($activeGatewayProfile)
  useStore($approvalModes)
  const { requestGateway } = useGatewayRequest()
  const pending = useRef(false)
  const copy = t.shell.approvalMode
  const mode = stored ?? approvalModeForProfile(profile)
  const isOff = mode === 'off'
  const awaitingRuntime = view.kind === 'tile' && !runtimeId
  const labels: Record<ApprovalMode, string> = { manual: copy.manual, off: copy.off, smart: copy.smart }

  const descriptions: Record<ApprovalMode, string> = {
    manual: copy.manualDescription,
    off: copy.offDescription,
    smart: copy.smartDescription
  }

  const title = copy.ariaLabel(labels[mode])

  const pillClass = compact
    ? cn(GHOST_ICON_BTN, 'p-0', isOff && ACTIVE_ICON_BTN)
    : cn(COMPOSER_PILL, isOff && ACTIVE_ICON_BTN)

  const icon = isOff ? <ZapFilled className={iconSize.sm} /> : <Zap className={iconSize.sm} />

  const setMode = (next: ApprovalMode) => {
    // A chat with no pin still shows the profile mode. Choosing that same
    // value is an explicit pick, so it gets stored on the session.
    if (disabled || awaitingRuntime || pending.current || (stored !== null && next === mode)) {
      return
    }

    const id = view.$runtimeId.get()
    const previous = view.$approvalMode.get()

    triggerHaptic(next === 'off' ? 'open' : 'close')

    if (!id) {
      setDraftSessionApprovalMode(next)

      return
    }

    pending.current = true
    patchSessionApprovalMode(id, next)

    void setSessionApprovalMode(requestGateway, id, next)
      .then(applied => {
        patchSessionApprovalMode(id, applied)
      })
      .catch(() => {
        patchSessionApprovalMode(id, previous)
        notify({ kind: 'error', message: copy.saveFailed, title: copy.title })
      })
      .finally(() => {
        pending.current = false
      })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={title}
          className={pillClass}
          data-slot="composer-approval-mode"
          disabled={disabled || awaitingRuntime}
          type="button"
          variant="ghost"
        >
          {compact ? (
            icon
          ) : (
            <>
              {icon}
              <span className="truncate">{labels[mode]}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-1" side="top" sideOffset={8}>
        <ApprovalModeMenu
          descriptions={descriptions}
          labels={labels}
          mode={mode}
          setMode={setMode}
          title={copy.title}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
