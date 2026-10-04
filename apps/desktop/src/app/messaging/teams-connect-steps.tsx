import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { MessagingEnvVarInfo } from '@/types/work4you'
import { updateMessagingPlatform } from '@/work4you'

import { splitList } from './channel-settings'
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
  UrlRow
} from './channel-steps'
import {
  TEAMS_DEFAULT_PORT,
  TEAMS_LOCAL_HOST,
  TEAMS_NETWORK_HOST,
  teamsEndpointFor,
  teamsEnvValue,
  teamsIsNetworkExposed
} from './teams-endpoint'
import { validateMessagingEnv } from './validate-env'

export const AZURE_PORTAL_URL = 'https://portal.azure.com'

/** Who the person said will use the bot: only them, or their organization. */
type Audience = 'me' | 'others'

type Step = 'azure' | 'endpoint' | 'ready' | 'talk' | 'who'

/** Who gets a reply once the organization is let in: the object ids on a
 *  list (anyone else who writes privately gets a code to approve), or
 *  everyone in the tenant (the allowlist's `*`). */
type AllowChoice = 'everyone' | 'list'

type Bind = 'local' | 'network'

type Phase = 'applied' | 'applying' | 'idle'

/** The first connection of Microsoft Teams, one question per screen: who will
 *  use it, the Azure bot registration, how Teams reaches the listener, who
 *  may talk to the bot, and a ready screen that proves the listener with the
 *  existing live test. One save through the channel update, then the gateway
 *  restart. */
export function TeamsConnectSteps({
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
  /** The channel list reports Teams on and connected. */
  platformConnected: boolean
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.teamsPage
  const c = m.channelSteps
  const cs = m.channelSettings

  const secretSaved = Boolean(envVars.find(field => field.key === 'TEAMS_CLIENT_SECRET')?.is_set)
  const savedAllowed = teamsEnvValue(envVars, 'TEAMS_ALLOWED_USERS')
  const port = teamsEnvValue(envVars, 'TEAMS_PORT') || TEAMS_DEFAULT_PORT

  const [audience, setAudience] = useState<Audience | null>(null)
  const [step, setStep] = useState<Step>('who')
  const [clientId, setClientId] = useState(teamsEnvValue(envVars, 'TEAMS_CLIENT_ID'))
  const [tenantId, setTenantId] = useState(teamsEnvValue(envVars, 'TEAMS_TENANT_ID'))
  const [secret, setSecret] = useState('')
  const [bind, setBind] = useState<Bind>(teamsIsNetworkExposed(envVars) ? 'network' : 'local')
  const [publicUrl, setPublicUrl] = useState(teamsEnvValue(envVars, 'TEAMS_PUBLIC_URL'))
  const [ids, setIds] = useState(savedAllowed === '*' ? '' : savedAllowed.split(',').join(', '))
  const [allowChoice, setAllowChoice] = useState<AllowChoice>(savedAllowed === '*' ? 'everyone' : 'list')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [listener, setListener] = useState<LiveCheck>({ outcome: 'pending' })

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'azure', label: s.stepAzure },
      { id: 'endpoint', label: s.stepEndpoint },
      { id: 'talk', label: s.stepTalk },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

  const guidError = (key: 'TEAMS_CLIENT_ID' | 'TEAMS_TENANT_ID', value: string) => {
    const invalid = validateMessagingEnv(key, value)

    return invalid?.code === 'teamsGuid' ? m.envErrors.teamsGuid(invalid.value) : ''
  }

  const clientIdError = guidError('TEAMS_CLIENT_ID', clientId)
  const tenantIdError = guidError('TEAMS_TENANT_ID', tenantId)

  const azureOk =
    Boolean(clientId.trim() && tenantId.trim() && (secret.trim() || secretSaved)) && !clientIdError && !tenantIdError

  const publicUrlInvalid = validateMessagingEnv('TEAMS_PUBLIC_URL', publicUrl)

  const publicUrlError =
    publicUrlInvalid?.code === 'teamsPublicUrl' ? m.envErrors.teamsPublicUrl(publicUrlInvalid.value) : ''

  const endpoint = teamsEndpointFor(publicUrlError ? '' : publicUrl, port)

  /** What the save puts in the allowlist: ids, `*`, or nothing (everyone who
   *  writes privately gets a code). A message when an entry is not an id. */
  function allowedUsers(): { error: string } | { value: string } {
    if (audience === 'others' && allowChoice === 'everyone') {
      return { value: '*' }
    }

    const list = splitList(ids)
    const invalid = validateMessagingEnv('TEAMS_ALLOWED_USERS', list.filter(id => id !== '*').join(','))

    if (invalid?.code === 'teamsGuid' || list.includes('*')) {
      return { error: m.envErrors.teamsGuid(invalid?.code === 'teamsGuid' ? invalid.value : '*') }
    }

    return { value: Array.from(new Set(list)).join(',') }
  }

  async function finish() {
    const allowed = allowedUsers()

    if ('error' in allowed) {
      setError(allowed.error)

      return
    }

    setError('')
    setPhase('applying')
    setStep('ready')

    const env: Record<string, string> = {
      TEAMS_CLIENT_ID: clientId.trim(),
      TEAMS_HOST: bind === 'network' ? TEAMS_NETWORK_HOST : TEAMS_LOCAL_HOST,
      TEAMS_TENANT_ID: tenantId.trim()
    }

    if (secret.trim()) {
      env.TEAMS_CLIENT_SECRET = secret.trim()
    }

    if (publicUrl.trim()) {
      env.TEAMS_PUBLIC_URL = publicUrl.trim()
    }

    if (allowed.value) {
      env.TEAMS_ALLOWED_USERS = allowed.value
    }

    // Emptied answers are cleared, so a second run of the steps never keeps
    // an old list or origin behind the new one.
    const clear = [
      !allowed.value && savedAllowed ? 'TEAMS_ALLOWED_USERS' : null,
      !publicUrl.trim() && teamsEnvValue(envVars, 'TEAMS_PUBLIC_URL') ? 'TEAMS_PUBLIC_URL' : null
    ].filter((key): key is string => Boolean(key))

    try {
      await updateMessagingPlatform(
        'teams',
        clear.length > 0 ? { clear_env: clear, enabled: true, env } : { enabled: true, env },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      const restarted = await restartAndWatch()
      setRestart(restarted)

      if (restarted.outcome === 'ok') {
        setListener(await testUntilOk('teams', scopeProfile))
      } else {
        setListener({ outcome: 'skipped' })
      }
    } catch (saveError) {
      setPhase('idle')
      setStep('talk')
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    }
  }

  const audienceOptions: ChoiceOption<Audience>[] = [
    { description: s.meDesc, id: 'me', title: s.meTitle },
    { description: s.othersDesc, id: 'others', title: s.othersTitle }
  ]

  const allowOptions: ChoiceOption<AllowChoice>[] = [
    {
      description: s.listDesc,
      extra: (
        <>
          <Input
            aria-label={cs.listTitle}
            className="mt-2.5 h-8 font-mono text-[0.78rem]"
            onChange={event => {
              setIds(event.target.value)
              setError('')
            }}
            placeholder="6f1c2a9e-0b7d-4c55-9a51-2f3e4d5c6b7a"
            value={ids}
          />
          <span className={cn('mt-1.5 block', STEP_NOTE)}>
            <Marked className="text-(--ui-text-secondary)" text={s.listHint} />
          </span>
        </>
      ),
      id: 'list',
      title: cs.listTitle
    },
    { description: s.everyoneDesc, id: 'everyone', title: s.everyoneTitle }
  ]

  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null
  const back = (to: Step) => ({ label: t.common.back, onClick: () => setStep(to) })
  const fieldError = (message: string) => (message ? <span className="text-destructive">{message}</span> : undefined)

  return (
    <StepsFrame current={step} slot="teams-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: () => setStep('azure') }} />
        </StepPanel>
      )}

      {step === 'azure' && (
        <StepPanel note={<Marked className="text-(--ui-text-secondary)" text={s.azureNote} />} title={s.azureTitle}>
          <StepField
            help={fieldError(clientIdError)}
            label={s.clientIdLabel}
            onChange={event => setClientId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            value={clientId}
          />
          <StepField
            help={fieldError(tenantIdError)}
            label={s.tenantIdLabel}
            onChange={event => setTenantId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            value={tenantId}
          />
          <StepField
            action={
              <Button onClick={() => openExternalLink(AZURE_PORTAL_URL)} size="sm" variant="outline">
                <ExternalLink />
                {s.openPortal}
              </Button>
            }
            help={s.secretHelp}
            label={s.secretLabel}
            onChange={event => setSecret(event.target.value)}
            placeholder={secretSaved ? s.secretKept : ''}
            type="password"
            value={secret}
          />
          <StepFooter
            back={back('who')}
            next={{ disabled: !azureOk, label: c.next, onClick: () => setStep('endpoint') }}
          />
        </StepPanel>
      )}

      {step === 'endpoint' && (
        <StepPanel note={s.endpointNote} title={s.endpointTitle}>
          <div className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-[0.78125rem] font-medium text-(--ui-text-secondary)">{s.bindLabel}</span>
            <SegmentedControl
              onChange={setBind}
              options={[
                { id: 'local', label: s.bindLocal },
                { id: 'network', label: s.bindNetwork }
              ]}
              value={bind}
            />
          </div>
          <StepField
            help={publicUrlError ? fieldError(publicUrlError) : publicUrl.trim() ? s.publicUrlHelp : s.tunnelWarning}
            label={s.publicUrlLabel}
            onChange={event => setPublicUrl(event.target.value)}
            placeholder="https://bot.example.com"
            value={publicUrl}
          />
          <div className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-[0.78125rem] font-medium text-(--ui-text-secondary)">{s.endpointLabel}</span>
            <UrlRow copyLabel={s.copyEndpoint} url={endpoint} />
            <span className={STEP_NOTE}>
              <Marked className="text-(--ui-text-secondary)" text={s.endpointHelp} />
            </span>
          </div>
          <StepFooter
            back={back('azure')}
            next={{ disabled: Boolean(publicUrlError), label: c.next, onClick: () => setStep('talk') }}
          />
        </StepPanel>
      )}

      {step === 'talk' && audience === 'me' && (
        <StepPanel note={s.meIdNote} title={s.meIdTitle}>
          <StepField
            help={<Marked className="text-(--ui-text-secondary)" text={s.meIdHelp} />}
            label={s.meIdLabel}
            onChange={event => {
              setIds(event.target.value)
              setError('')
            }}
            placeholder="6f1c2a9e-0b7d-4c55-9a51-2f3e4d5c6b7a"
            value={ids}
          />
          {errorLine}
          <StepFooter back={back('endpoint')} next={{ label: c.next, onClick: () => void finish() }} />
        </StepPanel>
      )}

      {step === 'talk' && audience === 'others' && (
        <StepPanel
          note={<Marked className="text-(--ui-text-secondary)" text={s.talkNote(s.othersTitle)} />}
          title={s.talkTitle}
        >
          <ChoiceList
            label={s.talkTitle}
            onChange={choice => {
              setAllowChoice(choice)
              setError('')
            }}
            options={allowOptions}
            value={allowChoice}
          />
          {errorLine}
          <StepFooter back={back('endpoint')} next={{ label: c.next, onClick: () => void finish() }} />
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
          note={phase === 'applied' ? <Marked className="text-(--ui-text-secondary)" text={s.tryIt} /> : undefined}
          title={phase === 'applying' ? s.readySaving : platformConnected ? s.readyTitle : s.readySetUp}
        >
          {phase === 'applied' && listener.outcome !== 'skipped' && (
            <LiveCheckLine check={listener} ok={s.checkListener(port)} pending={s.checkListenerPending} />
          )}
          {phase === 'applied' && <RestartLine restart={restart} />}
          <ReadyLine done>
            <Marked text={s.checkEndpoint(endpoint)} />
          </ReadyLine>
        </ReadyView>
      )}
    </StepsFrame>
  )
}
