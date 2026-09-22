import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { ApprovalModeMenu, useApprovalModeControl } from '@/app/shell/approval-mode-menu'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { releaseTypingFocus } from '@/components/ui/keyboard-first'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $activeGatewayProfile } from '@/store/profile'

import { COMPOSER_PILL } from './control-classes'

/**
 * Composer approval-mode selector — the relocated status-bar Approvals pill.
 * Same `approvals.mode` values (manual / smart / off), same gateway write,
 * same menu. Settings → Safety remains the other door onto this key.
 */
export function ApprovalModePill({ compact = false, disabled }: { compact?: boolean; disabled: boolean }) {
  const { t } = useI18n()
  const profile = useStore($activeGatewayProfile)
  const { requestGateway } = useGatewayRequest()
  const control = useApprovalModeControl(profile, requestGateway)
  const [open, setOpen] = useState(false)

  const pillClass = compact
    ? cn(
        'size-(--composer-control-size) shrink-0 justify-center gap-0 rounded-md p-0',
        'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground',
        control.isOff && 'bg-(--chrome-action-hover) text-foreground'
      )
    : cn(COMPOSER_PILL, control.isOff && 'bg-(--chrome-action-hover) text-foreground')

  const label = compact ? (
    control.icon
  ) : (
    <>
      {control.icon}
      <span className="truncate">{control.labels[control.mode]}</span>
      <ChevronDown className="size-2.5 shrink-0 opacity-50" />
    </>
  )

  const setMenuOpen = (next: boolean) => {
    setOpen(next)

    if (!next) {
      releaseTypingFocus()
    }
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={open}>
      <Tip label={control.title} side="top">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={control.title}
            className={pillClass}
            data-slot="composer-approval-mode"
            disabled={disabled}
            type="button"
            variant="ghost"
          >
            {label}
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="w-72 p-1" side="top" sideOffset={8}>
        <ApprovalModeMenu
          descriptions={control.descriptions}
          labels={control.labels}
          mode={control.mode}
          setMode={control.setMode}
          title={t.shell.approvalMode.title}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
