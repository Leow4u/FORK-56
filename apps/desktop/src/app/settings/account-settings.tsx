import { useEffect, useState } from 'react'

import { accountMark, accountMenuLabel } from '@/app/chat/sidebar/account-label'
import { notifyPortalAccountChanged, signOutOfPortal } from '@/app/chat/sidebar/portal-session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DesktopAccountProfileSave } from '@/global'
import { useI18n } from '@/i18n'
import { notify, notifyError } from '@/store/notifications'
import type { PortalAccountIdentity } from '@/types/work4you'
import { getPortalAccount, refreshPortalAccount } from '@/work4you'

import { accountProfilePatchBody, portalAccountSettingsUrl } from './account-name'
import { openExternal } from './billing/open-external'
import { PortalAccount } from './portal-account'
import { ListRow, ListRowSkeleton, SectionHeading, SettingsContent, SettingsGroup } from './primitives'

const SIGNED_OUT: PortalAccountIdentity = { email: null, logged_in: false, name: null }

function saveFailureCopy(
  error: Extract<DesktopAccountProfileSave, { ok: false }>['error'],
  copy: {
    nameRequired: string
    saveFailed: string
    signInAgain: string
  }
): string {
  if (error === 'unauthorized') {
    return copy.signInAgain
  }

  if (error === 'invalid_profile') {
    return copy.nameRequired
  }

  return copy.saveFailed
}

function AccountMark({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-(--ui-accent) text-[0.6875rem] font-medium uppercase leading-none text-(--dt-primary-foreground)"
      data-slot="account-settings-mark"
    >
      {accountMark(label, true)}
    </span>
  )
}

/** The person signed in to Work4You. Agent profiles stay on the Profiles overlay. */
export function AccountSettings() {
  const { t } = useI18n()
  const copy = t.settings.account
  const [identity, setIdentity] = useState<PortalAccountIdentity | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const names = accountProfilePatchBody(firstName, lastName)

  useEffect(() => {
    let cancelled = false

    void getPortalAccount()
      .then(status => {
        if (cancelled) {
          return
        }

        setIdentity(status)
        setFirstName(status.first_name ?? '')
        setLastName(status.last_name ?? '')
      })
      .catch(() => {
        if (!cancelled) {
          setIdentity(SIGNED_OUT)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    if (!names || saving) {
      return
    }

    const saveAccount = window.work4youDesktop?.cloud?.saveAccountProfile

    if (!saveAccount) {
      notify({ kind: 'error', title: copy.title, message: copy.saveFailed })

      return
    }

    setSaving(true)

    try {
      const saved = await saveAccount(names)

      if (!saved.ok) {
        notify({ kind: 'error', title: copy.title, message: saveFailureCopy(saved.error, copy) })

        return
      }

      try {
        const fresh = await refreshPortalAccount()
        setIdentity(fresh)
        setFirstName(fresh.first_name ?? saved.firstName)
        setLastName(fresh.last_name ?? saved.lastName)
      } catch {
        setFirstName(saved.firstName)
        setLastName(saved.lastName)
      }

      notifyPortalAccountChanged()
      notify({ durationMs: 3_000, kind: 'success', title: copy.title, message: copy.saved })
    } catch (err) {
      notifyError(err, copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function logOut() {
    if (signingOut) {
      return
    }

    setSigningOut(true)

    try {
      await signOutOfPortal()
      setIdentity(SIGNED_OUT)
      notifyPortalAccountChanged()
    } catch (err) {
      notifyError(err, copy.logOutFailed)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <SettingsContent>
      <SectionHeading title={copy.title} variant="page" />
      {identity === null ? (
        <SettingsGroup>
          <ListRowSkeleton />
          <ListRowSkeleton />
        </SettingsGroup>
      ) : identity.logged_in ? (
        <>
          <form
            onSubmit={event => {
              event.preventDefault()
              void save()
            }}
          >
            <SettingsGroup
              aside={<AccountMark label={accountMenuLabel(identity) ?? identity.email ?? ''} />}
              title={copy.identity}
            >
              <ListRow
                action={
                  <span className="block max-w-56 truncate text-[length:var(--conversation-text-font-size)] text-(--ui-text-tertiary)">
                    {identity.email || '—'}
                  </span>
                }
                title={copy.email}
              />
              <ListRow
                action={
                  <Input
                    aria-label={copy.firstName}
                    autoComplete="given-name"
                    className="w-56 max-w-full"
                    onChange={event => setFirstName(event.target.value)}
                    value={firstName}
                  />
                }
                title={copy.firstName}
              />
              <ListRow
                action={
                  <div className="flex w-56 max-w-full flex-col items-end gap-1.5">
                    <Input
                      aria-label={copy.lastName}
                      autoComplete="family-name"
                      className="w-full"
                      onChange={event => setLastName(event.target.value)}
                      value={lastName}
                    />
                    <Button disabled={!names || saving} size="inline" type="submit" variant="textStrong">
                      {saving ? copy.saving : copy.saveName}
                    </Button>
                  </div>
                }
                title={copy.lastName}
              />
            </SettingsGroup>
          </form>
          <SettingsGroup title={copy.signIn}>
            <ListRow
              action={
                <Button
                  onClick={() => openExternal(portalAccountSettingsUrl(identity.portal_url))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {copy.manage}
                </Button>
              }
              description={identity.email || undefined}
              title={copy.linkedAccounts}
            />
          </SettingsGroup>
          <SettingsGroup title={copy.session}>
            <ListRow
              action={
                <Button disabled={signingOut} onClick={() => void logOut()} size="sm" type="button" variant="outline">
                  {copy.logOut}
                </Button>
              }
              title={copy.logOutTitle}
            />
          </SettingsGroup>
        </>
      ) : (
        <PortalAccount />
      )}
    </SettingsContent>
  )
}
