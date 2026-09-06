import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SidebarFooter } from '@/components/ui/sidebar'
import { Tip, TipKeybindLabel } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

import { SETTINGS_ROUTE } from '../../routes'

// The sidebar user menu (steps 1+2 of the approved study): the signed-in
// Work4You Portal ACCOUNT's email — the human's Portal login, not a profile;
// the Profile Rail above is untouched — as a quiet row at the very bottom of
// the sidebar, below everything that already exists. Clicking it opens the
// user menu, whose first entry is Settings — the same navigate(SETTINGS_ROUTE)
// action the titlebar gear used to trigger. The gear moved here from the
// titlebar; the `mod+,` keybind and the command-palette entry are unchanged.
//
// When there is no email (signed out, no desktop bridge, or a shell that
// predates the status field), the row IS the settings button directly —
// one-click parity with the titlebar gear this footer replaces.
//
// Email state re-checks on window focus: portal sign-in/out happens in a
// separate BrowserWindow, so focus returning to the main window is the
// natural "state may have changed" signal — no polling, no new IPC surface.
const rowClass = cn(
  'flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-xs',
  'text-(--ui-text-tertiary) transition-colors duration-100 ease-out [-webkit-app-region:no-drag]',
  'hover:bg-(--ui-control-hover-background) hover:text-foreground hover:transition-none'
)

export function AccountFooter() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState<null | string>(null)

  useEffect(() => {
    let cancelled = false

    const check = () => {
      const cloud = window.work4youDesktop?.cloud

      if (!cloud) {
        return
      }

      void cloud
        .status()
        .then(status => {
          if (!cancelled) {
            setEmail(status.signedIn && status.email ? status.email : null)
          }
        })
        .catch(() => undefined)
    }

    check()
    window.addEventListener('focus', check)

    return () => {
      cancelled = true
      window.removeEventListener('focus', check)
    }
  }, [])

  const openSettings = () => {
    triggerHaptic('open')
    navigate(SETTINGS_ROUTE)
  }

  if (!email) {
    return (
      <SidebarFooter className="shrink-0 border-t border-(--ui-stroke-tertiary) px-1.5 py-1">
        <Tip label={<TipKeybindLabel actionId="nav.settings" text={t.titlebar.openSettings} />}>
          <button aria-label={t.titlebar.openSettings} className={rowClass} onClick={openSettings} type="button">
            <Codicon aria-hidden="true" name="settings-gear" size="0.875rem" />
            <span className="truncate">{t.titlebar.openSettings}</span>
          </button>
        </Tip>
      </SidebarFooter>
    )
  }

  return (
    <SidebarFooter className="shrink-0 border-t border-(--ui-stroke-tertiary) px-1.5 py-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={rowClass} title={email} type="button">
            <span className="truncate">{email}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuItem onSelect={openSettings}>
            <Codicon aria-hidden="true" name="settings-gear" size="0.8rem" />
            {t.titlebar.openSettings}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarFooter>
  )
}
