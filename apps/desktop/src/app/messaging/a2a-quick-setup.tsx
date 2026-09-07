import { useStore } from '@nanostores/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Copy, ExternalLink, Plus, RefreshCw, Save, Trash2 } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { $profileScope } from '@/store/profile'
import { runGatewayRestart } from '@/store/system-actions'
import type { MessagingEnvVarInfo } from '@/types/work4you'
import {
  createA2AAgent,
  deleteA2AAgent,
  getA2AAgents,
  getToolsets,
  setToolsetEnabled,
  updateMessagingPlatform
} from '@/work4you'

import { generateApiServerKey } from './api-server-quick-setup'
import { validateMessagingEnv } from './validate-env'

const A2A_GUIDE_URL = 'https://work4you.ai/docs/user-guide/messaging/a2a'
const LOOPBACK_HOSTS = new Set(['', '127.0.0.1', 'localhost', '::1'])

function envValue(envVars: MessagingEnvVarInfo[], key: string): string {
  return envVars.find(field => field.key === key)?.value?.trim() || ''
}

function envIsSet(envVars: MessagingEnvVarInfo[], key: string): boolean {
  return Boolean(envVars.find(field => field.key === key)?.is_set)
}

/** Agent Card URL peers fetch — public URL wins, else the local bind. */
export function a2aCardUrl(envVars: MessagingEnvVarInfo[]): string {
  const publicUrl = envValue(envVars, 'A2A_PUBLIC_URL').replace(/\/+$/, '')

  if (publicUrl) {
    return `${publicUrl}/.well-known/agent-card.json`
  }

  const host = envValue(envVars, 'A2A_HOST') || '127.0.0.1'
  const port = envValue(envVars, 'A2A_PORT') || '9900'
  const displayHost = host === '0.0.0.0' || host === '::' || host === '*' ? '127.0.0.1' : host

  return `http://${displayHost}:${port}/.well-known/agent-card.json`
}

/** True when a saved token exists so a non-loopback bind is honored. */
export function a2aHasInboundToken(envVars: MessagingEnvVarInfo[]): boolean {
  return envIsSet(envVars, 'A2A_BEARER_TOKEN') || envIsSet(envVars, 'A2A_PEER_TOKENS')
}

/** True when the saved host is reachable from other machines. */
export function a2aIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  return !LOOPBACK_HOSTS.has(envValue(envVars, 'A2A_HOST').toLowerCase())
}

/** True when the adapter will stay on loopback (no token, or a loopback host). */
export function a2aIsLocalhostOnly(envVars: MessagingEnvVarInfo[]): boolean {
  return !a2aHasInboundToken(envVars) || !a2aIsNetworkExposed(envVars)
}

export function generateA2AToken(): string {
  return generateApiServerKey()
}

export function A2AQuickSetup({
  configured,
  enabled,
  envVars,
  onApplied,
  scopeProfile
}: {
  configured: boolean
  enabled: boolean
  envVars: MessagingEnvVarInfo[]
  onApplied: () => void
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.a2aQuickSetup
  const profileScope = useStore($profileScope)
  const queryClient = useQueryClient()

  const [token, setToken] = useState('')
  const [bindMode, setBindMode] = useState<'localhost' | 'remote'>(
    a2aIsNetworkExposed(envVars) && a2aHasInboundToken(envVars) ? 'remote' : 'localhost'
  )
  const [publicUrl, setPublicUrl] = useState(envValue(envVars, 'A2A_PUBLIC_URL'))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [peerName, setPeerName] = useState('')
  const [peerUrl, setPeerUrl] = useState('')
  const [peerToken, setPeerToken] = useState('')
  const [peerCaps, setPeerCaps] = useState('')
  const [addingPeer, setAddingPeer] = useState(false)
  const [enablingOutbound, setEnablingOutbound] = useState(false)

  const tokenError = token.trim()
    ? validateMessagingEnv('A2A_BEARER_TOKEN', token)?.code === 'apiServerKey'
      ? m.envErrors.apiServerKey
      : ''
    : ''
  const publicUrlError = publicUrl.trim()
    ? (() => {
        const invalid = validateMessagingEnv('A2A_PUBLIC_URL', publicUrl)

        return invalid?.code === 'a2aPublicUrl' ? m.envErrors.a2aPublicUrl(invalid.value) : ''
      })()
    : ''

  const cardUrl = a2aCardUrl([
    ...envVars.filter(field => field.key !== 'A2A_PUBLIC_URL' && field.key !== 'A2A_HOST'),
    {
      advanced: false,
      description: '',
      is_password: false,
      is_set: Boolean(publicUrl.trim()),
      key: 'A2A_PUBLIC_URL',
      prompt: 'A2A_PUBLIC_URL',
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
      key: 'A2A_HOST',
      prompt: 'A2A_HOST',
      redacted_value: null,
      required: false,
      url: null,
      value: bindMode === 'remote' ? '0.0.0.0' : '127.0.0.1'
    }
  ])
  const networkWarning = bindMode === 'remote' && !token.trim() && !a2aHasInboundToken(envVars)

  const agentsQuery = useQuery({
    queryKey: ['a2a-agents', scopeProfile ?? profileScope],
    queryFn: () => getA2AAgents(scopeProfile)
  })
  const toolsetsQuery = useQuery({
    queryKey: ['toolsets', scopeProfile ?? profileScope],
    queryFn: () => getToolsets(scopeProfile)
  })

  const agents = agentsQuery.data?.agents ?? []
  const outboundOn = useMemo(
    () => toolsetsQuery.data?.some(toolset => toolset.name === 'a2a' && toolset.enabled) ?? false,
    [toolsetsQuery.data]
  )

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      notify({ kind: 'success', message: q.copied })
    } catch (copyError) {
      notifyError(copyError, q.copyFailed)
    }
  }

  async function saveInbound() {
    if (tokenError) {
      setError(tokenError)

      return
    }

    if (publicUrlError) {
      setError(publicUrlError)

      return
    }

    if (bindMode === 'remote' && !token.trim() && !a2aHasInboundToken(envVars)) {
      setError(q.remoteNeedsToken)

      return
    }

    setSaving(true)
    setError('')

    try {
      const env: Record<string, string> = {
        A2A_HOST: bindMode === 'remote' ? '0.0.0.0' : '127.0.0.1'
      }

      if (token.trim()) {
        env.A2A_BEARER_TOKEN = token.trim()
      }

      if (publicUrl.trim()) {
        env.A2A_PUBLIC_URL = publicUrl.trim()
      }

      await updateMessagingPlatform('a2a', { enabled: true, env }, scopeProfile)
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

  async function addPeer() {
    const name = peerName.trim()
    const url = peerUrl.trim()

    if (!name || !url) {
      setError(q.nameRequired)

      return
    }

    const urlInvalid = validateMessagingEnv('A2A_PUBLIC_URL', url)

    if (urlInvalid?.code === 'a2aPublicUrl') {
      setError(m.envErrors.a2aPublicUrl(urlInvalid.value))

      return
    }

    setAddingPeer(true)
    setError('')

    try {
      const capabilities = peerCaps
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)

      await createA2AAgent(
        {
          name,
          url,
          ...(peerToken.trim() ? { token: peerToken.trim() } : {}),
          ...(capabilities.length ? { capabilities } : {})
        },
        scopeProfile
      )
      setPeerName('')
      setPeerUrl('')
      setPeerToken('')
      setPeerCaps('')
      notify({ kind: 'success', message: q.peerAdded })
      await queryClient.invalidateQueries({ queryKey: ['a2a-agents'] })
    } catch (addError) {
      notifyError(addError, q.peerAddFailed)
    } finally {
      setAddingPeer(false)
    }
  }

  async function removePeer(name: string) {
    try {
      await deleteA2AAgent(name, scopeProfile)
      notify({ kind: 'success', message: q.peerDeleted })
      await queryClient.invalidateQueries({ queryKey: ['a2a-agents'] })
    } catch (deleteError) {
      notifyError(deleteError, q.peerDeleteFailed)
    }
  }

  async function enableOutbound() {
    setEnablingOutbound(true)

    try {
      await setToolsetEnabled('a2a', true, scopeProfile)
      notify({
        kind: 'success',
        message: q.outboundEnabled,
        action: { label: m.restartGateway, onClick: () => void runGatewayRestart() }
      })
      await queryClient.invalidateQueries({ queryKey: ['toolsets'] })
    } catch (enableError) {
      notifyError(enableError, q.outboundEnableFailed)
    } finally {
      setEnablingOutbound(false)
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
          <span className="block font-medium text-foreground/80">{q.inboundTitle}</span>
          <p className="mt-1 max-w-xl">{q.inboundHelp}</p>

          <div className="mt-3">
            <span className="block">{q.tokenHelp}</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Input
                aria-label={q.tokenLabel}
                className="h-8 max-w-96 font-mono"
                disabled={saving}
                onChange={event => {
                  setToken(event.target.value)
                  setError('')
                }}
                placeholder={q.tokenPlaceholder}
                value={token}
              />
              <Button
                disabled={saving}
                onClick={() => {
                  setToken(generateA2AToken())
                  setError('')
                }}
                size="sm"
                variant="secondary"
              >
                <RefreshCw className="size-3.5" />
                {q.generateToken}
              </Button>
            </div>
            {tokenError && <p className="mt-1.5 text-xs leading-5 text-destructive">{tokenError}</p>}
            <p className="mt-1.5 max-w-xl">{q.tokenWarning}</p>
          </div>

          <div className="mt-3">
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

          <div className="mt-3">
            <span className="block font-medium text-foreground/80">{q.cardTitle}</span>
            <p className="mt-1 max-w-xl">{q.cardHint}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{cardUrl}</code>
              <Button onClick={() => void copyText(cardUrl)} size="sm" variant="secondary">
                <Copy className="size-3.5" />
                {q.copyCardUrl}
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
          </div>
        </div>

        <div>
          <span className="block font-medium text-foreground/80">{q.outboundTitle}</span>
          <p className="mt-1 max-w-xl">{q.outboundHelp}</p>

          {agents.length === 0 ? (
            <p className="mt-2 max-w-xl text-amber-600 dark:text-amber-500">{q.noPeers}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {agents.map(agent => (
                <li className="flex flex-wrap items-center gap-2" key={agent.name}>
                  <code className="font-mono text-foreground/90">{agent.name}</code>
                  <span className="break-all">{agent.url}</span>
                  <span>{agent.has_auth ? q.peerHasAuth : q.peerNoAuth}</span>
                  <Button onClick={() => void removePeer(agent.name)} size="sm" variant="secondary">
                    <Trash2 className="size-3.5" />
                    {q.deletePeer}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 grid max-w-xl gap-2">
            <Input
              aria-label={q.peerNameLabel}
              className="h-8"
              disabled={addingPeer}
              onChange={event => {
                setPeerName(event.target.value)
                setError('')
              }}
              placeholder={q.peerNamePlaceholder}
              value={peerName}
            />
            <Input
              aria-label={q.peerUrlLabel}
              className="h-8 font-mono"
              disabled={addingPeer}
              onChange={event => {
                setPeerUrl(event.target.value)
                setError('')
              }}
              placeholder={q.peerUrlPlaceholder}
              value={peerUrl}
            />
            <Input
              aria-label={q.peerTokenLabel}
              className="h-8 font-mono"
              disabled={addingPeer}
              onChange={event => setPeerToken(event.target.value)}
              placeholder={q.peerTokenPlaceholder}
              value={peerToken}
            />
            <Input
              aria-label={q.peerCapsLabel}
              className="h-8"
              disabled={addingPeer}
              onChange={event => setPeerCaps(event.target.value)}
              placeholder={q.peerCapsPlaceholder}
              value={peerCaps}
            />
            <div>
              <Button disabled={addingPeer} onClick={() => void addPeer()} size="sm" variant="secondary">
                <Plus className="size-3.5" />
                {addingPeer ? q.addingPeer : q.addPeer}
              </Button>
            </div>
          </div>

          {enabled && !outboundOn && (
            <p className="mt-2 max-w-xl text-amber-600 dark:text-amber-500">{q.outboundOffWarning}</p>
          )}
          <div className="mt-2">
            {outboundOn ? (
              <p>{q.outboundAlreadyOn}</p>
            ) : (
              <Button disabled={enablingOutbound} onClick={() => void enableOutbound()} size="sm" variant="secondary">
                {q.enableOutbound}
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-xs leading-5 text-destructive">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => void saveInbound()} size="sm">
          <Save />
          {saving ? m.saving : m.saveAndEnable}
        </Button>
        <Button onClick={() => openExternalLink(A2A_GUIDE_URL)} size="sm" variant="secondary">
          {q.openGuide}
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </section>
  )
}
