import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, RefreshCw } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { MessagingEnvVarInfo } from '@/types/work4you'
import { updateMessagingPlatform } from '@/work4you'

import {
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
import {
  generateMsgraphClientState,
  MSGRAPH_GUIDE_URL,
  msgraphIsNetworkExposed,
  msgraphListenerFacts,
  msgraphListenerUp,
  msgraphNotificationUrlFor
} from './msgraph-endpoint'
import { validateMessagingEnv } from './validate-env'

type Step = 'reach' | 'ready' | 'resources' | 'secret'

type Reach = 'local' | 'network'

type Phase = 'applied' | 'applying' | 'idle'

const CAUTION = 'mt-2.5 block text-xs leading-4 text-amber-500'

const savedValue = (envVars: MessagingEnvVarInfo[], key: string) =>
  envVars.find(field => field.key === key)?.value?.trim() || ''

/** The first setup of the Microsoft Graph webhook listener: the clientState
 *  secret, how Graph reaches the listener (and the URL to register), which
 *  notifications to accept, and a ready screen that proves the listener with
 *  the existing live test. One save through the channel update, then the
 *  gateway restart. */
export function MsgraphConnectSteps({
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
  const s = m.msgraphPage
  const c = m.channelSteps

  const secretSaved = Boolean(envVars.find(field => field.key === 'MSGRAPH_WEBHOOK_CLIENT_STATE')?.is_set)
  const saved = (key: string) => savedValue(envVars, key)

  const [step, setStep] = useState<Step>('secret')
  const [secret, setSecret] = useState('')
  const [reach, setReach] = useState<Reach>(msgraphIsNetworkExposed(envVars) ? 'network' : 'local')
  const [cidrs, setCidrs] = useState(saved('MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS'))
  const [publicUrl, setPublicUrl] = useState(saved('MSGRAPH_WEBHOOK_PUBLIC_URL'))
  const [resources, setResources] = useState(saved('MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES'))
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [listener, setListener] = useState<LiveCheck>({ outcome: 'pending' })

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'secret', label: s.stepSecret },
      { id: 'reach', label: s.stepReach },
      { id: 'resources', label: s.stepResources },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

  const secretError =
    secret.trim() && validateMessagingEnv('MSGRAPH_WEBHOOK_CLIENT_STATE', secret)?.code === 'msgraphClientState'
      ? m.envErrors.msgraphClientState
      : ''

  const cidrError = (() => {
    const invalid = cidrs.trim() ? validateMessagingEnv('MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS', cidrs) : null

    return invalid?.code === 'msgraphCidr' ? m.envErrors.msgraphCidr(invalid.value) : ''
  })()

  const publicUrlError = (() => {
    const invalid = publicUrl.trim() ? validateMessagingEnv('MSGRAPH_WEBHOOK_PUBLIC_URL', publicUrl) : null

    return invalid?.code === 'msgraphPublicUrl' ? m.envErrors.msgraphPublicUrl(invalid.value) : ''
  })()

  // The adapter refuses a network bind without source CIDRs.
  const needsCidrs = reach === 'network' && !cidrs.trim()

  const notifyUrl = msgraphNotificationUrlFor({
    host: reach === 'network' ? '0.0.0.0' : '127.0.0.1',
    port: saved('MSGRAPH_WEBHOOK_PORT'),
    publicUrl
  })

  const facts = listener.outcome === 'ok' ? msgraphListenerFacts(listener.message) : null

  async function finish() {
    setError('')
    setPhase('applying')
    setStep('ready')

    // The host is always written, so the adapter never falls back to every
    // interface on its own.
    const env: Record<string, string> = { MSGRAPH_WEBHOOK_HOST: reach === 'network' ? '0.0.0.0' : '127.0.0.1' }

    const fields: [string, string][] = [
      ['MSGRAPH_WEBHOOK_CLIENT_STATE', secret],
      ['MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS', cidrs],
      ['MSGRAPH_WEBHOOK_PUBLIC_URL', publicUrl],
      ['MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES', resources]
    ]

    for (const [key, value] of fields) {
      if (value.trim()) {
        env[key] = value.trim()
      }
    }

    // An emptied optional value is cleared, so a second run never keeps an
    // old origin, allowlist or filter behind the new answers.
    const clear = fields
      .filter(([key, value]) => key !== 'MSGRAPH_WEBHOOK_CLIENT_STATE' && !value.trim() && saved(key))
      .map(([key]) => key)

    try {
      await updateMessagingPlatform(
        'msgraph_webhook',
        clear.length > 0 ? { clear_env: clear, enabled: true, env } : { enabled: true, env },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      const restarted = await restartAndWatch(scopeProfile)
      setRestart(restarted)

      // The test also passes before the listener answers ("starts with the
      // gateway"): only a listener that answered proves it up.
      setListener(
        restarted.outcome === 'ok'
          ? await testUntilOk(
              'msgraph_webhook',
              scopeProfile,
              5,
              result => result.ok && msgraphListenerUp(result.message)
            )
          : { outcome: 'skipped' }
      )
    } catch (saveError) {
      setPhase('idle')
      setStep('resources')
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    }
  }

  const help = (message: string, fallback?: string) =>
    message ? <span className="text-destructive">{message}</span> : fallback

  const back = (to: Step) => ({ label: t.common.back, onClick: () => setStep(to) })

  return (
    <StepsFrame current={step} slot="msgraph-connect-steps" steps={steps}>
      {step === 'secret' && (
        <StepPanel note={s.secretNote} title={s.secretTitle}>
          <StepField
            action={
              <Button
                className="shrink-0"
                onClick={() => setSecret(generateMsgraphClientState())}
                size="sm"
                variant="outline"
              >
                <RefreshCw />
                {s.generateSecret}
              </Button>
            }
            help={help(secretError)}
            label={s.secretLabel}
            onChange={event => setSecret(event.target.value)}
            placeholder={secretSaved ? s.secretKept : s.secretPlaceholder}
            value={secret}
          />
          <span className={CAUTION}>{s.secretCaution}</span>
          <p className={cn('mt-3', STEP_NOTE)}>{s.listenerOnly}</p>
          <StepFooter
            next={{
              disabled: Boolean(secretError) || (!secret.trim() && !secretSaved),
              label: c.next,
              onClick: () => setStep('reach')
            }}
          />
        </StepPanel>
      )}

      {step === 'reach' && (
        <StepPanel note={s.reachNote} title={s.reachTitle}>
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
            help={help(cidrError || (needsCidrs ? s.networkNeedsCidrs : ''), s.cidrsHelp)}
            label={s.cidrsLabel}
            onChange={event => setCidrs(event.target.value)}
            placeholder="52.96.0.0/14, 13.107.64.0/18"
            value={cidrs}
          />
          <StepField
            help={help(publicUrlError, s.publicUrlHelp)}
            label={s.publicUrlLabel}
            onChange={event => setPublicUrl(event.target.value)}
            placeholder="https://bot.example.com"
            value={publicUrl}
          />
          <UrlField copyLabel={s.copyNotifyUrl} help={s.notifyHelp} label={s.notifyLabel} url={notifyUrl} />
          <StepFooter
            back={back('secret')}
            next={{
              disabled: Boolean(cidrError || publicUrlError || needsCidrs),
              label: c.next,
              onClick: () => setStep('resources')
            }}
          />
        </StepPanel>
      )}

      {step === 'resources' && (
        <StepPanel note={s.resourcesNote} title={s.resourcesTitle}>
          <StepField
            label={s.resourcesLabel}
            onChange={event => setResources(event.target.value)}
            placeholder="communications/onlineMeetings, chats/*/messages"
            value={resources}
          />
          {error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null}
          <StepFooter back={back('reach')} next={{ label: c.next, onClick: () => void finish() }} />
        </StepPanel>
      )}

      {step === 'ready' && (
        <ReadyView
          busy={phase === 'applying'}
          footer={
            <>
              <Button onClick={() => openExternalLink(MSGRAPH_GUIDE_URL)} size="sm" variant="outline">
                <ExternalLink />
                {s.openGuide}
              </Button>
              <Button disabled={phase === 'applying'} onClick={onDone} size="sm">
                {t.common.done}
              </Button>
            </>
          }
          note={
            phase === 'applied' ? <Marked className="text-(--ui-text-secondary)" text={s.nextSubscribe} /> : undefined
          }
          title={phase === 'applying' ? s.readySaving : s.readyTitle}
        >
          {phase === 'applied' && listener.outcome !== 'skipped' && (
            <LiveCheckLine
              check={listener}
              ok={facts ? s.checkListener(facts.port, facts.network) : listener.message}
              pending={s.checkListenerPending}
            />
          )}
          {phase === 'applied' && (
            <ReadyLine done>
              <Marked text={s.checkRegister(facts?.notifyUrl ?? notifyUrl)} />
            </ReadyLine>
          )}
          {phase === 'applied' && <RestartLine restart={restart} scopeProfile={scopeProfile} />}
        </ReadyView>
      )}
    </StepsFrame>
  )
}
