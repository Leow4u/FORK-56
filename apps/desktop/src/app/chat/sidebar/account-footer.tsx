import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SidebarFooter } from '@/components/ui/sidebar'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import { SETTINGS_ROUTE } from '../../routes'

export const ACCOUNT_DOCS_URL = 'https://work4you.ai/docs/'
export const ACCOUNT_CONTACT_URL = 'https://work4you.ai/contact/'

// Sidebar account menu for the human Work4You Portal login — not a Work4You
// profile. The Profile Rail above this footer is a different identity (which
// agent is active). This row is who is signed in.
//
// The trigger shows the Portal email when we have one, or a generic Account
// label when we do not. Clicking always opens the same menu (Settings, Docs,
// Shortcuts, Contact Us). Log Out is only present when an email is showing —
// there is no Portal session to clear otherwise.
//
// Email re-checks on window focus: portal sign-in/out happens in a separate
// BrowserWindow, so focus returning to the main window is the natural
// "state may have changed" signal — no polling, no new IPC surface.
const rowClass = cn(
  'flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-xs',
  'text-(--ui-text-tertiary) transition-colors duration-100 ease-out [-webkit-app-region:no-drag]',
  'hover:bg-(--ui-control-hover-background) hover:text-foreground hover:transition-none'
)

export function AccountFooter() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState<null | string>(null)
  const menu = t.accountMenu
  const signedIn = Boolean(email)
  const triggerLabel = email ?? menu.account

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

  const openShortcuts = () => {
    triggerHaptic('open')
    navigate(`${SETTINGS_ROUTE}?tab=keybinds`)
  }

  const openDocs = () => {
    triggerHaptic('open')
    openExternalLink(ACCOUNT_DOCS_URL)
  }

  const openContact = () => {
    triggerHaptic('open')
    openExternalLink(ACCOUNT_CONTACT_URL)
  }

  const signOut = () => {
    const cloud = window.work4youDesktop?.cloud

    if (!cloud?.logout) {
      return
    }

    triggerHaptic('open')
    void cloud
      .logout()
      .then(result => {
        if (!result.signedIn) {
          setEmail(null)
          notify({
            kind: 'success',
            message: t.settings.gateway.cloudSignedOutMessage,
            title: t.settings.gateway.cloudSignedOutTitle
          })
        }
      })
      .catch(err => {
        notifyError(err, t.settings.gateway.signOutFailed)
      })
  }

  return (
    <SidebarFooter className="shrink-0 border-t border-(--ui-stroke-tertiary) px-1.5 py-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={rowClass} title={triggerLabel} type="button">
            <span className="truncate">{triggerLabel}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuItem onSelect={openSettings}>
            <Codicon aria-hidden="true" name="settings-gear" size="0.8rem" />
            {menu.settings}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openDocs}>
            <Codicon aria-hidden="true" name="book" size="0.8rem" />
            {menu.docs}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openShortcuts}>
            <Codicon aria-hidden="true" name="keyboard" size="0.8rem" />
            {menu.shortcuts}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openContact}>
            <Codicon aria-hidden="true" name="mail" size="0.8rem" />
            {menu.contactUs}
          </DropdownMenuItem>
          {signedIn ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <Codicon aria-hidden="true" name="sign-out" size="0.8rem" />
                {menu.logOut}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarFooter>
  )
}
