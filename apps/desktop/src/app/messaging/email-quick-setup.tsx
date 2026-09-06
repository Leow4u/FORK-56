import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, Save } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { runGatewayRestart } from '@/store/system-actions'
import { updateMessagingPlatform } from '@/work4you'

import { detectEmailPreset, EMAIL_PROVIDER_PRESETS, type EmailProviderPreset } from './email-presets'
import { validateMessagingEnv } from './validate-env'

/** Provider-preset email onboarding. Email has no pairing flow to piggyback
 *  on — the whole battle is knowing your provider's IMAP/SMTP hosts and that
 *  2FA accounts need an app password. The card picks the preset from the
 *  typed address's domain, fills the hosts, links the provider's app-password
 *  page, and saves + enables in one step. Custom servers get host/port
 *  fields; presets all use the standard ports the adapter defaults to. */
export function EmailQuickSetup({
  configured,
  onApplied,
  scopeProfile
}: {
  configured: boolean
  onApplied: () => void
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.emailQuickSetup

  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [allowedUsers, setAllowedUsers] = useState('')
  // null → custom mail server. `providerPinned` stops the domain auto-detect
  // from fighting an explicit provider click while the user keeps typing.
  const [provider, setProvider] = useState<EmailProviderPreset | null>(null)
  const [providerPinned, setProviderPinned] = useState(false)
  const [customImapHost, setCustomImapHost] = useState('')
  const [customImapPort, setCustomImapPort] = useState('')
  const [customSmtpHost, setCustomSmtpHost] = useState('')
  const [customSmtpPort, setCustomSmtpPort] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addressError = fieldError('EMAIL_ADDRESS', address)

  function fieldError(key: string, value: string): string {
    const invalid = validateMessagingEnv(key, value)

    if (!invalid) {
      return ''
    }

    switch (invalid.code) {
      case 'emailAddress':
        return m.envErrors.emailAddress(invalid.value)

      case 'emailHost':
        return m.envErrors.emailHost(invalid.value)

      case 'emailPort':
        return m.envErrors.emailPort(invalid.value)

      default:
        return ''
    }
  }

  function onAddressChange(value: string) {
    setAddress(value)
    setError('')

    if (!providerPinned) {
      setProvider(detectEmailPreset(value))
    }
  }

  function pickProvider(preset: EmailProviderPreset | null) {
    setProvider(preset)
    setProviderPinned(true)
    setError('')
  }

  async function save() {
    if (!address.trim() || !password.trim()) {
      setError(q.addressAndPasswordRequired)

      return
    }

    const imapHost = provider ? provider.imapHost : customImapHost.trim()
    const smtpHost = provider ? provider.smtpHost : customSmtpHost.trim()

    if (!imapHost || !smtpHost) {
      setError(q.hostsRequired)

      return
    }

    const checks: [string, string][] = [
      ['EMAIL_ADDRESS', address],
      ['EMAIL_ALLOWED_USERS', allowedUsers],
      ['EMAIL_IMAP_HOST', imapHost],
      ['EMAIL_SMTP_HOST', smtpHost],
      ['EMAIL_IMAP_PORT', customImapPort],
      ['EMAIL_SMTP_PORT', customSmtpPort]
    ]

    for (const [key, value] of checks) {
      const message = fieldError(key, value)

      if (message) {
        setError(message)

        return
      }
    }

    setSaving(true)
    setError('')

    try {
      const env: Record<string, string> = {
        EMAIL_ADDRESS: address.trim(),
        EMAIL_PASSWORD: password,
        EMAIL_IMAP_HOST: imapHost,
        EMAIL_SMTP_HOST: smtpHost
      }
      const users = allowedUsers.trim()

      if (users) {
        env.EMAIL_ALLOWED_USERS = users
      }

      // Ports only exist as inputs on the custom path; presets ride the
      // adapter defaults (993 / 587).
      if (!provider && customImapPort.trim()) {
        env.EMAIL_IMAP_PORT = customImapPort.trim()
      }

      if (!provider && customSmtpPort.trim()) {
        env.EMAIL_SMTP_PORT = customSmtpPort.trim()
      }

      await updateMessagingPlatform('email', { enabled: true, env }, scopeProfile)
      setPassword('')
      notify({
        kind: 'success',
        message: q.saved,
        action: { label: m.restartGateway, onClick: () => void runGatewayRestart() }
      })
      onApplied()
    } catch (saveError) {
      notifyError(saveError, q.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h4 className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {q.title}
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.66rem] font-medium normal-case tracking-normal text-primary">
          {q.recommended}
        </span>
      </h4>
      <p className="mt-1 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
        {q.intro}
      </p>
      {configured && <p className="mt-2 text-xs leading-5 text-muted-foreground">{q.replacesExisting}</p>}

      <div className="mt-3 space-y-4 text-xs leading-5 text-muted-foreground">
        <div>
          <span className="block">{q.addressHelp}</span>
          <Input
            aria-label={q.addressLabel}
            className="mt-1.5 h-8 max-w-96 font-mono"
            disabled={saving}
            onChange={event => onAddressChange(event.target.value)}
            placeholder={q.addressPlaceholder}
            value={address}
          />
          {addressError && <p className="mt-1.5 text-xs leading-5 text-destructive">{addressError}</p>}
        </div>

        <div>
          <span className="block">{q.providerLabel}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {EMAIL_PROVIDER_PRESETS.map(preset => (
              <Button
                disabled={saving}
                key={preset.id}
                onClick={() => pickProvider(preset)}
                size="sm"
                variant={provider?.id === preset.id ? 'secondary' : 'ghost'}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              disabled={saving}
              onClick={() => pickProvider(null)}
              size="sm"
              variant={provider === null ? 'secondary' : 'ghost'}
            >
              {q.providerCustom}
            </Button>
          </div>
          {provider ? (
            <p className="mt-1.5 font-mono text-xs leading-5">
              {provider.imapHost}:993 · {provider.smtpHost}:587
            </p>
          ) : (
            <div className="mt-1.5 grid max-w-96 grid-cols-[1fr_6rem] gap-1.5">
              <Input
                aria-label={q.imapHostLabel}
                className="h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setCustomImapHost(event.target.value)
                  setError('')
                }}
                placeholder="imap.example.com"
                value={customImapHost}
              />
              <Input
                aria-label={q.imapPortLabel}
                className="h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setCustomImapPort(event.target.value)
                  setError('')
                }}
                placeholder="993"
                value={customImapPort}
              />
              <Input
                aria-label={q.smtpHostLabel}
                className="h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setCustomSmtpHost(event.target.value)
                  setError('')
                }}
                placeholder="smtp.example.com"
                value={customSmtpHost}
              />
              <Input
                aria-label={q.smtpPortLabel}
                className="h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setCustomSmtpPort(event.target.value)
                  setError('')
                }}
                placeholder="587"
                value={customSmtpPort}
              />
            </div>
          )}
        </div>

        <div>
          <span className="block">{q.passwordHelp}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input
              aria-label={q.passwordLabel}
              className="h-8 max-w-96 font-mono"
              disabled={saving}
              onChange={event => {
                setPassword(event.target.value)
                setError('')
              }}
              placeholder={q.passwordPlaceholder}
              type="password"
              value={password}
            />
            {provider?.appPasswordUrl && (
              <Button onClick={() => openExternalLink(provider.appPasswordUrl!)} size="sm" variant="secondary">
                {q.createAppPassword}
                <ExternalLink className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <span className="block">{q.allowedUsersHelp}</span>
          <Input
            aria-label={q.allowedUsersLabel}
            className="mt-1.5 h-8 max-w-96 font-mono"
            disabled={saving}
            onChange={event => {
              setAllowedUsers(event.target.value)
              setError('')
            }}
            placeholder={q.allowedUsersPlaceholder}
            value={allowedUsers}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs leading-5 text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => void save()} size="sm">
          <Save />
          {saving ? m.saving : m.saveAndEnable}
        </Button>
      </div>
    </section>
  )
}
