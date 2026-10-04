import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { RefreshCw } from '@/lib/icons'
import type { MessagingEnvVarInfo } from '@/types/work4you'
import { updateMessagingPlatform } from '@/work4you'

import {
  a2aCardUrlFor,
  a2aHasInboundToken,
  a2aIsNetworkExposed,
  a2aListenerFacts,
  generateA2AToken
} from './a2a-endpoint'
import { OutboundSwitch, PeerForm, PeerRows, useA2AOutbound, useA2APeers } from './a2a-peers'
import {
  ChoiceList,
  type ChoiceOption,
  type LiveCheck,
  LiveCheckLine,
  Marked,
  ReadyLine,
  ReadyView,
  restartAndWatch,
  RestartLine,
  type RestartState,
  STEP_NOTE,
  StepField,
  StepFooter,
  StepPanel,
  StepsFrame,
  testUntilOk,
  UrlField
} from './channel-steps'
import { validateMessagingEnv } from './validate-env'

/** Which way A2A goes: others call this bot, it calls others, or both. */
type Purpose = 'both' | 'inbound' | 'outbound'

type Step = 'callable' | 'peers' | 'ready' | 'what'

type Reach = 'local' | 'network'

type Phase = 'applied' | 'applying' | 'idle'

const savedValue = (envVars: MessagingEnvVarInfo[], key: string) =>
  envVars.find(field => field.key === key)?.value?.trim() || ''

/** The first setup of A2A, one question per screen: what it is for, how
 *  other agents reach this one (inbound), the peers it may call (outbound),
 *  and a ready screen that proves the listener with the existing live test.
 *  Inbound saves through the channel update; peers and the outbound tools
 *  save as they change, through the existing peer and toolset calls; the
 *  gateway restarts at the end. */
export function A2AConnectSteps({
  envVars,
  onApplied,
  onDone,
  scopeProfile
}: {
  /** What is saved now: the steps start from it when run again. */
  envVars: MessagingEnvVarInfo[]
  /** The setup was saved; the channel list should be refreshed. */
  onApplied: () => void
  /** Done on the ready screen. */
  onDone: () => void
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.a2aPage
  const c = m.channelSteps
  const peers = useA2APeers(scopeProfile).data?.agents ?? []
  const outbound = useA2AOutbound(scopeProfile)

  const tokenSaved = Boolean(envVars.find(field => field.key === 'A2A_BEARER_TOKEN')?.is_set)
  const savedPublicUrl = savedValue(envVars, 'A2A_PUBLIC_URL')

  const [purpose, setPurpose] = useState<null | Purpose>(null)
  const [step, setStep] = useState<Step>('what')

  const [reach, setReach] = useState<Reach>(
    a2aIsNetworkExposed(envVars) && a2aHasInboundToken(envVars) ? 'network' : 'local'
  )

  const [token, setToken] = useState('')
  const [publicUrl, setPublicUrl] = useState(savedPublicUrl)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [listener, setListener] = useState<LiveCheck>({ outcome: 'pending' })

  const inbound = purpose !== 'outbound'
  const calls = purpose !== 'inbound'

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'what', label: s.stepWhat },
      ...(inbound ? [{ id: 'callable' as const, label: s.stepCallable }] : []),
      ...(calls ? [{ id: 'peers' as const, label: s.stepPeers }] : []),
      { id: 'ready', label: s.stepReady }
    ],
    [calls, inbound, s]
  )

  const tokenError =
    token.trim() && validateMessagingEnv('A2A_BEARER_TOKEN', token)?.code === 'apiServerKey'
      ? m.envErrors.apiServerKey
      : ''

  const publicUrlError = (() => {
    const invalid = publicUrl.trim() ? validateMessagingEnv('A2A_PUBLIC_URL', publicUrl) : null

    return invalid?.code === 'a2aPublicUrl' ? m.envErrors.a2aPublicUrl(invalid.value) : ''
  })()

  // The adapter keeps a network bind on loopback until a token exists.
  const needsToken = reach === 'network' && !token.trim() && !a2aHasInboundToken(envVars)

  const cardUrl = a2aCardUrlFor({
    host: reach === 'network' ? '0.0.0.0' : '127.0.0.1',
    port: savedValue(envVars, 'A2A_PORT'),
    publicUrl
  })

  const facts = listener.outcome === 'ok' ? a2aListenerFacts(listener.message) : null

  async function finish() {
    setError('')
    setPhase('applying')
    setStep('ready')

    try {
      if (inbound) {
        const env: Record<string, string> = { A2A_HOST: reach === 'network' ? '0.0.0.0' : '127.0.0.1' }

        if (token.trim()) {
          env.A2A_BEARER_TOKEN = token.trim()
        }

        if (publicUrl.trim()) {
          env.A2A_PUBLIC_URL = publicUrl.trim()
        }

        // An emptied public URL is cleared, so the card stops advertising it.
        await updateMessagingPlatform(
          'a2a',
          !publicUrl.trim() && savedPublicUrl
            ? { clear_env: ['A2A_PUBLIC_URL'], enabled: true, env }
            : { enabled: true, env },
          scopeProfile
        )
      }

      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      const restarted = await restartAndWatch(scopeProfile)
      setRestart(restarted)

      if (inbound) {
        // The test also passes before the listener answers ("starts with the
        // gateway"): only a listener that answered proves it up.
        setListener(
          restarted.outcome === 'ok'
            ? await testUntilOk('a2a', scopeProfile, 5, result => result.ok && !!a2aListenerFacts(result.message))
            : { outcome: 'skipped' }
        )
      }
    } catch (saveError) {
      setPhase('idle')
      setStep(inbound ? 'callable' : 'peers')
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    }
  }

  const purposeOptions: ChoiceOption<Purpose>[] = [
    { description: s.inboundDesc, id: 'inbound', title: s.inboundTitle },
    { description: s.outboundDesc, id: 'outbound', title: s.outboundTitle },
    { description: s.bothDesc, id: 'both', title: s.bothTitle }
  ]

  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null

  const help = (message: string, fallback?: string) =>
    message ? <span className="text-destructive">{message}</span> : fallback

  return (
    <StepsFrame current={step} slot="a2a-connect-steps" steps={steps}>
      {step === 'what' && (
        <StepPanel note={s.whatNote} title={s.whatTitle}>
          <ChoiceList label={s.whatTitle} onChange={setPurpose} options={purposeOptions} value={purpose} />
          <StepFooter
            next={{ disabled: !purpose, label: c.next, onClick: () => setStep(inbound ? 'callable' : 'peers') }}
          />
        </StepPanel>
      )}

      {step === 'callable' && (
        <StepPanel note={s.callableNote} title={s.callableTitle}>
          <div className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-[0.78125rem] font-medium text-(--ui-text-secondary)">{s.reachLabel}</span>
            <SegmentedControl
              onChange={setReach}
              options={[
                { id: 'local', label: s.reachLocal },
                { id: 'network', label: s.reachNetwork }
              ]}
              value={reach}
            />
          </div>
          <StepField
            action={
              <Button className="shrink-0" onClick={() => setToken(generateA2AToken())} size="sm" variant="outline">
                <RefreshCw />
                {s.generateToken}
              </Button>
            }
            help={help(tokenError || (needsToken ? s.networkNeedsToken : ''), s.tokenHelp)}
            label={s.tokenLabel}
            onChange={event => setToken(event.target.value)}
            placeholder={tokenSaved ? s.tokenKept : s.tokenPlaceholder}
            value={token}
          />
          <StepField
            help={help(publicUrlError, s.publicUrlHelp)}
            label={s.publicUrlLabel}
            onChange={event => setPublicUrl(event.target.value)}
            placeholder="https://agents.example.com"
            value={publicUrl}
          />
          <UrlField copyLabel={s.copyCardUrl} help={s.cardHelp} label={s.cardLabel} url={cardUrl} />
          {errorLine}
          <StepFooter
            back={{ label: t.common.back, onClick: () => setStep('what') }}
            next={{
              disabled: Boolean(tokenError || publicUrlError || needsToken),
              label: c.next,
              onClick: () => (calls ? setStep('peers') : void finish())
            }}
          />
        </StepPanel>
      )}

      {step === 'peers' && (
        <StepPanel note={s.peersNote} title={s.peersTitle}>
          {peers.length > 0 && (
            <div className="mt-3">
              <PeerRows peers={peers} scopeProfile={scopeProfile} />
            </div>
          )}
          <PeerForm scopeProfile={scopeProfile} />
          <OutboundSwitch className="mt-3.5" scopeProfile={scopeProfile}>
            <span className={STEP_NOTE}>{s.outboundNote}</span>
          </OutboundSwitch>
          {errorLine}
          <StepFooter
            back={{ label: t.common.back, onClick: () => setStep(inbound ? 'callable' : 'what') }}
            next={{ label: c.next, onClick: () => void finish() }}
          />
        </StepPanel>
      )}

      {step === 'ready' && (
        <ReadyView
          busy={phase === 'applying'}
          footer={
            <Button disabled={phase === 'applying'} onClick={onDone} size="sm">
              {t.common.done}
            </Button>
          }
          note={
            phase === 'applied' ? (
              <Marked
                className="text-(--ui-text-secondary)"
                text={calls && peers.length > 0 ? s.tryItPeer(peers[0].name) : s.tryItCard}
              />
            ) : undefined
          }
          title={phase === 'applying' ? s.readySaving : s.readyTitle}
        >
          {phase === 'applied' && inbound && listener.outcome !== 'skipped' && (
            <LiveCheckLine
              check={listener}
              ok={facts ? s.checkListener(facts.port, facts.remote) : listener.message}
              pending={s.checkListenerPending}
            />
          )}
          {phase === 'applied' && inbound && (listener.outcome === 'ok' || listener.outcome === 'pending') && (
            <ReadyLine done={listener.outcome === 'ok'}>
              <Marked text={s.checkCard(facts?.cardUrl ?? cardUrl)} />
            </ReadyLine>
          )}
          {phase === 'applied' && calls && <ReadyLine done>{s.checkPeers(peers.length, outbound.on)}</ReadyLine>}
          {(restart.outcome === 'failed' || restart.outcome === 'none') && (
            <RestartLine restart={restart} scopeProfile={scopeProfile} />
          )}
        </ReadyView>
      )}
    </StepsFrame>
  )
}
