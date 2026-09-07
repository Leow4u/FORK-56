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

import { type MessagingEnvError, validateMessagingEnv } from './validate-env'

const WHATSAPP_CLOUD_GUIDE_URL = 'https://work4you.ai/docs/user-guide/messaging/whatsapp-cloud'
const META_APPS_URL = 'https://developers.facebook.com/apps'
const WHATSAPP_CLOUD_DEFAULT_PATH = '/whatsapp/webhook'
const WHATSAPP_CLOUD_DEFAULT_PORT = '8090'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const ALL_INTERFACES = new Set(['0.0.0.0', '::', '*'])

function envValue(envVars: MessagingEnvVarInfo[], key: string): string {
  return envVars.find(field => field.key === key)?.value?.trim() || ''
}

function envIsSet(envVars: MessagingEnvVarInfo[], key: string): boolean {
  return Boolean(envVars.find(field => field.key === key)?.is_set)
}

/** The webhook path Meta POSTs to — the saved override, else the adapter default. */
export function whatsappCloudWebhookPath(envVars: MessagingEnvVarInfo[]): string {
  const raw = envValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_PATH') || WHATSAPP_CLOUD_DEFAULT_PATH

  return raw.startsWith('/') ? raw : `/${raw}`
}

/** The callback URL to paste into Meta's webhook dialog — public HTTPS origin
 *  wins, else the local bind (which Meta itself can never reach). */
export function whatsappCloudCallbackUrl(envVars: MessagingEnvVarInfo[]): string {
  const publicUrl = envValue(envVars, 'WHATSAPP_CLOUD_PUBLIC_URL').replace(/\/+$/, '')
  const path = whatsappCloudWebhookPath(envVars)

  if (publicUrl) {
    return `${publicUrl}${path}`
  }

  const host = envValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_HOST') || '127.0.0.1'
  const port = envValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_PORT') || WHATSAPP_CLOUD_DEFAULT_PORT
  const displayHost = ALL_INTERFACES.has(host) ? '127.0.0.1' : host

  return `http://${displayHost}:${port}${path}`
}

/** True when a saved host is reachable from other machines. An unset host is
 *  treated as localhost here because save writes an explicit bind. */
export function whatsappCloudIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  const host = envValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_HOST').toLowerCase()

  return Boolean(host) && !LOOPBACK_HOSTS.has(host)
}

/** 32 random bytes as hex — the same shape `work4you whatsapp-cloud` writes
 *  for an auto-generated verify token. */
export function generateWhatsappCloudVerifyToken(): string {
  const bytes = new Uint8Array(32)

  crypto.getRandomValues(bytes)

  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function WhatsAppCloudQuickSetup({
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
  const q = m.whatsappCloudQuickSetup

  const [phoneNumberId, setPhoneNumberId] = useState(envValue(envVars, 'WHATSAPP_CLOUD_PHONE_NUMBER_ID'))
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [verifyToken, setVerifyToken] = useState('')

  const [bindMode, setBindMode] = useState<'localhost' | 'remote'>(
    whatsappCloudIsNetworkExposed(envVars) ? 'remote' : 'localhost'
  )

  const [publicUrl, setPublicUrl] = useState(envValue(envVars, 'WHATSAPP_CLOUD_PUBLIC_URL'))
  const [allowedUsers, setAllowedUsers] = useState(envValue(envVars, 'WHATSAPP_CLOUD_ALLOWED_USERS'))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const messageFor = (invalid: MessagingEnvError | null): string => {
    switch (invalid?.code) {
      case 'whatsappCloudAccessToken':
        return m.envErrors.whatsappCloudAccessToken

      case 'whatsappCloudAppSecret':
        return m.envErrors.whatsappCloudAppSecret

      case 'whatsappCloudPhoneNumberId':
        return m.envErrors.whatsappCloudPhoneNumberId(invalid.value)

      case 'whatsappCloudPhoneNumberPasted':
        return m.envErrors.whatsappCloudPhoneNumberPasted

      case 'whatsappCloudPublicUrl':
        return m.envErrors.whatsappCloudPublicUrl(invalid.value)

      case 'whatsappCloudVerifyToken':
        return m.envErrors.whatsappCloudVerifyToken

      case 'whatsappNumber':
        return m.envErrors.whatsappNumber(invalid.value)

      default:
        return ''
    }
  }

  const fieldError = (key: string, value: string) => (value.trim() ? messageFor(validateMessagingEnv(key, value)) : '')

  const phoneNumberIdError = fieldError('WHATSAPP_CLOUD_PHONE_NUMBER_ID', phoneNumberId)
  const accessTokenError = fieldError('WHATSAPP_CLOUD_ACCESS_TOKEN', accessToken)
  const appSecretError = fieldError('WHATSAPP_CLOUD_APP_SECRET', appSecret)
  const verifyTokenError = fieldError('WHATSAPP_CLOUD_VERIFY_TOKEN', verifyToken)
  const publicUrlError = fieldError('WHATSAPP_CLOUD_PUBLIC_URL', publicUrl)
  const allowedUsersError = fieldError('WHATSAPP_CLOUD_ALLOWED_USERS', allowedUsers)

  const previewVars: MessagingEnvVarInfo[] = [
    ...envVars.filter(
      field =>
        field.key !== 'WHATSAPP_CLOUD_PUBLIC_URL' &&
        field.key !== 'WHATSAPP_CLOUD_WEBHOOK_HOST' &&
        field.key !== 'WHATSAPP_CLOUD_WEBHOOK_PORT'
    ),
    {
      advanced: false,
      description: '',
      is_password: false,
      is_set: Boolean(publicUrl.trim()),
      key: 'WHATSAPP_CLOUD_PUBLIC_URL',
      prompt: 'WHATSAPP_CLOUD_PUBLIC_URL',
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
      key: 'WHATSAPP_CLOUD_WEBHOOK_HOST',
      prompt: 'WHATSAPP_CLOUD_WEBHOOK_HOST',
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
      key: 'WHATSAPP_CLOUD_WEBHOOK_PORT',
      prompt: 'WHATSAPP_CLOUD_WEBHOOK_PORT',
      redacted_value: null,
      required: false,
      url: null,
      value: envValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_PORT') || WHATSAPP_CLOUD_DEFAULT_PORT
    }
  ]

  const callbackUrl = whatsappCloudCallbackUrl(previewVars)
  const tunnelWarning = !publicUrl.trim()
  const verifyTokenSaved = envIsSet(envVars, 'WHATSAPP_CLOUD_VERIFY_TOKEN')
  const openWarning = !allowedUsers.trim() && !envIsSet(envVars, 'WHATSAPP_CLOUD_ALLOWED_USERS')

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      notify({ kind: 'success', message: q.copied })
    } catch (copyError) {
      notifyError(copyError, q.copyFailed)
    }
  }

  async function saveNumber() {
    const firstError =
      phoneNumberIdError ||
      accessTokenError ||
      appSecretError ||
      verifyTokenError ||
      publicUrlError ||
      allowedUsersError

    if (firstError) {
      setError(firstError)

      return
    }

    if (!phoneNumberId.trim()) {
      setError(q.phoneNumberIdRequired)

      return
    }

    if (!accessToken.trim() && !envIsSet(envVars, 'WHATSAPP_CLOUD_ACCESS_TOKEN')) {
      setError(q.accessTokenRequired)

      return
    }

    if (!appSecret.trim() && !envIsSet(envVars, 'WHATSAPP_CLOUD_APP_SECRET')) {
      setError(q.appSecretRequired)

      return
    }

    if (!verifyToken.trim() && !verifyTokenSaved) {
      setError(q.verifyTokenRequired)

      return
    }

    setSaving(true)
    setError('')

    try {
      const env: Record<string, string> = {
        WHATSAPP_CLOUD_PHONE_NUMBER_ID: phoneNumberId.trim(),
        WHATSAPP_CLOUD_WEBHOOK_HOST: bindMode === 'remote' ? '0.0.0.0' : '127.0.0.1'
      }

      if (accessToken.trim()) {
        env.WHATSAPP_CLOUD_ACCESS_TOKEN = accessToken.trim()
      }

      if (appSecret.trim()) {
        env.WHATSAPP_CLOUD_APP_SECRET = appSecret.trim()
      }

      if (verifyToken.trim()) {
        env.WHATSAPP_CLOUD_VERIFY_TOKEN = verifyToken.trim()
      }

      if (publicUrl.trim()) {
        env.WHATSAPP_CLOUD_PUBLIC_URL = publicUrl.trim()
      }

      if (allowedUsers.trim()) {
        env.WHATSAPP_CLOUD_ALLOWED_USERS = allowedUsers.trim()
      }

      await updateMessagingPlatform('whatsapp_cloud', { enabled: true, env }, scopeProfile)
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
              <span className="block">{q.phoneNumberIdLabel}</span>
              <Input
                aria-label={q.phoneNumberIdLabel}
                className="mt-1 h-8 font-mono"
                disabled={saving}
                inputMode="numeric"
                onChange={event => {
                  setPhoneNumberId(event.target.value)
                  setError('')
                }}
                placeholder={q.phoneNumberIdPlaceholder}
                value={phoneNumberId}
              />
            </label>
            {phoneNumberIdError && <p className="text-xs leading-5 text-destructive">{phoneNumberIdError}</p>}
            <p>{q.phoneNumberIdHelp}</p>
            <label className="block">
              <span className="block">{q.accessTokenLabel}</span>
              <Input
                aria-label={q.accessTokenLabel}
                className="mt-1 h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setAccessToken(event.target.value)
                  setError('')
                }}
                placeholder={
                  envIsSet(envVars, 'WHATSAPP_CLOUD_ACCESS_TOKEN') ? q.secretKeepPlaceholder : q.accessTokenPlaceholder
                }
                type="password"
                value={accessToken}
              />
            </label>
            {accessTokenError && <p className="text-xs leading-5 text-destructive">{accessTokenError}</p>}
            <p>{q.accessTokenHelp}</p>
            <label className="block">
              <span className="block">{q.appSecretLabel}</span>
              <Input
                aria-label={q.appSecretLabel}
                className="mt-1 h-8 font-mono"
                disabled={saving}
                onChange={event => {
                  setAppSecret(event.target.value)
                  setError('')
                }}
                placeholder={
                  envIsSet(envVars, 'WHATSAPP_CLOUD_APP_SECRET') ? q.secretKeepPlaceholder : q.appSecretPlaceholder
                }
                type="password"
                value={appSecret}
              />
            </label>
            {appSecretError && <p className="text-xs leading-5 text-destructive">{appSecretError}</p>}
            <p>{q.appSecretHelp}</p>
          </div>
          <div className="mt-2">
            <Button onClick={() => openExternalLink(META_APPS_URL)} size="sm" variant="secondary">
              {q.openMeta}
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.verifyTokenLabel}</span>
          <p className="mt-1 max-w-xl">{q.verifyTokenHelp}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input
              aria-label={q.verifyTokenLabel}
              className="h-8 max-w-96 font-mono"
              disabled={saving}
              onChange={event => {
                setVerifyToken(event.target.value)
                setError('')
              }}
              placeholder={verifyTokenSaved ? q.secretKeepPlaceholder : q.verifyTokenPlaceholder}
              value={verifyToken}
            />
            <Button
              disabled={saving}
              onClick={() => {
                setVerifyToken(generateWhatsappCloudVerifyToken())
                setError('')
              }}
              size="sm"
              variant="secondary"
            >
              <RefreshCw className="size-3.5" />
              {q.generateVerifyToken}
            </Button>
            {verifyToken.trim() && (
              <Button onClick={() => void copyText(verifyToken.trim())} size="sm" variant="secondary">
                <Copy className="size-3.5" />
                {q.copyVerifyToken}
              </Button>
            )}
          </div>
          {verifyTokenError && <p className="mt-1.5 text-xs leading-5 text-destructive">{verifyTokenError}</p>}
          {verifyTokenSaved && !verifyToken.trim() && <p className="mt-1.5 max-w-xl">{q.verifyTokenSavedHint}</p>}
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
          <span className="block font-medium text-foreground/80">{q.callbackTitle}</span>
          <p className="mt-1 max-w-xl">{q.callbackHint}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{callbackUrl}</code>
            <Button onClick={() => void copyText(callbackUrl)} size="sm" variant="secondary">
              <Copy className="size-3.5" />
              {q.copyCallback}
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
          {tunnelWarning && <p className="mt-1.5 max-w-xl text-amber-600 dark:text-amber-500">{q.tunnelWarning}</p>}
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
          <span className="block font-medium text-foreground/80">{q.afterSaveTitle}</span>
          <p className="mt-1 max-w-xl">{q.afterSaveHelp}</p>
        </div>
      </div>

      {error && <p className="mt-3 text-xs leading-5 text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => void saveNumber()} size="sm">
          <Save />
          {saving ? m.saving : m.saveAndEnable}
        </Button>
        <Button onClick={() => openExternalLink(WHATSAPP_CLOUD_GUIDE_URL)} size="sm" variant="secondary">
          {q.openGuide}
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </section>
  )
}
