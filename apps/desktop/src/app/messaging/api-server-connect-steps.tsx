import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, RefreshCw } from '@/lib/icons'
import type { MessagingEnvVarInfo } from '@/types/work4you'
import { updateMessagingPlatform } from '@/work4you'

import {
  apiServerBaseUrl,
  apiServerIsNetworkExposed,
  apiServerLiveUrl,
  apiServerModelName,
  generateApiServerKey,
  OPEN_WEBUI_GUIDE_URL
} from './api-server-endpoint'
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
import { validateMessagingEnv } from './validate-env'

type Step = 'connect' | 'key' | 'ready'

type Phase = 'applied' | 'applying' | 'idle'

const CAUTION = 'mt-2.5 block text-xs leading-4 text-amber-500'

/** The first setup of the OpenAI-compatible API server — the other way round
 *  from a chat channel: Work4You makes the key and the address another tool
 *  calls. The key, the values to paste into the tool, and a ready screen that
 *  proves the endpoint with the existing live test. One save through the
 *  channel update, then the gateway restart. */
export function ApiServerConnectSteps({
  envVars,
  onApplied,
  onDone,
  platformConnected,
  scopeProfile
}: {
  /** What is saved now: the steps start from it when run again. */
  envVars: MessagingEnvVarInfo[]
  /** The setup was saved; the channel list should be refreshed. */
  onApplied: () => void
  /** Done on the ready screen. */
  onDone: () => void
  /** The channel list reports the API server on and up. */
  platformConnected: boolean
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.apiServerPage
  const c = m.channelSteps

  const keySaved = Boolean(envVars.find(field => field.key === 'API_SERVER_KEY')?.is_set)

  const [step, setStep] = useState<Step>('key')
  const [key, setKey] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [endpoint, setEndpoint] = useState<LiveCheck>({ outcome: 'pending' })

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'key', label: s.stepKey },
      { id: 'connect', label: s.stepConnect },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

  const keyError =
    key.trim() && validateMessagingEnv('API_SERVER_KEY', key)?.code === 'apiServerKey' ? m.envErrors.apiServerKey : ''

  // A saved key is kept when the steps run again and nothing new is typed.
  const keyOk = key.trim() ? !keyError : keySaved

  const baseUrl = apiServerBaseUrl(envVars)
  const model = apiServerModelName(envVars, scopeProfile)
  const liveUrl = endpoint.outcome === 'ok' ? apiServerLiveUrl(endpoint.message) : null

  async function finish() {
    setError('')
    setPhase('applying')
    setStep('ready')

    try {
      await updateMessagingPlatform(
        'api_server',
        key.trim() ? { enabled: true, env: { API_SERVER_KEY: key.trim() } } : { enabled: true },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      const restarted = await restartAndWatch(scopeProfile)
      setRestart(restarted)

      // The test also passes before the listener is up ("restart to start
      // it"): only an answer from /v1/models with the key proves it live.
      setEndpoint(
        restarted.outcome === 'ok'
          ? await testUntilOk('api_server', scopeProfile, 5, result => result.ok && !!apiServerLiveUrl(result.message))
          : { outcome: 'skipped' }
      )
    } catch (saveError) {
      setPhase('idle')
      setStep('connect')
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    }
  }

  return (
    <StepsFrame current={step} slot="api-server-connect-steps" steps={steps}>
      {step === 'key' && (
        <StepPanel note={s.keyNote} title={s.keyTitle}>
          <StepField
            action={
              <Button className="shrink-0" onClick={() => setKey(generateApiServerKey())} size="sm" variant="outline">
                <RefreshCw />
                {s.generateKey}
              </Button>
            }
            help={keyError ? <span className="text-destructive">{keyError}</span> : s.keyHelp}
            label={s.keyLabel}
            onChange={event => setKey(event.target.value)}
            placeholder={keySaved ? s.keyKept : s.keyPlaceholder}
            value={key}
          />
          <span className={CAUTION}>{s.keyCaution}</span>
          <StepFooter next={{ disabled: !keyOk, label: c.next, onClick: () => setStep('connect') }} />
        </StepPanel>
      )}

      {step === 'connect' && (
        <StepPanel note={s.connectNote} title={s.connectTitle}>
          <UrlField copyLabel={s.copyBaseUrl} label={s.baseUrlLabel} url={baseUrl} />
          <UrlField label={s.modelLabel} url={model} />
          <div className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-[0.78125rem] font-medium text-(--ui-text-secondary)">{s.keyLabel}</span>
            <span className={STEP_NOTE}>{s.keyFromStep}</span>
          </div>
          {apiServerIsNetworkExposed(envVars) && <span className={CAUTION}>{s.networkExposed}</span>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => openExternalLink(OPEN_WEBUI_GUIDE_URL)} size="sm" variant="outline">
              <ExternalLink />
              {s.openGuide}
            </Button>
          </div>
          {error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null}
          <StepFooter
            back={{ label: t.common.back, onClick: () => setStep('key') }}
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
            phase === 'applied' ? <Marked className="text-(--ui-text-secondary)" text={s.tryIt(model)} /> : undefined
          }
          title={phase === 'applying' ? s.readySaving : liveUrl || platformConnected ? s.readyTitle : s.readySetUp}
        >
          {phase === 'applied' && endpoint.outcome !== 'skipped' && (
            <LiveCheckLine
              check={endpoint}
              ok={<Marked text={s.checkLive(liveUrl ?? baseUrl)} />}
              pending={s.checkPending}
            />
          )}
          {phase === 'applied' && <RestartLine restart={restart} scopeProfile={scopeProfile} />}
          {phase === 'applied' && (endpoint.outcome === 'ok' || endpoint.outcome === 'pending') && (
            <ReadyLine done={endpoint.outcome === 'ok'}>
              <Marked text={s.checkModel(model)} />
            </ReadyLine>
          )}
        </ReadyView>
      )}
    </StepsFrame>
  )
}
