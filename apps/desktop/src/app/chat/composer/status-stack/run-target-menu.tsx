import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { SETTINGS_ROUTE } from '@/app/routes'
import { composerContextBar, composerMenuDetail, composerPanelCard } from '@/components/chat/composer-dock'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  dropdownMenuRow,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { releaseTypingFocus } from '@/components/ui/keyboard-first'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Cloud, Loader2, Monitor } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $activeConnectionId, $connectionsRegistry, $pendingConnectionId } from '@/store/connections'
import { notify, notifyError } from '@/store/notifications'
import { $connection } from '@/store/session'
import { noteSidebarCloudEntitlement } from '@/store/session-homes'

import { useComposerMenuSide } from '../use-composer-menu-side'

import {
  type ComposerCloudPortal,
  composerCloudPortalFromDiscover,
  type ComposerRunTarget,
  composerRunTargetIntent,
  isCloudLoginError,
  lastCloudApplySource,
  readRememberedComposerCloudApply,
  rememberComposerCloudApply,
  resolveComposerRunTarget
} from './run-target'

function loadComposerCloudPortal(requestRef: {
  current: Promise<ComposerCloudPortal> | null
}): Promise<ComposerCloudPortal> {
  const discover = window.work4youDesktop?.cloud?.discover

  if (!discover) {
    return Promise.resolve({ status: 'signin' })
  }

  if (requestRef.current) {
    return requestRef.current
  }

  const request = discover()
    .then(result => {
      noteSidebarCloudEntitlement('entitlement' in result ? result.entitlement?.canUseCloud : undefined)

      return composerCloudPortalFromDiscover(result)
    })
    .catch((error: unknown) => {
      if (isCloudLoginError(error)) {
        return { status: 'signin' } as const
      }

      throw error
    })
    .finally(() => {
      if (requestRef.current === request) {
        requestRef.current = null
      }
    })

  requestRef.current = request

  return request
}

export function ComposerRunTargetMenu() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)
  const menuSide = useComposerMenuSide(hostRef)
  const applyingRef = useRef(false)
  const portalRequestRef = useRef<Promise<ComposerCloudPortal> | null>(null)
  const [portal, setPortal] = useState<ComposerCloudPortal | null>(null)
  const registry = useStore($connectionsRegistry)
  const activeConnectionId = useStore($activeConnectionId)
  const connection = useStore($connection)
  const pendingConnectionId = useStore($pendingConnectionId)
  const connections = registry?.connections ?? []
  const active = resolveComposerRunTarget({ activeConnectionId, connection, connections })
  const copy = t.settings.connections
  const gateway = t.settings.gateway
  const tooltip = gateway.modeTitle
  const shownTarget = pendingConnectionId === 'cloud' || pendingConnectionId === 'local' ? pendingConnectionId : active
  const cloudSelected = shownTarget === 'cloud'
  const targetLabel = cloudSelected ? copy.kindCloudChip : copy.kindLocal
  const TargetIcon = cloudSelected ? Cloud : Monitor

  useEffect(() => {
    rememberComposerCloudApply(
      lastCloudApplySource({
        connection,
        remembered: readRememberedComposerCloudApply(),
        saved: null
      })
    )
  }, [connection])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    void (async () => {
      const desktop = window.work4youDesktop
      const saved = (await desktop?.getConnectionConfig?.(null).catch(() => null)) ?? null

      if (cancelled) {
        return
      }

      const known = lastCloudApplySource({
        connection: $connection.get(),
        remembered: readRememberedComposerCloudApply(),
        saved
      })

      if (known?.remoteUrl.trim()) {
        setPortal({ source: known, status: 'ready' })

        return
      }

      try {
        const next = await loadComposerCloudPortal(portalRequestRef)

        if (!cancelled) {
          setPortal(next)
        }
      } catch {
        if (!cancelled) {
          setPortal(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  const choose = (target: string) => {
    if (target !== 'cloud' && target !== 'local') {
      return
    }

    void applyRunTarget(target)
  }

  const applyRunTarget = async (target: ComposerRunTarget) => {
    if (applyingRef.current) {
      return
    }

    const desktop = window.work4youDesktop
    const saved = (await desktop?.getConnectionConfig?.(null).catch(() => null)) ?? null
    const live = $connection.get()

    const cloud = lastCloudApplySource({
      connection: live,
      remembered: readRememberedComposerCloudApply(),
      saved
    })

    rememberComposerCloudApply(cloud)

    let portalSnapshot: ComposerCloudPortal | null = null

    if (target === 'cloud' && !cloud?.remoteUrl.trim()) {
      try {
        portalSnapshot = await loadComposerCloudPortal(portalRequestRef)
        setPortal(portalSnapshot)
      } catch (error) {
        notifyError(error, gateway.cloudDiscoverFailed)

        return
      }
    }

    const intent = composerRunTargetIntent(target, {
      active: resolveComposerRunTarget({
        activeConnectionId: $activeConnectionId.get(),
        connection: live,
        connections: $connectionsRegistry.get()?.connections ?? []
      }),
      cloud,
      portal: portalSnapshot
    })

    if (intent.type === 'upgrade') {
      triggerHaptic('selection')
      navigate(`${SETTINGS_ROUTE}?tab=billing&bview=plans`)

      return
    }

    if (intent.type === 'preparing') {
      triggerHaptic('selection')
      notify({ kind: 'info', message: copy.kindCloudPreparing, title: copy.kindCloud })

      return
    }

    if (intent.type === 'settings') {
      triggerHaptic('selection')
      navigate(`${SETTINGS_ROUTE}?tab=gateway`)

      return
    }

    if (intent.type === 'noop') {
      return
    }

    if (!desktop?.applyConnectionConfig) {
      return
    }

    triggerHaptic('selection')
    applyingRef.current = true
    $pendingConnectionId.set(target)

    try {
      await desktop.applyConnectionConfig(intent.payload)
      rememberComposerCloudApply(
        intent.payload.mode === 'cloud' && intent.payload.remoteUrl
          ? { cloudOrg: intent.payload.cloudOrg, remoteUrl: intent.payload.remoteUrl }
          : cloud
      )
      notify({ kind: 'success', message: gateway.restartingMessage, title: gateway.restartingTitle })
    } catch (error) {
      notifyError(error, gateway.applyFailed)
    } finally {
      applyingRef.current = false
      $pendingConnectionId.set(null)
    }
  }

  const cloudDetail =
    portal?.status === 'upgrade'
      ? copy.kindCloudPlan
      : portal?.status === 'preparing'
        ? copy.kindCloudPreparing
        : copy.kindCloudDesc

  const setMenuOpen = (next: boolean) => {
    setOpen(next)

    if (!next) {
      releaseTypingFocus()
    }
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={open}>
      <div className="contents" ref={hostRef}>
        <Tip label={tooltip} side={menuSide === 'bottom' ? 'top' : 'bottom'}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={tooltip}
              className={cn(composerContextBar, 'shrink-0')}
              data-slot="composer-run-target"
              type="button"
            >
              {pendingConnectionId ? (
                <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <TargetIcon aria-hidden className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{targetLabel}</span>
            </button>
          </DropdownMenuTrigger>
        </Tip>
      </div>
      <DropdownMenuContent
        align="end"
        className={cn('min-w-64', composerPanelCard)}
        data-composer-menu=""
        data-slot="composer-run-target-menu"
        side={menuSide}
        sideOffset={8}
      >
        <DropdownMenuRadioGroup onValueChange={choose} value={active ?? ''}>
          <DropdownMenuRadioItem className={cn(dropdownMenuRow, 'items-start rounded-md py-1.5')} value="local">
            <Monitor aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{copy.kindLocal}</span>
              <span className={cn('mt-0.5 block', composerMenuDetail)}>{copy.kindLocalDesc}</span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className={cn(dropdownMenuRow, 'items-start rounded-md py-1.5')} value="cloud">
            <Cloud aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{copy.kindCloud}</span>
              <span className={cn('mt-0.5 block', composerMenuDetail)}>{cloudDetail}</span>
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
