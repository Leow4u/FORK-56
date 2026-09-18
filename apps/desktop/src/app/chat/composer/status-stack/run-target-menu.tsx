import { useStore } from '@nanostores/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { SETTINGS_ROUTE } from '@/app/routes'
import { composerContextBar } from '@/components/chat/composer-dock'
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
import { $activeConnectionId, $connectionsRegistry, $pendingConnectionId, selectConnection } from '@/store/connections'
import { notifyError } from '@/store/notifications'
import { $connection } from '@/store/session'

import { type ComposerRunTarget, composerRunTargetIntent, resolveComposerRunTarget } from './run-target'

export function ComposerRunTargetMenu({ side = 'top' }: { side?: 'bottom' | 'top' }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const registry = useStore($connectionsRegistry)
  const activeConnectionId = useStore($activeConnectionId)
  const connection = useStore($connection)
  const pendingConnectionId = useStore($pendingConnectionId)
  const connections = registry?.connections ?? []
  const active = resolveComposerRunTarget({ activeConnectionId, connection, connections })
  const copy = t.settings.connections
  const tooltip = t.settings.gateway.modeTitle

  const choose = (target: string) => {
    if (target !== 'cloud' && target !== 'local') {
      return
    }

    const intent = composerRunTargetIntent(target as ComposerRunTarget, connections, activeConnectionId)

    if (intent.type === 'settings') {
      triggerHaptic('selection')
      navigate(`${SETTINGS_ROUTE}?tab=gateway`)

      return
    }

    if (intent.type === 'noop') {
      return
    }

    const selected = connections.find(row => row.id === intent.connectionId)
    triggerHaptic('selection')
    void selectConnection(intent.connectionId).catch(error =>
      notifyError(error, t.profiles.switchConnectionFailed(selected?.label ?? intent.connectionId))
    )
  }

  const setMenuOpen = (next: boolean) => {
    setOpen(next)

    if (!next) {
      releaseTypingFocus()
    }
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={open}>
      <Tip label={tooltip} side="top">
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
              <Monitor aria-hidden className="size-3.5 shrink-0" />
            )}
          </button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent
        align="end"
        className="min-w-64 p-1"
        data-slot="composer-run-target-menu"
        side={side}
        sideOffset={4}
      >
        <DropdownMenuRadioGroup onValueChange={choose} value={active ?? ''}>
          <DropdownMenuRadioItem className={cn(dropdownMenuRow, 'items-start rounded-md py-1.5')} value="local">
            <Monitor aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{copy.kindLocal}</span>
              <span className="mt-0.5 block text-[0.68rem] leading-snug text-(--ui-text-tertiary)">
                {copy.kindLocalDesc}
              </span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className={cn(dropdownMenuRow, 'items-start rounded-md py-1.5')} value="cloud">
            <Cloud aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{copy.kindCloud}</span>
              <span className="mt-0.5 block text-[0.68rem] leading-snug text-(--ui-text-tertiary)">
                {copy.kindCloudDesc}
              </span>
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
