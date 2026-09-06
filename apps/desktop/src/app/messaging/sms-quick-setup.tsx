import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, Save } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { runGatewayRestart } from '@/store/system-actions'
import { updateMessagingPlatform } from '@/work4you'

import { validateMessagingEnv } from './validate-env'

const TWILIO_CONSOLE_URL = 'https://console.twilio.com/'
const WEBHOOK_PATH = '/webhooks/twilio'

/** Guided Twilio SMS onboarding. SMS is the one channel where filling in the
 *  visible credentials is NOT enough: Twilio delivers inbound messages to a
 *  webhook, so the gateway needs a public URL (tunnel or reverse proxy) that
 *  the user must also paste into the Twilio console — and the adapter
 *  refuses to start without it (signature validation). This card puts that
 *  requirement in front of the user with the exact path to configure,
 *  validates the SID/number shapes client-side, and saves + enables in one
 *  step. */
export function SmsQuickSetup({
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
  const q = m.smsQuickSetup

  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [allowedUsers, setAllowedUsers] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const sidError = accountSid.trim() ? fieldError('TWILIO_ACCOUNT_SID', accountSid) : ''
  const numberError = phoneNumber.trim() ? fieldError('TWILIO_PHONE_NUMBER', phoneNumber) : ''

  function fieldError(key: string, value: string): string {
    const invalid = validateMessagingEnv(key, value)

    if (!invalid) {
      return ''
    }

    switch (invalid.code) {
      case 'smsNumber':
        return m.envErrors.smsNumber(invalid.value)

      case 'smsWebhookUrl':
        return m.envErrors.smsWebhookUrl(invalid.value)

      case 'twilioAccountSid':
        return m.envErrors.twilioAccountSid

      default:
        return ''
    }
  }

  async function save() {
    if (!accountSid.trim() || !authToken.trim() || !phoneNumber.trim() || !webhookUrl.trim()) {
      setError(q.allFieldsRequired)

      return
    }

    const checks: [string, string][] = [
      ['TWILIO_ACCOUNT_SID', accountSid],
      ['TWILIO_PHONE_NUMBER', phoneNumber],
      ['SMS_WEBHOOK_URL', webhookUrl],
      ['SMS_ALLOWED_USERS', allowedUsers]
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
        TWILIO_ACCOUNT_SID: accountSid.trim(),
        TWILIO_AUTH_TOKEN: authToken.trim(),
        TWILIO_PHONE_NUMBER: phoneNumber.trim(),
        SMS_WEBHOOK_URL: webhookUrl.trim()
      }

      const users = allowedUsers.trim()

      if (users) {
        env.SMS_ALLOWED_USERS = users
      }

      await updateMessagingPlatform('sms', { enabled: true, env }, scopeProfile)
      setAuthToken('')
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
          <span className="block">{q.credentialsHelp}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input
              aria-label={q.accountSidLabel}
              className="h-8 max-w-96 font-mono"
              disabled={saving}
              onChange={event => {
                setAccountSid(event.target.value)
                setError('')
              }}
              placeholder={q.accountSidPlaceholder}
              value={accountSid}
            />
            <Button onClick={() => openExternalLink(TWILIO_CONSOLE_URL)} size="sm" variant="secondary">
              {q.openConsole}
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
          {sidError && <p className="mt-1.5 text-xs leading-5 text-destructive">{sidError}</p>}
          <Input
            aria-label={q.authTokenLabel}
            className="mt-1.5 h-8 max-w-96 font-mono"
            disabled={saving}
            onChange={event => {
              setAuthToken(event.target.value)
              setError('')
            }}
            placeholder={q.authTokenPlaceholder}
            type="password"
            value={authToken}
          />
        </div>

        <div>
          <span className="block">{q.phoneHelp}</span>
          <Input
            aria-label={q.phoneLabel}
            className="mt-1.5 h-8 max-w-96 font-mono"
            disabled={saving}
            onChange={event => {
              setPhoneNumber(event.target.value)
              setError('')
            }}
            placeholder="+15551234567"
            value={phoneNumber}
          />
          {numberError && <p className="mt-1.5 text-xs leading-5 text-destructive">{numberError}</p>}
        </div>

        <div>
          <span className="block">{q.webhookHelp}</span>
          <Input
            aria-label={q.webhookLabel}
            className="mt-1.5 h-8 max-w-96 font-mono"
            disabled={saving}
            onChange={event => {
              setWebhookUrl(event.target.value)
              setError('')
            }}
            placeholder={`https://your-domain.com${WEBHOOK_PATH}`}
            value={webhookUrl}
          />
          <p className="mt-1.5 max-w-96 text-xs leading-5 text-muted-foreground">{q.webhookHint}</p>
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
            placeholder="+15559876543, +15551112222"
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
