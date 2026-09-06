import { useState } from 'react'

import { StatusDot } from '@/components/status-dot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, Save } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { runGatewayRestart } from '@/store/system-actions'
import { updateMessagingPlatform } from '@/work4you'

import {
  decodeDiscordApplicationId,
  DISCORD_BOT_TOKEN_RE,
  discordBotSettingsUrl,
  discordInviteUrl,
  normalizeDiscordBotToken
} from './discord-token'
import { findInvalidDiscordUser } from './validate-env'

/** Token-first Discord onboarding. There is no QR shortcut here — the bot is
 *  created by hand in the Developer Portal — but the pasted token carries the
 *  application id in its first segment, so the moment it lands we can build
 *  the OAuth invite URL and deep-link the Privileged Gateway Intents page
 *  (the #1 "bot connects but never replies" mistake) without asking the user
 *  to go find the Application ID. One save enables the channel. */
export function DiscordQuickSetup({
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
  const q = m.discordQuickSetup

  const [token, setToken] = useState('')
  const [allowedUsers, setAllowedUsers] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const normalizedToken = normalizeDiscordBotToken(token)
  const tokenShapeOk = DISCORD_BOT_TOKEN_RE.test(normalizedToken)
  const applicationId = tokenShapeOk ? decodeDiscordApplicationId(normalizedToken) : null
  // Tokens are pasted, not typed — a non-empty value that fails the shape
  // check is a paste mistake worth flagging immediately.
  const tokenError = normalizedToken && !tokenShapeOk ? m.envErrors.discordToken : ''

  async function save() {
    if (!tokenShapeOk) {
      setError(m.envErrors.discordToken)

      return
    }

    const invalidUser = findInvalidDiscordUser(allowedUsers)

    if (invalidUser) {
      setError(m.envErrors.discordUserId(invalidUser))

      return
    }

    setSaving(true)
    setError('')

    try {
      const env: Record<string, string> = { DISCORD_BOT_TOKEN: normalizedToken }
      const users = allowedUsers.trim()

      if (users) {
        env.DISCORD_ALLOWED_USERS = users
      }

      await updateMessagingPlatform('discord', { enabled: true, env }, scopeProfile)
      setToken('')
      setAllowedUsers('')
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

      <div className="mt-3">
        <label
          className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          htmlFor="discord-quick-token"
        >
          {q.tokenLabel}
        </label>
        <Input
          className="mt-1.5 h-8 max-w-112 font-mono"
          disabled={saving}
          id="discord-quick-token"
          onChange={event => {
            setToken(event.target.value)
            setError('')
          }}
          placeholder={q.tokenPlaceholder}
          type="password"
          value={token}
        />
        <p className="mt-1.5 max-w-112 text-xs leading-5 text-muted-foreground">{q.tokenHelp}</p>
        {tokenError && <p className="mt-1.5 text-xs leading-5 text-destructive">{tokenError}</p>}
      </div>

      {applicationId && (
        <div className="mt-3 space-y-3">
          <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
            <StatusDot tone="good" />
            {q.appDetected(applicationId)}
          </p>

          <ol className="list-decimal space-y-3 pl-5 text-xs leading-5 text-muted-foreground">
            <li>
              <span className="block">{q.inviteHelp}</span>
              <Button
                className="mt-1.5"
                onClick={() => openExternalLink(discordInviteUrl(applicationId))}
                size="sm"
                variant="secondary"
              >
                {q.inviteButton}
                <ExternalLink className="size-3.5" />
              </Button>
            </li>
            <li>
              <span className="block">{q.intentsHelp}</span>
              <span className="block font-medium text-foreground">{q.intentsWarning}</span>
              <Button
                className="mt-1.5"
                onClick={() => openExternalLink(discordBotSettingsUrl(applicationId))}
                size="sm"
                variant="secondary"
              >
                {q.intentsButton}
                <ExternalLink className="size-3.5" />
              </Button>
            </li>
            <li>
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
            </li>
          </ol>

          {error && <p className="text-xs leading-5 text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={saving} onClick={() => void save()} size="sm">
              <Save />
              {saving ? m.saving : m.saveAndEnable}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
