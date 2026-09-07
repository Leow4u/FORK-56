import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Copy, ExternalLink, Save } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { runGatewayRestart } from '@/store/system-actions'
import type { MessagingEnvVarInfo } from '@/types/work4you'
import { updateMessagingPlatform } from '@/work4you'

import { validateMessagingEnv } from './validate-env'

const TEAMS_GUIDE_URL = 'https://work4you.ai/docs/user-guide/messaging/teams'
const AZURE_PORTAL_URL = 'https://portal.azure.com'
const TEAMS_WEBHOOK_PATH = '/api/messages'
const TEAMS_DEFAULT_PORT = '3978'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const ALL_INTERFACES = new Set(['0.0.0.0', '::', '*'])

function envValue(envVars: MessagingEnvVarInfo[], key: string): string {
  return envVars.find(field => field.key === key)?.value?.trim() || ''
}

function envIsSet(envVars: MessagingEnvVarInfo[], key: string): boolean {
  return Boolean(envVars.find(field => field.key === key)?.is_set)
}

/** The URL Azure registers as the bot messaging endpoint — public HTTPS origin
 *  wins, else the local bind (which Teams itself can never reach). */
export function teamsMessagingEndpoint(envVars: MessagingEnvVarInfo[]): string {
  const publicUrl = envValue(envVars, 'TEAMS_PUBLIC_URL').replace(/\/+$/, '')

  if (publicUrl) {
    return `${publicUrl}${TEAMS_WEBHOOK_PATH}`
  }

  const host = envValue(envVars, 'TEAMS_HOST') || '127.0.0.1'
  const port = envValue(envVars, 'TEAMS_PORT') || TEAMS_DEFAULT_PORT
  const displayHost = ALL_INTERFACES.has(host) ? '127.0.0.1' : host

  return `http://${displayHost}:${port}${TEAMS_WEBHOOK_PATH}`
}

/** True when a saved host is reachable from other machines. An unset host is
 *  treated as localhost here because save writes an explicit bind. */
export function teamsIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  const host = envValue(envVars, 'TEAMS_HOST').toLowerCase()

  return Boolean(host) && !LOOPBACK_HOSTS.has(host)
}

export function TeamsQuickSetup({
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
  const q = m.teamsQuickSetup

  const [clientId, setClientId] = useState(envValue(envVars, 'TEAMS_CLIENT_ID'))
  const [tenantId, setTenantId] = useState(envValue(envVars, 'TEAMS_TENANT_ID'))
  const [clientSecret, setClientSecret] = useState('')

  const [bindMode, setBindMode] = useState<'localhost' | 'remote'>(
    teamsIsNetworkExposed(envVars) ? 'remote' : 'localhost'
  )

  const [publicUrl, setPublicUrl] = useState(envValue(envVars, 'TEAMS_PUBLIC_URL'))
  const [allowedUsers, setAllowedUsers] = useState(envValue(envVars, 'TEAMS_ALLOWED_USERS'))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const guidError = (key: string, value: string) =>
    value.trim()
      ? (() => {
          const invalid = validateMessagingEnv(key, value)

          return invalid?.code === 'teamsGuid' ? m.envErrors.teamsGuid(invalid.value) : ''
        })()
      : ''

  const clientIdError = guidError('TEAMS_CLIENT_ID', clientId)
  const tenantIdError = guidError('TEAMS_TENANT_ID', tenantId)
  const allowedUsersError = guidError('TEAMS_ALLOWED_USERS', allowedUsers)

  const publicUrlError = publicUrl.trim()
    ? (() => {
        const invalid = validateMessagingEnv('TEAMS_PUBLIC_URL', publicUrl)

        return invalid?.code === 'teamsPublicUrl' ? m.envErrors.teamsPublicUrl(invalid.value) : ''
      })()
    : ''

  const previewVars: MessagingEnvVarInfo[] = [
    ...envVars.filter(
      field =>
        field.key !== 'TEAMS_PUBLIC_URL' && field.key !== 'TEAMS_HOST' && field.key !== 'TEAMS_PORT'
    ),
    {
      advanced: false,
      description: '',
      is_password: false,
      is_set: Boolean(publicUrl.trim()),
      key: 'TEAMS_PUBLIC_URL',
      prompt: 'TEAMS_PUBLIC_URL',
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
      key: 'TEAMS_HOST',
      prompt: 'TEAMS_HOST',
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
      key: 'TEAMS_PORT',
      prompt: 'TEAMS_PORT',
      redacted_value: null,
      required: false,
      url: null,
      value: envValue(envVars, 'TEAMS_PORT') || TEAMS_DEFAULT_PORT
    }
  ]

  const endpoint = teamsMessagingEndpoint(previewVars)
  const tunnelWarning = !publicUrl.trim()
  const openWarning = !allowedUsers.trim() && !envIsSet(envVars, 'TEAMS_ALLOWED_USERS')

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      notify({ kind: 'success', message: q.copied })
    } catch (copyError) {
      notifyError(copyError, q.copyFailed)
    }
  }

  async function saveBot() {
    const firstError = clientIdError || tenantIdError || allowedUsersError || publicUrlError

    if (firstError) {
      setError(firstError)

      return
    }

    if (!clientId.trim() || !tenantId.trim()) {
      setError(q.idsRequired)

      return
    }

    if (!clientSecret.trim() && !envIsSet(envVars, 'TEAMS_CLIENT_SECRET')) {
      setError(q.secretRequired)

      return
    }

    setSaving(true)
    setError('')

    try {
      const env: Record<string, string> = {
        TEAMS_CLIENT_ID: clientId.trim(),
        TEAMS_TENANT_ID: tenantId.trim(),
        TEAMS_HOST: bindMode === 'remote' ? '0.0.0.0' : '127.0.0.1'
      }

      if (clientSecret.trim()) {
        env.TEAMS_CLIENT_SECRET = clientSecret.trim()
      }

      if (publicUrl.trim()) {
        env.TEAMS_PUBLIC_URL = publicUrl.trim()
      }

      if (allowedUsers.trim()) {
        env.TEAMS_ALLOWED_USERS = allowedUsers.trim()
      }

      await updateMessagingPlatform('teams', { enabled: true, env }, scopeProfile)
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
          <span className="block">{q.credentialsHelp}</span>
          <div className="mt-1.5 grid max-w-xl gap-2">
            <label className="block">
              <span className="block">{q.clientIdLabel}</span>
              <Input
                aria-label={q.clientIdLabel}
                className="mt-1 h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setClientId(event.target.value)
                  setError('')
                }}
                placeholder={q.guidPlaceholder}
                value={clientId}
              />
            </label>
            {clientIdError && <p className="text-xs leading-5 text-destructive">{clientIdError}</p>}
            <label className="block">
              <span className="block">{q.tenantIdLabel}</span>
              <Input
                aria-label={q.tenantIdLabel}
                className="mt-1 h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setTenantId(event.target.value)
                  setError('')
                }}
                placeholder={q.guidPlaceholder}
                value={tenantId}
              />
            </label>
            {tenantIdError && <p className="text-xs leading-5 text-destructive">{tenantIdError}</p>}
            <label className="block">
              <span className="block">{q.clientSecretLabel}</span>
              <Input
                aria-label={q.clientSecretLabel}
                className="mt-1 h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setClientSecret(event.target.value)
                  setError('')
                }}
                placeholder={
                  envIsSet(envVars, 'TEAMS_CLIENT_SECRET') ? q.secretKeepPlaceholder : q.secretPlaceholder
                }
                type="password"
                value={clientSecret}
              />
            </label>
          </div>
          <p className="mt-1.5 max-w-xl">{q.secretWarning}</p>
          <div className="mt-2">
            <Button onClick={() => openExternalLink(AZURE_PORTAL_URL)} size="sm" variant="secondary">
              {q.openPortal}
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
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
          <p className="mt-1.5 max-w-xl">{q.bindHelp}</p>
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.endpointTitle}</span>
          <p className="mt-1 max-w-xl">{q.endpointHint}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{endpoint}</code>
            <Button onClick={() => void copyText(endpoint)} size="sm" variant="secondary">
              <Copy className="size-3.5" />
              {q.copyEndpoint}
            </Button>
          </div>
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
          {tunnelWarning && (
            <p className="mt-1.5 max-w-xl text-amber-600 dark:text-amber-500">{q.tunnelWarning}</p>
          )}
        </div>

        <div>
          <label className="block">
            <span className="block font-medium text-foreground/80">{q.allowedUsersLabel}</span>
            <Input
              aria-label={q.allowedUsersLabel}
              className="mt-1.5 h-8 max-w-xl font-mono"
              disabled={saving}
              onChange={event => {
                setAllowedUsers(event.target.value)
                setError('')
              }}
              placeholder={q.allowedUsersPlaceholder}
              value={allowedUsers}
            />
          </label>
          {allowedUsersError && <p className="mt-1.5 text-xs leading-5 text-destructive">{allowedUsersError}</p>}
          <p className="mt-1.5 max-w-xl">{q.allowedUsersHelp}</p>
          {openWarning && <p className="mt-1.5 max-w-xl text-amber-600 dark:text-amber-500">{q.openWarning}</p>}
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.pipelineTitle}</span>
          <p className="mt-1 max-w-xl">{q.pipelineHelp}</p>
        </div>
      </div>

      {error && <p className="mt-3 text-xs leading-5 text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => void saveBot()} size="sm">
          <Save />
          {saving ? m.saving : m.saveAndEnable}
        </Button>
        <Button onClick={() => openExternalLink(TEAMS_GUIDE_URL)} size="sm" variant="secondary">
          {q.openGuide}
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </section>
  )
}
