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

const MSGRAPH_GUIDE_URL = 'https://work4you.ai/docs/user-guide/messaging/msgraph-webhook'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const ALL_INTERFACES = new Set(['0.0.0.0', '::', '*'])

function envValue(envVars: MessagingEnvVarInfo[], key: string): string {
  return envVars.find(field => field.key === key)?.value?.trim() || ''
}

function envIsSet(envVars: MessagingEnvVarInfo[], key: string): boolean {
  return Boolean(envVars.find(field => field.key === key)?.is_set)
}

/** Notification URL Graph registers — public HTTPS origin wins, else the local bind. */
export function msgraphNotificationUrl(envVars: MessagingEnvVarInfo[]): string {
  const publicUrl = envValue(envVars, 'MSGRAPH_WEBHOOK_PUBLIC_URL').replace(/\/+$/, '')

  if (publicUrl) {
    return `${publicUrl}/msgraph/webhook`
  }

  const host = envValue(envVars, 'MSGRAPH_WEBHOOK_HOST') || '127.0.0.1'
  const port = envValue(envVars, 'MSGRAPH_WEBHOOK_PORT') || '8646'
  const displayHost = ALL_INTERFACES.has(host) ? '127.0.0.1' : host

  return `http://${displayHost}:${port}/msgraph/webhook`
}

/** True when a saved host is reachable from other machines. Unset host stays
 *  localhost in this panel (save writes 127.0.0.1 so the adapter does not
 *  default to all-interfaces). */
export function msgraphIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  const host = envValue(envVars, 'MSGRAPH_WEBHOOK_HOST').toLowerCase()

  return Boolean(host) && !LOOPBACK_HOSTS.has(host)
}

export function msgraphIsLocalhostOnly(envVars: MessagingEnvVarInfo[]): boolean {
  return !msgraphIsNetworkExposed(envVars)
}

export function msgraphHasCidrs(envVars: MessagingEnvVarInfo[]): boolean {
  return envIsSet(envVars, 'MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS')
}

/** 32 random bytes as hex — same shape as `openssl rand -hex 32`. */
export function generateMsgraphClientState(): string {
  const bytes = new Uint8Array(32)

  crypto.getRandomValues(bytes)

  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function MsgraphWebhookQuickSetup({
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
  const q = m.msgraphQuickSetup

  const [secret, setSecret] = useState('')
  const [bindMode, setBindMode] = useState<'localhost' | 'remote'>(
    msgraphIsNetworkExposed(envVars) ? 'remote' : 'localhost'
  )
  const [publicUrl, setPublicUrl] = useState(envValue(envVars, 'MSGRAPH_WEBHOOK_PUBLIC_URL'))
  const [resources, setResources] = useState(envValue(envVars, 'MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES'))
  const [cidrs, setCidrs] = useState(envValue(envVars, 'MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS'))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const secretError = secret.trim()
    ? validateMessagingEnv('MSGRAPH_WEBHOOK_CLIENT_STATE', secret)?.code === 'msgraphClientState'
      ? m.envErrors.msgraphClientState
      : ''
    : ''

  const publicUrlError = publicUrl.trim()
    ? (() => {
        const invalid = validateMessagingEnv('MSGRAPH_WEBHOOK_PUBLIC_URL', publicUrl)

        return invalid?.code === 'msgraphPublicUrl' ? m.envErrors.msgraphPublicUrl(invalid.value) : ''
      })()
    : ''

  const cidrError = cidrs.trim()
    ? (() => {
        const invalid = validateMessagingEnv('MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS', cidrs)

        return invalid?.code === 'msgraphCidr' ? m.envErrors.msgraphCidr(invalid.value) : ''
      })()
    : ''

  const previewVars: MessagingEnvVarInfo[] = [
    ...envVars.filter(
      field =>
        field.key !== 'MSGRAPH_WEBHOOK_PUBLIC_URL' &&
        field.key !== 'MSGRAPH_WEBHOOK_HOST' &&
        field.key !== 'MSGRAPH_WEBHOOK_PORT'
    ),
    {
      advanced: false,
      description: '',
      is_password: false,
      is_set: Boolean(publicUrl.trim()),
      key: 'MSGRAPH_WEBHOOK_PUBLIC_URL',
      prompt: 'MSGRAPH_WEBHOOK_PUBLIC_URL',
      redacted_value: null,
      required: false,
      url: null,
      value: publicUrl.trim() || null
    },
    {
      advanced: false,
      description: '',
      is_password: false,
      is_set: true,
      key: 'MSGRAPH_WEBHOOK_HOST',
      prompt: 'MSGRAPH_WEBHOOK_HOST',
      redacted_value: null,
      required: false,
      url: null,
      value: bindMode === 'remote' ? '0.0.0.0' : '127.0.0.1'
    },
    {
      advanced: false,
      description: '',
      is_password: false,
      is_set: true,
      key: 'MSGRAPH_WEBHOOK_PORT',
      prompt: 'MSGRAPH_WEBHOOK_PORT',
      redacted_value: null,
      required: false,
      url: null,
      value: envValue(envVars, 'MSGRAPH_WEBHOOK_PORT') || '8646'
    }
  ]

  const notifyUrl = msgraphNotificationUrl(previewVars)
  const networkWarning = bindMode === 'remote' && !cidrs.trim() && !msgraphHasCidrs(envVars)

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      notify({ kind: 'success', message: q.copied })
    } catch (copyError) {
      notifyError(copyError, q.copyFailed)
    }
  }

  async function saveInbound() {
    if (secretError) {
      setError(secretError)

      return
    }

    if (publicUrlError) {
      setError(publicUrlError)

      return
    }

    if (cidrError) {
      setError(cidrError)

      return
    }

    if (!secret.trim() && !envIsSet(envVars, 'MSGRAPH_WEBHOOK_CLIENT_STATE')) {
      setError(q.secretRequired)

      return
    }

    if (bindMode === 'remote' && !cidrs.trim() && !msgraphHasCidrs(envVars)) {
      setError(q.remoteNeedsCidrs)

      return
    }

    setSaving(true)
    setError('')

    try {
      const env: Record<string, string> = {
        MSGRAPH_WEBHOOK_HOST: bindMode === 'remote' ? '0.0.0.0' : '127.0.0.1'
      }

      if (secret.trim()) {
        env.MSGRAPH_WEBHOOK_CLIENT_STATE = secret.trim()
      }

      if (publicUrl.trim()) {
        env.MSGRAPH_WEBHOOK_PUBLIC_URL = publicUrl.trim()
      }

      if (resources.trim()) {
        env.MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES = resources.trim()
      }

      if (cidrs.trim()) {
        env.MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS = cidrs.trim()
      }

      await updateMessagingPlatform('msgraph_webhook', { enabled: true, env }, scopeProfile)
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

      <div className="mt-4 space-y-5 text-xs leading-5 text-muted-foreground">
        <div>
          <span className="block">{q.secretHelp}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input
              aria-label={q.secretLabel}
              className="h-8 max-w-96 font-mono"
              disabled={saving}
              onChange={event => {
                setSecret(event.target.value)
                setError('')
              }}
              placeholder={q.secretPlaceholder}
              value={secret}
            />
            <Button
              disabled={saving}
              onClick={() => {
                setSecret(generateMsgraphClientState())
                setError('')
              }}
              size="sm"
              variant="secondary"
            >
              <RefreshCw className="size-3.5" />
              {q.generateSecret}
            </Button>
            {secret.trim() && (
              <Button onClick={() => void copyText(secret.trim())} size="sm" variant="secondary">
                <Copy className="size-3.5" />
                {q.copySecret}
              </Button>
            )}
          </div>
          {secretError && <p className="mt-1.5 text-xs leading-5 text-destructive">{secretError}</p>}
          <p className="mt-1.5 max-w-xl">{q.secretWarning}</p>
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.bindLabel}</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                setBindMode('localhost')
                setError('')
              }}
              size="sm"
              variant={bindMode === 'localhost' ? 'default' : 'secondary'}
            >
              {q.bindLocalhost}
            </Button>
            <Button
              onClick={() => {
                setBindMode('remote')
                setError('')
              }}
              size="sm"
              variant={bindMode === 'remote' ? 'default' : 'secondary'}
            >
              {q.bindRemote}
            </Button>
          </div>
          {networkWarning && (
            <p className="mt-1.5 max-w-xl text-amber-600 dark:text-amber-500">{q.networkExposedWarning}</p>
          )}
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.notificationTitle}</span>
          <p className="mt-1 max-w-xl">{q.notificationHint}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{notifyUrl}</code>
            <Button onClick={() => void copyText(notifyUrl)} size="sm" variant="secondary">
              <Copy className="size-3.5" />
              {q.copyNotificationUrl}
            </Button>
          </div>
          <p className="mt-1.5 max-w-xl">{q.handshakeHint}</p>
          <label className="mt-2 block">
            <span className="block">{q.publicUrlLabel}</span>
            <Input
              aria-label={q.publicUrlLabel}
              className="mt-1.5 h-8 max-w-96 font-mono"
              disabled={saving}
              onChange={event => {
                setPublicUrl(event.target.value)
                setError('')
              }}
              placeholder={q.publicUrlPlaceholder}
              value={publicUrl}
            />
          </label>
          {publicUrlError && <p className="mt-1.5 text-xs leading-5 text-destructive">{publicUrlError}</p>}
          <p className="mt-1.5 max-w-xl">{q.publicUrlHelp}</p>
        </div>

        <div>
          <label className="block">
            <span className="block font-medium text-foreground/80">{q.resourcesLabel}</span>
            <Input
              aria-label={q.resourcesLabel}
              className="mt-1.5 h-8 max-w-xl font-mono"
              disabled={saving}
              onChange={event => setResources(event.target.value)}
              placeholder={q.resourcesPlaceholder}
              value={resources}
            />
          </label>
          <p className="mt-1.5 max-w-xl">{q.resourcesHelp}</p>
        </div>

        <div>
          <label className="block">
            <span className="block font-medium text-foreground/80">{q.cidrsLabel}</span>
            <Input
              aria-label={q.cidrsLabel}
              className="mt-1.5 h-8 max-w-xl font-mono"
              disabled={saving}
              onChange={event => {
                setCidrs(event.target.value)
                setError('')
              }}
              placeholder={q.cidrsPlaceholder}
              value={cidrs}
            />
          </label>
          {cidrError && <p className="mt-1.5 text-xs leading-5 text-destructive">{cidrError}</p>}
          <p className="mt-1.5 max-w-xl">{q.cidrsHelp}</p>
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.pipelineTitle}</span>
          <p className="mt-1 max-w-xl">{q.pipelineHelp}</p>
        </div>
      </div>

      {error && <p className="mt-3 text-xs leading-5 text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => void saveInbound()} size="sm">
          <Save />
          {saving ? m.saving : m.saveAndEnable}
        </Button>
        <Button onClick={() => openExternalLink(MSGRAPH_GUIDE_URL)} size="sm" variant="secondary">
          {q.openGuide}
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </section>
  )
}
