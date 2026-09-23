import { useStore } from '@nanostores/react'
import { type ReactNode, useEffect, useMemo } from 'react'

import type { StatusbarItem } from '@/app/shell/statusbar-controls'
import { composerMenuDetail, composerMenuLabel } from '@/components/chat/composer-dock'
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { Zap, ZapFilled } from '@/lib/icons'
import {
  $approvalModes,
  type ApprovalMode,
  type ApprovalModeRequester,
  setApprovalModeForProfile,
  syncApprovalModeForProfile
} from '@/store/approval-mode'

const APPROVAL_MODE_ORDER = ['manual', 'smart', 'off'] as const

export interface ApprovalModeControl {
  descriptions: Record<ApprovalMode, string>
  icon: ReactNode
  isOff: boolean
  labels: Record<ApprovalMode, string>
  mode: ApprovalMode
  setMode: (mode: ApprovalMode) => void
  title: string
}

export function useApprovalModeControl(profile: string, requestGateway: ApprovalModeRequester): ApprovalModeControl {
  const { t } = useI18n()
  const copy = t.shell.approvalMode
  const modes = useStore($approvalModes)
  const mode = modes[profile.trim() || 'default'] ?? 'smart'
  const isOff = mode === 'off'

  const labels = useMemo<Record<ApprovalMode, string>>(
    () => ({ manual: copy.manual, smart: copy.smart, off: copy.off }),
    [copy.manual, copy.off, copy.smart]
  )

  const descriptions = useMemo<Record<ApprovalMode, string>>(
    () => ({
      manual: copy.manualDescription,
      smart: copy.smartDescription,
      off: copy.offDescription
    }),
    [copy.manualDescription, copy.offDescription, copy.smartDescription]
  )

  useEffect(() => {
    void syncApprovalModeForProfile(requestGateway, profile).catch(() => undefined)
  }, [profile, requestGateway])

  return {
    descriptions,
    icon: isOff ? <ZapFilled className="size-3.5" /> : <Zap className="size-3.5 opacity-70" />,
    isOff,
    labels,
    mode,
    setMode: next => {
      void setApprovalModeForProfile(requestGateway, profile, next).catch(() => undefined)
    },
    title: copy.ariaLabel(labels[mode])
  }
}

export function ApprovalModeMenu({
  descriptions,
  labels,
  mode,
  setMode,
  title
}: Pick<ApprovalModeControl, 'descriptions' | 'labels' | 'mode' | 'setMode'> & { title: string }) {
  const { t } = useI18n()

  return (
    <>
      <DropdownMenuLabel className={composerMenuLabel}>{title || t.shell.approvalMode.title}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup onValueChange={value => setMode(value as ApprovalMode)} value={mode}>
        {APPROVAL_MODE_ORDER.map(value => (
          <DropdownMenuRadioItem
            className="items-start gap-2"
            key={value}
            onSelect={() => setMode(value)}
            value={value}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-foreground">{labels[value]}</span>
              <span className={composerMenuDetail}>{descriptions[value]}</span>
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}

export function useApprovalModeStatusbarItem(profile: string, requestGateway: ApprovalModeRequester): StatusbarItem {
  const { t } = useI18n()
  const control = useApprovalModeControl(profile, requestGateway)

  return {
    className: control.isOff ? 'bg-(--chrome-action-hover) text-foreground' : undefined,
    icon: control.icon,
    id: 'approval-mode',
    label: control.labels[control.mode],
    menuAlign: 'end',
    menuClassName: 'w-72 p-1',
    menuContent: (
      <ApprovalModeMenu
        descriptions={control.descriptions}
        labels={control.labels}
        mode={control.mode}
        setMode={control.setMode}
        title={t.shell.approvalMode.title}
      />
    ),
    title: control.title,
    variant: 'menu'
  }
}
