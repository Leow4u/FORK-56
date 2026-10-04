import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { Plus } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import type { A2AAgentInfo } from '@/types/work4you'
import { createA2AAgent, deleteA2AAgent, getA2AAgents, getToolsets, setToolsetEnabled } from '@/work4you'

import { BlockListRow, splitList } from './channel-settings'
import { StepField } from './channel-steps'
import { validateMessagingEnv } from './validate-env'

/** The pieces of A2A's outbound side, shared by its steps and its settings
 *  page: the peers the bot may call (each removable), the form to add one,
 *  and the switch of the a2a toolset that lets the agent call them. Each
 *  change saves at once through the existing peer and toolset calls. */

export function useA2APeers(scopeProfile: null | string) {
  return useQuery({ queryFn: () => getA2AAgents(scopeProfile), queryKey: ['a2a-agents', scopeProfile ?? ''] })
}

/** Whether the a2a toolset (the agent's outbound tools) is on. */
export function useA2AOutbound(scopeProfile: null | string): { loaded: boolean; on: boolean } {
  const { data } = useQuery({ queryFn: () => getToolsets(scopeProfile), queryKey: ['toolsets', scopeProfile ?? ''] })

  return { loaded: data !== undefined, on: data?.some(toolset => toolset.name === 'a2a' && toolset.enabled) ?? false }
}

export function PeerRows({ peers, scopeProfile }: { peers: A2AAgentInfo[]; scopeProfile: null | string }) {
  const { t } = useI18n()
  const s = t.messaging.a2aPage
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<null | string>(null)

  async function remove(name: string) {
    setRemoving(name)

    try {
      await deleteA2AAgent(name, scopeProfile)
      await queryClient.invalidateQueries({ queryKey: ['a2a-agents'] })
    } catch (removeError) {
      notifyError(removeError, s.peerRemoveFailed)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div>
      {peers.map(peer => (
        <BlockListRow
          action={
            <Button
              disabled={removing === peer.name}
              onClick={() => void remove(peer.name)}
              size="sm"
              variant="outline"
            >
              {s.removePeer}
            </Button>
          }
          description={s.peerLine(peer.url, peer.has_auth)}
          key={peer.name}
          title={peer.name}
        />
      ))}
    </div>
  )
}

/** The four values of a peer, two by two, and Add peer. */
export function PeerForm({
  onAdded,
  onCancel,
  scopeProfile
}: {
  onAdded?: () => void
  onCancel?: () => void
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.a2aPage
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim() || !url.trim()) {
      setError(s.peerRequired)

      return
    }

    // A peer's URL follows the same shape as the public URL (http/https).
    const invalid = validateMessagingEnv('A2A_PUBLIC_URL', url)

    if (invalid?.code === 'a2aPublicUrl') {
      setError(m.envErrors.a2aPublicUrl(invalid.value))

      return
    }

    const capabilityList = splitList(capabilities)

    setBusy(true)
    setError('')

    try {
      await createA2AAgent(
        {
          name: name.trim(),
          url: url.trim(),
          ...(token.trim() ? { token: token.trim() } : {}),
          ...(capabilityList.length > 0 ? { capabilities: capabilityList } : {})
        },
        scopeProfile
      )
      setName('')
      setUrl('')
      setToken('')
      setCapabilities('')
      await queryClient.invalidateQueries({ queryKey: ['a2a-agents'] })
      onAdded?.()
    } catch (addError) {
      notifyError(addError, s.peerAddFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-3">
        <StepField
          className="font-sans text-[0.8125rem]"
          label={s.peerNameLabel}
          onChange={event => setName(event.target.value)}
          placeholder="researcher"
          value={name}
        />
        <StepField
          label={s.peerUrlLabel}
          onChange={event => setUrl(event.target.value)}
          placeholder="http://research-box.local:9900"
          value={url}
        />
        <StepField
          label={s.peerTokenLabel}
          onChange={event => setToken(event.target.value)}
          placeholder={s.peerTokenPlaceholder}
          value={token}
        />
        <StepField
          className="font-sans text-[0.8125rem]"
          label={s.peerCapsLabel}
          onChange={event => setCapabilities(event.target.value)}
          placeholder="web_search, research"
          value={capabilities}
        />
      </div>
      {error ? <p className="mt-2.5 text-xs leading-4 text-destructive">{error}</p> : null}
      <div className="mt-2.5 flex items-center gap-2">
        <Button disabled={busy} onClick={() => void add()} size="sm" variant="outline">
          <Plus />
          {s.addPeer}
        </Button>
        {onCancel && (
          <Button disabled={busy} onClick={onCancel} size="sm" variant="ghost">
            {t.common.cancel}
          </Button>
        )}
      </div>
    </div>
  )
}

/** The a2a toolset's switch: on, the agent can discover and call the peers. */
export function OutboundSwitch({
  children,
  className,
  scopeProfile
}: {
  /** What follows the switch on its line (a note, an action). */
  children?: ReactNode
  className?: string
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const s = t.messaging.a2aPage
  const queryClient = useQueryClient()
  const outbound = useA2AOutbound(scopeProfile)
  const [busy, setBusy] = useState(false)

  async function toggle(enabled: boolean) {
    setBusy(true)

    try {
      await setToolsetEnabled('a2a', enabled, scopeProfile)
      await queryClient.invalidateQueries({ queryKey: ['toolsets'] })
    } catch (toggleError) {
      notifyError(toggleError, s.outboundFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1', className)}>
      <Switch
        aria-label={s.outboundToggle}
        checked={outbound.on}
        disabled={!outbound.loaded || busy}
        onCheckedChange={enabled => void toggle(enabled)}
        size="xs"
      />
      <span className="text-[0.84375rem] text-foreground">{outbound.on ? s.outboundOn : s.outboundOff}</span>
      {children}
    </div>
  )
}
