import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { composerPanelCard } from '@/components/chat/composer-dock'
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
import { resolveUpdateChipLabel, resolveVersionStatus } from '@/lib/version-status'
import { notify, notifyError } from '@/store/notifications'
import { $connection } from '@/store/session'
import { $desktopVersion, $updateApply, $updateStatus, startActiveUpdate } from '@/store/updates'

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
  'flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left text-[length:var(--conversation-text-font-size)]',
  'max-md:h-auto max-md:min-h-11 max-md:py-1.5',
  'text-(--ui-text-secondary) transition-colors duration-100 ease-out [-webkit-app-region:no-drag]',
  'hover:bg-(--ui-control-hover-background) hover:text-foreground hover:transition-none'
)

/** Initials painted on the existing account trigger. Signed out: one letter.
 *  Signed in: email local-part, first letter of the first two segments, or
 *  the first two letters when there is only one segment. */
function accountMark(label: string, signedIn: boolean): string {
  if (!signedIn) {
    return (label.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase()
  }

  const source = label.includes('@') ? (label.split('@')[0] ?? label) : label
  const parts = source.split(/[\s._-]+/).filter(part => /[a-z0-9]/i.test(part))

  if (parts.length >= 2) {
    const first = parts[0]?.match(/[a-z0-9]/i)?.[0] ?? ''
    const second = parts[1]?.match(/[a-z0-9]/i)?.[0] ?? ''

    return `${first}${second}`.toUpperCase()
  }

  const letters = source.match(/[a-z0-9]/gi) ?? []

  return `${letters[0] ?? '?'}${letters[1] ?? ''}`.toUpperCase()
}

export function AccountFooter() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState<null | string>(null)
  const connection = useStore($connection)
  const desktopVersion = useStore($desktopVersion)
  const updateApply = useStore($updateApply)
  const updateStatus = useStore($updateStatus)
  const menu = t.accountMenu
  const signedIn = Boolean(email)
  const triggerLabel = email ?? menu.account
  const applying = updateApply.applying || updateApply.stage === 'restart'
  const updateLabel = resolveUpdateChipLabel({
    applying,
    copy: {
      restart: t.shell.statusbar.restart,
      update: t.common.update
    },
    prefetchPercent: updateStatus?.prefetchPercent,
    prefetchReady: updateStatus?.prefetchReady,
    restarting: updateApply.stage === 'restart'
  })

  const clientUpdate = resolveVersionStatus({
    applying,
    applyMessage: updateApply.message,
    behind: updateStatus?.behind ?? 0,
    branch: updateStatus?.branch,
    channel: updateStatus?.channel,
    copy: t.shell.statusbar,
    prefetchPercent: updateStatus?.prefetchPercent,
    prefetchReady: updateStatus?.prefetchReady,
    remote: connection?.mode === 'remote',
    restarting: updateApply.stage === 'restart',
    sha: updateStatus?.currentSha?.slice(0, 7) ?? null,
    target: 'client',
    updateAvailable: updateStatus?.updateAvailable,
    version: desktopVersion?.appVersion
  })

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
      <div className="flex min-w-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label={triggerLabel} className={rowClass} data-slot="account-footer-trigger" type="button">
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ui-accent) text-[0.625rem] font-medium uppercase leading-none text-(--dt-primary-foreground) max-md:size-8 max-md:text-xs"
                data-slot="account-footer-mark"
              >
                {accountMark(triggerLabel, signedIn)}
              </span>
              <span className="truncate">{triggerLabel}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn('min-w-52', composerPanelCard)}
            data-composer-menu=""
            side="top"
            sideOffset={8}
          >
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
        {clientUpdate.hasUpdate ? (
          <button
            aria-label={updateLabel}
            className={cn(
              'flex h-5 shrink-0 items-center rounded-full px-2 text-[0.6875rem] font-medium',
              'bg-(--dt-midground) text-(--dt-midground-foreground)',
              'transition-opacity duration-100 hover:opacity-90 hover:transition-none',
              '[-webkit-app-region:no-drag]'
            )}
            onClick={() => startActiveUpdate()}
            type="button"
          >
            {updateLabel}
          </button>
        ) : null}
      </div>
    </SidebarFooter>
  )
}
