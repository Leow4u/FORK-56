import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { hudTargetSessionId } from '@/app/hud/handoff'
import { composerPanelCard } from '@/components/chat/composer-dock'
import { FEATURED_ID } from '@/components/onboarding'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SidebarFooter } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { resolveUpdateChipLabel, resolveVersionStatus } from '@/lib/version-status'
import { toggleHud } from '@/store/hud'
import { notifyError } from '@/store/notifications'
import { $desktopOnboarding, startManualProviderOAuth } from '@/store/onboarding'
import { $activeProfile } from '@/store/profile'
import { $connection, $gatewayState } from '@/store/session'
import { $desktopVersion, $updateApply, $updateStatus, startClientUpdate } from '@/store/updates'
import { getPortalAccount } from '@/work4you'

import { SETTINGS_ROUTE } from '../../routes'

import { accountMark, accountMenuLabel } from './account-label'
import { PORTAL_ACCOUNT_CHANGED, signOutOfPortal } from './portal-session'

export const ACCOUNT_DOCS_URL = 'https://work4you.ai/docs/'
export const ACCOUNT_CONTACT_URL = 'https://work4you.ai/contact/'

// Sidebar account menu for the human Work4You Portal login — not a Work4You
// profile. The Profile Rail above this footer is a different identity (which
// agent is active). This row is who is signed in.
//
// One login: the menu reads the same Portal login the agent runs on (the
// first-run "Work4You Portal" sign-in, done in the browser), so there is never
// a second sign-in. The trigger shows the cadastro name when the Portal saved
// one, otherwise the Portal email, otherwise a generic Account label — and a
// placeholder, not that label, until the first identity read has answered
// (the backend is still coming up for most of a cold start). Clicking
// always opens the same menu (Settings, HUD mode, Docs, Shortcuts, Contact Us).
// The running app version sits at the bottom of that menu, the way Cursor
// shows it — not on a Settings page. Signed in adds Log Out, which removes that
// login and shows the sign-in screen; signed out adds Sign in, which starts it.
//
// Right of the trigger, in a fixed order: the Update chip (only while an
// update exists) and then a gear that opens Settings in one click. The gear is
// a shortcut to the menu's first item, not a replacement for it — Settings
// stays in the menu for keyboard and screen-reader users who land on the
// trigger — and it keeps its place at the far right whether or not the chip is
// showing, so the one always-visible target never moves.
//
// The identity re-reads when sign-in/out finishes in the onboarding overlay,
// on a profile switch, when the backend comes up, and on window focus (the
// browser sign-in hands focus back) — no polling.
interface AccountState {
  label: null | string
  /** Null until the first read answers: neither Sign in nor Log Out yet. */
  loggedIn: boolean | null
}

const ACCOUNT_UNKNOWN: AccountState = { label: null, loggedIn: null }
const SIGNED_OUT: AccountState = { label: null, loggedIn: false }

const rowClass = cn(
  'flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left text-[length:var(--conversation-text-font-size)]',
  'max-md:h-auto max-md:min-h-11 max-md:py-1.5',
  'text-(--ui-text-secondary) transition-colors duration-100 ease-out [-webkit-app-region:no-drag]',
  'hover:bg-(--ui-control-hover-background) hover:text-foreground hover:transition-none'
)

export function AccountFooter() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountState>(ACCOUNT_UNKNOWN)
  // Bumped by every read and by sign-out, so a slower earlier answer never
  // repaints an identity the user just replaced or left.
  const readSeq = useRef(0)
  const connection = useStore($connection)
  const gatewayState = useStore($gatewayState)
  const activeProfile = useStore($activeProfile)
  const onboarding = useStore($desktopOnboarding)
  const desktopVersion = useStore($desktopVersion)
  const updateApply = useStore($updateApply)
  const updateStatus = useStore($updateStatus)
  const menu = t.accountMenu
  const triggerLabel = account.label ?? menu.account
  const accountPending = account.loggedIn === null
  const onboardingKey = `${onboarding.configured}:${onboarding.manual}:${onboarding.requested}`
  const applying = updateApply.applying || updateApply.stage === 'restart'

  const updateLabel = resolveUpdateChipLabel({
    applying,
    copy: {
      restart: t.shell.statusbar.restart,
      update: t.common.update,
      restartToFinish: t.updates.restartToFinish,
      openInstaller: t.updates.openInstaller,
      preparing: t.updates.preparingDownload,
      retryDownload: t.updates.retryDownload
    },
    channel: updateStatus?.channel,
    platform: desktopVersion?.platform,
    prefetchError: updateStatus?.prefetchError,
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

    const check = async () => {
      const seq = ++readSeq.current

      try {
        const status = await getPortalAccount()

        if (!cancelled && seq === readSeq.current) {
          setAccount(status.logged_in ? { label: accountMenuLabel(status), loggedIn: true } : SIGNED_OUT)
        }
      } catch {
        // Backend not up yet (or no desktop bridge): keep the last answer;
        // the next focus or gateway change reads again.
      }
    }

    const onFocus = () => void check()

    void check()
    window.addEventListener('focus', onFocus)
    window.addEventListener(PORTAL_ACCOUNT_CHANGED, onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(PORTAL_ACCOUNT_CHANGED, onFocus)
    }
  }, [activeProfile, gatewayState, onboardingKey])

  const openSettings = () => {
    triggerHaptic('open')
    navigate(SETTINGS_ROUTE)
  }

  const openHudMode = () => {
    triggerHaptic('open')
    toggleHud(hudTargetSessionId())
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

  // Same door as the first-run screen and Billing's Portal row.
  const signIn = () => {
    triggerHaptic('open')
    startManualProviderOAuth(FEATURED_ID)
  }

  const signOut = async () => {
    triggerHaptic('open')

    try {
      await signOutOfPortal()
    } catch (err) {
      notifyError(err, t.settings.gateway.signOutFailed)

      return
    }

    readSeq.current += 1
    setAccount(SIGNED_OUT)
  }

  return (
    <SidebarFooter className="shrink-0 border-t border-(--ui-stroke-tertiary) px-1.5 py-1">
      <div className="flex min-w-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-busy={accountPending || undefined}
              aria-label={triggerLabel}
              className={rowClass}
              data-slot="account-footer-trigger"
              type="button"
            >
              {accountPending ? (
                // Neither "Account" nor an initial: the identity is one read away.
                <span aria-hidden className="flex items-center gap-2" data-slot="account-footer-placeholder">
                  <Skeleton className="size-5 shrink-0 rounded-full max-md:size-8" />
                  <Skeleton className="h-3 w-18 rounded-sm" />
                </span>
              ) : (
                <>
                  <span
                    aria-hidden
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ui-accent) text-[0.625rem] font-medium uppercase leading-none text-(--dt-primary-foreground) max-md:size-8 max-md:text-xs"
                    data-slot="account-footer-mark"
                  >
                    {accountMark(triggerLabel, Boolean(account.label))}
                  </span>
                  <span className="truncate">{triggerLabel}</span>
                </>
              )}
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
            <DropdownMenuItem onSelect={openHudMode}>
              <Codicon aria-hidden="true" name="comment-discussion" size="0.8rem" />
              {menu.hud}
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
            {account.loggedIn === true ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <Codicon aria-hidden="true" name="sign-out" size="0.8rem" />
                  {menu.logOut}
                </DropdownMenuItem>
              </>
            ) : null}
            {account.loggedIn === false ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signIn}>
                  <Codicon aria-hidden="true" name="sign-in" size="0.8rem" />
                  {menu.signIn}
                </DropdownMenuItem>
              </>
            ) : null}
            {desktopVersion?.appVersion ? (
              <>
                <DropdownMenuSeparator />
                <p className="px-2 pt-0.5 pb-1 text-xs text-(--ui-text-tertiary)" data-slot="account-menu-version">
                  {menu.version(desktopVersion.appVersion)}
                </p>
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
            onClick={() => startClientUpdate()}
            type="button"
          >
            {updateLabel}
          </button>
        ) : null}
        <Tip label={menu.settings}>
          <Button
            aria-label={menu.settings}
            className="shrink-0 bg-transparent text-(--ui-text-tertiary) hover:bg-(--ui-control-hover-background) hover:text-foreground [-webkit-app-region:no-drag]"
            data-slot="account-footer-settings"
            onClick={openSettings}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Codicon aria-hidden="true" name="settings-gear" size="0.875rem" />
          </Button>
        </Tip>
      </div>
    </SidebarFooter>
  )
}
