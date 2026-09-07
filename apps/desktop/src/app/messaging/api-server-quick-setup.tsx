import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Copy, ExternalLink, RefreshCw, Save } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { runGatewayRestart } from '@/store/system-actions'
import type { MessagingEnvVarInfo } from '@/types/work4you'
import { updateMessagingPlatform } from '@/work4you'

import { validateMessagingEnv } from './validate-env'

const OPEN_WEBUI_GUIDE_URL = 'https://work4you.ai/docs/user-guide/messaging/open-webui'

const LOOPBACK_HOSTS = new Set(['', '127.0.0.1', 'localhost', '::1'])

/** 32-char URL-safe random key (24 bytes, base64url) — comfortably above the
 *  adapter's 16-char startup guard and free of padding/quoting hazards. */
export function generateApiServerKey(): string {
  const bytes = new Uint8Array(24)

  crypto.getRandomValues(bytes)

  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

/** Base URL an OpenAI-compatible client should point at, from the saved
 *  (non-secret) env values with the adapter's defaults filled in. */
export function apiServerBaseUrl(envVars: MessagingEnvVarInfo[]): string {
  const value = (key: string) => envVars.find(field => field.key === key)?.value?.trim() || ''
  const host = value('API_SERVER_HOST') || '127.0.0.1'
  const port = value('API_SERVER_PORT') || '8642'
  const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host

  return `http://${displayHost}:${port}/v1`
}

/** True when the saved bind address makes the listener reachable from other
 *  machines — the key then guards terminal-capable access over the network. */
export function apiServerIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  const host = (envVars.find(field => field.key === 'API_SERVER_HOST')?.value || '').trim().toLowerCase()

  return !LOOPBACK_HOSTS.has(host)
}

/** Connection-card onboarding for the OpenAI-compatible API server. This
 *  channel is the inverse of the messaging ones: Work4You EMITS the credential
 *  and address the user must copy into Open WebUI / LobeChat / their own
 *  chat frontend. The card generates a strong key (the adapter refuses to
 *  start on anything under 16 chars — previously that refusal was a silent
 *  log line), saves + enables in one step, and then shows the copyable base
 *  URL and model name the external tool needs. */
export function ApiServerQuickSetup({
  configured,
  envVars,
  onApplied,
  scopeProfile
}: {
  configured: boolean
  envVars: MessagingEnvVarInfo[]
  onApplied: () => void
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.apiServerQuickSetup

  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const invalid = key.trim() ? validateMessagingEnv('API_SERVER_KEY', key) : null
  const keyError = invalid?.code === 'apiServerKey' ? m.envErrors.apiServerKey : ''

  const baseUrl = apiServerBaseUrl(envVars)
  const modelName = envVars.find(field => field.key === 'API_SERVER_MODEL_NAME')?.value?.trim() || 'work4you'
  const networkExposed = apiServerIsNetworkExposed(envVars)

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      notify({ kind: 'success', message: q.copied })
    } catch (copyError) {
      notifyError(copyError, q.copyFailed)
    }
  }

  async function save() {
    if (!key.trim()) {
      setError(q.keyRequired)

      return
    }

    if (keyError) {
      setError(keyError)

      return
    }

    setSaving(true)
    setError('')

    try {
      await updateMessagingPlatform('api_server', { enabled: true, env: { API_SERVER_KEY: key.trim() } }, scopeProfile)
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
          <span className="block">{q.keyHelp}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input
              aria-label={q.keyLabel}
              className="h-8 max-w-96 font-mono"
              disabled={saving}
              onChange={event => {
                setKey(event.target.value)
                setError('')
              }}
              placeholder={q.keyPlaceholder}
              value={key}
            />
            <Button
              disabled={saving}
              onClick={() => {
                setKey(generateApiServerKey())
                setError('')
              }}
              size="sm"
              variant="secondary"
            >
              <RefreshCw className="size-3.5" />
              {q.generateKey}
            </Button>
          </div>
          {keyError && <p className="mt-1.5 text-xs leading-5 text-destructive">{keyError}</p>}
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted-foreground">{q.keyWarning}</p>
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.connectionTitle}</span>
          <p className="mt-1 max-w-xl">{q.connectionHint}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{baseUrl}</code>
            <Button onClick={() => void copyText(baseUrl)} size="sm" variant="secondary">
              <Copy className="size-3.5" />
              {q.copyBaseUrl}
            </Button>
          </div>
          <p className="mt-1.5">{q.modelHint(modelName)}</p>
          {networkExposed && (
            <p className="mt-1.5 max-w-xl text-amber-600 dark:text-amber-500">{q.networkExposedWarning}</p>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs leading-5 text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => void save()} size="sm">
          <Save />
          {saving ? m.saving : m.saveAndEnable}
        </Button>
        <Button onClick={() => openExternalLink(OPEN_WEBUI_GUIDE_URL)} size="sm" variant="secondary">
          {q.openGuide}
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </section>
  )
}
