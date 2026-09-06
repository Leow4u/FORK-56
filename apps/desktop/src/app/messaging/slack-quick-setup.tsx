import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Copy, ExternalLink, Save } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { runGatewayRestart } from '@/store/system-actions'
import { getSlackManifest, updateMessagingPlatform } from '@/work4you'

import { validateMessagingEnv } from './validate-env'

const SLACK_NEW_APP_URL = 'https://api.slack.com/apps?new_app=1'

/** Manifest-first Slack onboarding. Slack has no QR pairing for bots, but it
 *  can create a complete app from a pasted manifest — scopes, event
 *  subscriptions, Socket Mode, and every gateway slash command in one paste,
 *  instead of the six-step manual walk where a single missed scope
 *  (channels:history is the classic) leaves a bot that only answers DMs.
 *  What a manifest cannot do is mint tokens, so steps 2-3 collect the two
 *  tokens by hand. One save stores both (+ optional allowlist) and enables
 *  the channel. */
export function SlackQuickSetup({
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
  const q = m.slackQuickSetup

  const [botToken, setBotToken] = useState('')
  const [appToken, setAppToken] = useState('')
  const [allowedUsers, setAllowedUsers] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<null | number>(null)

  // Swapping the two tokens is the classic paste mistake — flag it live.
  const botTokenError = fieldError('SLACK_BOT_TOKEN', botToken)
  const appTokenError = fieldError('SLACK_APP_TOKEN', appToken)

  function fieldError(key: string, value: string): string {
    const invalid = validateMessagingEnv(key, value)

    if (!invalid) {
      return ''
    }

    switch (invalid.code) {
      case 'slackMemberId':
        return m.envErrors.slackMemberId(invalid.value)

      case 'slackTokenPrefix':
        return m.envErrors.slackTokenPrefix(invalid.prefix)

      default:
        return ''
    }
  }

  async function copyManifest() {
    try {
      const { manifest } = await getSlackManifest()

      await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2))
      setCopied(true)

      if (copiedTimer.current !== null) {
        window.clearTimeout(copiedTimer.current)
      }

      copiedTimer.current = window.setTimeout(() => setCopied(false), 2500)
    } catch (copyError) {
      notifyError(copyError, q.manifestCopyFailed)
    }
  }

  async function save() {
    if (!botToken.trim() || !appToken.trim()) {
      setError(q.bothTokensRequired)

      return
    }

    for (const [key, value] of [
      ['SLACK_BOT_TOKEN', botToken],
      ['SLACK_APP_TOKEN', appToken],
      ['SLACK_ALLOWED_USERS', allowedUsers]
    ] as const) {
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
        SLACK_BOT_TOKEN: botToken.trim(),
        SLACK_APP_TOKEN: appToken.trim()
      }

      const users = allowedUsers.trim()

      if (users) {
        env.SLACK_ALLOWED_USERS = users
      }

      await updateMessagingPlatform('slack', { enabled: true, env }, scopeProfile)
      setBotToken('')
      setAppToken('')
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

      <ol className="mt-3 list-decimal space-y-4 pl-5 text-xs leading-5 text-muted-foreground">
        <li>
          <span className="block">{q.manifestHelp}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Button onClick={() => void copyManifest()} size="sm" variant="secondary">
              <Copy className="size-3.5" />
              {copied ? q.manifestCopied : q.copyManifest}
            </Button>
            <Button onClick={() => openExternalLink(SLACK_NEW_APP_URL)} size="sm" variant="secondary">
              {q.createApp}
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </li>
        <li>
          <span className="block">{q.botTokenHelp}</span>
          <Input
            aria-label={q.botTokenLabel}
            className="mt-1.5 h-8 max-w-112 font-mono"
            disabled={saving}
            onChange={event => {
              setBotToken(event.target.value)
              setError('')
            }}
            placeholder={q.botTokenPlaceholder}
            type="password"
            value={botToken}
          />
          {botTokenError && <p className="mt-1.5 text-xs leading-5 text-destructive">{botTokenError}</p>}
        </li>
        <li>
          <span className="block">{q.appTokenHelp}</span>
          <Input
            aria-label={q.appTokenLabel}
            className="mt-1.5 h-8 max-w-112 font-mono"
            disabled={saving}
            onChange={event => {
              setAppToken(event.target.value)
              setError('')
            }}
            placeholder={q.appTokenPlaceholder}
            type="password"
            value={appToken}
          />
          {appTokenError && <p className="mt-1.5 text-xs leading-5 text-destructive">{appTokenError}</p>}
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
