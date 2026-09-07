import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, Save } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { runGatewayRestart } from '@/store/system-actions'
import { updateMessagingPlatform } from '@/work4you'

import { GOOGLE_CHAT_SUBSCRIPTION_RE, validateMessagingEnv } from './validate-env'

const CLOUD_CONSOLE_URL = 'https://console.cloud.google.com/'
const CHAT_API_CONFIG_URL = 'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat'

export type GoogleChatMode = 'http' | 'pubsub'

/** Pulls the project id embedded in a full Pub/Sub subscription path so the
 *  card can flag a mismatch with the separately-entered project id before the
 *  gateway subscribes against the wrong project. */
export function subscriptionProject(subscription: string): null | string {
  const match = /^projects\/([^/\s]+)\/subscriptions\/[^/\s]+$/.exec(subscription.trim())

  return match ? match[1] : null
}

/** Guided Google Chat onboarding. The adapter supports two inbound modes —
 *  Cloud Pub/Sub (no public URL, recommended) and HTTP callbacks (public
 *  HTTPS endpoint) — but the flat env-var list never says so, and users fill
 *  a bit of each mode and get a gateway that never receives events. The card
 *  makes the mode an explicit choice, shows only that mode's fields, links
 *  the exact Google Cloud console pages, and saves + enables in one step. */
export function GoogleChatQuickSetup({
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
  const q = m.googleChatQuickSetup

  const [mode, setMode] = useState<GoogleChatMode>('pubsub')
  const [saJson, setSaJson] = useState('')
  const [projectId, setProjectId] = useState('')
  const [subscription, setSubscription] = useState('')
  const [eventsUrl, setEventsUrl] = useState('')
  const [audience, setAudience] = useState('')
  const [saEmail, setSaEmail] = useState('')
  const [allowedUsers, setAllowedUsers] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function fieldError(key: string, value: string): string {
    const invalid = validateMessagingEnv(key, value)

    if (!invalid) {
      return ''
    }

    switch (invalid.code) {
      case 'emailAddress':
        return m.envErrors.emailAddress(invalid.value)

      case 'googleChatEventsUrl':
        return m.envErrors.googleChatEventsUrl(invalid.value)

      case 'googleChatProjectId':
        return m.envErrors.googleChatProjectId(invalid.value)

      case 'googleChatSubscription':
        return m.envErrors.googleChatSubscription(invalid.value)

      default:
        return ''
    }
  }

  const projectError = projectId.trim() ? fieldError('GOOGLE_CHAT_PROJECT_ID', projectId) : ''

  const subscriptionShapeError = subscription.trim() ? fieldError('GOOGLE_CHAT_SUBSCRIPTION_NAME', subscription) : ''

  const embeddedProject =
    subscription.trim() && GOOGLE_CHAT_SUBSCRIPTION_RE.test(subscription.trim())
      ? subscriptionProject(subscription)
      : null

  const mismatchError =
    embeddedProject && projectId.trim() && embeddedProject !== projectId.trim() ? q.projectMismatch : ''

  const subscriptionError = subscriptionShapeError || mismatchError
  const eventsUrlError = eventsUrl.trim() ? fieldError('GOOGLE_CHAT_HTTP_EVENTS_URL', eventsUrl) : ''
  const saEmailError = saEmail.trim() ? fieldError('GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL', saEmail) : ''

  async function save() {
    if (mode === 'pubsub' && (!projectId.trim() || !subscription.trim())) {
      setError(q.pubsubFieldsRequired)

      return
    }

    if (mode === 'http' && (!eventsUrl.trim() || !saEmail.trim())) {
      setError(q.httpFieldsRequired)

      return
    }

    const checks: [string, string][] =
      mode === 'pubsub'
        ? [
            ['GOOGLE_CHAT_PROJECT_ID', projectId],
            ['GOOGLE_CHAT_SUBSCRIPTION_NAME', subscription],
            ['GOOGLE_CHAT_ALLOWED_USERS', allowedUsers]
          ]
        : [
            ['GOOGLE_CHAT_HTTP_EVENTS_URL', eventsUrl],
            ['GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL', saEmail],
            ['GOOGLE_CHAT_ALLOWED_USERS', allowedUsers]
          ]

    for (const [key, value] of checks) {
      const message = fieldError(key, value)

      if (message) {
        setError(message)

        return
      }
    }

    if (mode === 'pubsub' && mismatchError) {
      setError(mismatchError)

      return
    }

    setSaving(true)
    setError('')

    try {
      const env: Record<string, string> = {}

      if (saJson.trim()) {
        env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON = saJson.trim()
      }

      if (mode === 'pubsub') {
        env.GOOGLE_CHAT_PROJECT_ID = projectId.trim()
        env.GOOGLE_CHAT_SUBSCRIPTION_NAME = subscription.trim()
      } else {
        env.GOOGLE_CHAT_HTTP_EVENTS_URL = eventsUrl.trim()
        env.GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL = saEmail.trim()

        if (audience.trim()) {
          env.GOOGLE_CHAT_HTTP_EVENTS_AUDIENCE = audience.trim()
        }
      }

      const users = allowedUsers.trim()

      if (users) {
        env.GOOGLE_CHAT_ALLOWED_USERS = users
      }

      await updateMessagingPlatform('google_chat', { enabled: true, env }, scopeProfile)
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

  const checklist =
    mode === 'pubsub' ? [q.pubsubStep1, q.pubsubStep2, q.pubsubStep3, q.pubsubStep4] : [q.httpStep1, q.httpStep2]

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

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <Button
          disabled={saving}
          onClick={() => {
            setMode('pubsub')
            setError('')
          }}
          size="sm"
          variant={mode === 'pubsub' ? 'secondary' : 'ghost'}
        >
          {q.modePubsub}
        </Button>
        <Button
          disabled={saving}
          onClick={() => {
            setMode('http')
            setError('')
          }}
          size="sm"
          variant={mode === 'http' ? 'secondary' : 'ghost'}
        >
          {q.modeHttp}
        </Button>
      </div>
      <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted-foreground">
        {mode === 'pubsub' ? q.pubsubModeHint : q.httpModeHint}
      </p>

      <div className="mt-3 space-y-4 text-xs leading-5 text-muted-foreground">
        <div>
          <span className="block">{q.saJsonHelp}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input
              aria-label={q.saJsonLabel}
              className="h-8 max-w-96 font-mono"
              disabled={saving}
              onChange={event => {
                setSaJson(event.target.value)
                setError('')
              }}
              placeholder="/path/to/service-account.json"
              value={saJson}
            />
            <Button onClick={() => openExternalLink(CLOUD_CONSOLE_URL)} size="sm" variant="secondary">
              {q.openConsole}
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
          <p className="mt-1.5 max-w-96 text-xs leading-5 text-muted-foreground">{q.saJsonHint}</p>
        </div>

        {mode === 'pubsub' ? (
          <>
            <div>
              <span className="block">{q.projectHelp}</span>
              <Input
                aria-label={q.projectLabel}
                className="mt-1.5 h-8 max-w-96 font-mono"
                disabled={saving}
                onChange={event => {
                  setProjectId(event.target.value)
                  setError('')
                }}
                placeholder="my-project-id"
                value={projectId}
              />
              {projectError && <p className="mt-1.5 text-xs leading-5 text-destructive">{projectError}</p>}
            </div>

            <div>
              <span className="block">{q.subscriptionHelp}</span>
              <Input
                aria-label={q.subscriptionLabel}
                className="mt-1.5 h-8 max-w-96 font-mono"
                disabled={saving}
                onChange={event => {
                  setSubscription(event.target.value)
                  setError('')
                }}
                placeholder="projects/my-project-id/subscriptions/work4you-chat"
                value={subscription}
              />
              {subscriptionError && <p className="mt-1.5 text-xs leading-5 text-destructive">{subscriptionError}</p>}
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="block">{q.eventsUrlHelp}</span>
              <Input
                aria-label={q.eventsUrlLabel}
                className="mt-1.5 h-8 max-w-96 font-mono"
                disabled={saving}
                onChange={event => {
                  setEventsUrl(event.target.value)
                  setError('')
                }}
                placeholder="https://your-domain.com/chat/events"
                value={eventsUrl}
              />
              {eventsUrlError && <p className="mt-1.5 text-xs leading-5 text-destructive">{eventsUrlError}</p>}
            </div>

            <div>
              <span className="block">{q.saEmailHelp}</span>
              <Input
                aria-label={q.saEmailLabel}
                className="mt-1.5 h-8 max-w-96 font-mono"
                disabled={saving}
                onChange={event => {
                  setSaEmail(event.target.value)
                  setError('')
                }}
                placeholder="work4you-chat@my-project-id.iam.gserviceaccount.com"
                value={saEmail}
              />
              {saEmailError && <p className="mt-1.5 text-xs leading-5 text-destructive">{saEmailError}</p>}
            </div>

            <div>
              <span className="block">{q.audienceHelp}</span>
              <Input
                aria-label={q.audienceLabel}
                className="mt-1.5 h-8 max-w-96 font-mono"
                disabled={saving}
                onChange={event => {
                  setAudience(event.target.value)
                  setError('')
                }}
                placeholder="https://your-domain.com/chat/events"
                value={audience}
              />
            </div>
          </>
        )}

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
            placeholder="you@yourcompany.com, teammate@yourcompany.com"
            value={allowedUsers}
          />
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.checklistTitle}</span>
          <ol className="mt-1.5 max-w-xl list-decimal space-y-1 pl-4">
            {checklist.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-2">
            <Button onClick={() => openExternalLink(CHAT_API_CONFIG_URL)} size="sm" variant="secondary">
              {q.openChatApi}
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
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
