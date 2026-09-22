import { useStore } from '@nanostores/react'
import { useRef } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { iconSize, Zap, ZapFilled } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { type GatewayRequester, setSessionYolo } from '@/lib/yolo-session'
import { notify } from '@/store/notifications'
import { setYoloActive } from '@/store/session'
import { sessionTileDelegate } from '@/store/session-states'

import { ACTIVE_ICON_BTN, COMPOSER_PILL, GHOST_ICON_BTN } from './control-classes'

function patchSessionYolo(runtimeId: string, yolo: boolean) {
  sessionTileDelegate()?.updateSession(runtimeId, state => (state.yolo === yolo ? state : { ...state, yolo }))
}

async function commitSessionYolo(
  requestGateway: GatewayRequester,
  runtimeId: string,
  next: boolean,
  previous: boolean,
  mirrorForeground: boolean,
  failed: { message: string; title: string }
) {
  patchSessionYolo(runtimeId, next)

  if (mirrorForeground) {
    setYoloActive(next)
  }

  try {
    const active = await setSessionYolo(requestGateway, runtimeId, next, { mirrorForeground })

    if (active === next) {
      return
    }

    patchSessionYolo(runtimeId, active)

    if (mirrorForeground) {
      setYoloActive(active)
    }
  } catch {
    patchSessionYolo(runtimeId, previous)

    if (mirrorForeground) {
      setYoloActive(previous)
    }

    notify({ kind: 'error', message: failed.message, title: failed.title })
  }
}

/**
 * Per-session YOLO toggle. A new draft arms `$yoloActive` locally; the
 * session-create path applies it on the first message. A live chat writes
 * `config.set` `{ key: 'yolo', session_id }` and patches that session's slice.
 * Profile approval mode stays in Settings → Safety.
 */
export function SessionYoloPill({ compact = false, disabled }: { compact?: boolean; disabled: boolean }) {
  const { t } = useI18n()
  const view = useSessionView()
  const active = useStore(view.$yolo)
  const runtimeId = useStore(view.$runtimeId)
  const { requestGateway } = useGatewayRequest()
  const pending = useRef(false)
  const copy = t.desktop
  const label = active ? copy.yoloArmed : copy.yoloOff
  const awaitingRuntime = view.kind === 'tile' && !runtimeId

  const pillClass = compact
    ? cn(GHOST_ICON_BTN, 'p-0', active && ACTIVE_ICON_BTN)
    : cn(COMPOSER_PILL, active && ACTIVE_ICON_BTN)

  const icon = active ? <ZapFilled className={iconSize.sm} /> : <Zap className={iconSize.sm} />

  const onClick = () => {
    if (disabled || awaitingRuntime || pending.current) {
      return
    }

    const current = view.$yolo.get()
    const next = !current
    const id = view.$runtimeId.get()

    triggerHaptic(next ? 'open' : 'close')

    if (!id) {
      setYoloActive(next)

      return
    }

    pending.current = true

    void commitSessionYolo(requestGateway, id, next, current, view.kind === 'primary', {
      message: copy.yoloToggleFailed,
      title: copy.yoloTitle
    }).finally(() => {
      pending.current = false
    })
  }

  return (
    <Tip label={label}>
      <Button
        aria-label={label}
        aria-pressed={active}
        className={pillClass}
        data-slot="composer-session-yolo"
        disabled={disabled || awaitingRuntime}
        onClick={onClick}
        type="button"
        variant="ghost"
      >
        {compact ? (
          icon
        ) : (
          <>
            {icon}
            <span className="truncate">{copy.yoloTitle}</span>
          </>
        )}
      </Button>
    </Tip>
  )
}
