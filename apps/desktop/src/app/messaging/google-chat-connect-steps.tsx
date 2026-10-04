import { type ReactNode, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  testUntilOk
} from './channel-steps'
import { type GoogleChatMode, googleChatMode, subscriptionProject } from './google-chat-config'
import { findInvalidEmailSender, GOOGLE_CHAT_SUBSCRIPTION_RE, validateMessagingEnv } from './validate-env'

export const CLOUD_CONSOLE_URL = 'https://console.cloud.google.com/'
export const CHAT_API_CONFIG_URL = 'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat'

/** Who the person said will use the app: only them, or their team. */
type Audience = 'me' | 'others'

type Step = 'cloud' | 'mode' | 'ready' | 'talk' | 'who'

/** Who gets a reply once the team is let in: the emails on a list (anyone
 *  else who DMs gets a code), or everyone, each approved by code. */
type AllowChoice = 'approve' | 'list'

type Phase = 'applied' | 'applying' | 'idle'

const savedValue = (envVars: MessagingEnvVarInfo[], key: string) =>
  envVars.find(field => field.key === key)?.value?.trim() || ''

/** The first connection of Google Chat, one question per screen: who will
 *  use the app, how its events arrive (Pub/Sub or an HTTP callback), the
 *  Google Cloud project, who may talk, and a ready screen that checks the
 *  credentials with the existing live test. One save through the channel
 *  update, then the gateway restart. */
export function GoogleChatConnectSteps({
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
  /** The channel list reports Google Chat on and connected. */
  platformConnected: boolean
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.googleChatPage
  const c = m.channelSteps
  const cs = m.channelSettings

  const keySaved = Boolean(envVars.find(field => field.key === 'GOOGLE_CHAT_SERVICE_ACCOUNT_JSON')?.is_set)
  const savedAllowed = savedValue(envVars, 'GOOGLE_CHAT_ALLOWED_USERS')

  const [audience, setAudience] = useState<Audience | null>(null)
  const [step, setStep] = useState<Step>('who')
  const [mode, setMode] = useState<GoogleChatMode>(googleChatMode(envVars))
  const [serviceAccount, setServiceAccount] = useState('')
  const [projectId, setProjectId] = useState(savedValue(envVars, 'GOOGLE_CHAT_PROJECT_ID'))
  const [subscription, setSubscription] = useState(savedValue(envVars, 'GOOGLE_CHAT_SUBSCRIPTION_NAME'))
  const [eventsUrl, setEventsUrl] = useState(savedValue(envVars, 'GOOGLE_CHAT_HTTP_EVENTS_URL'))
  const [saEmail, setSaEmail] = useState(savedValue(envVars, 'GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL'))
  const [tokenAudience, setTokenAudience] = useState(savedValue(envVars, 'GOOGLE_CHAT_HTTP_EVENTS_AUDIENCE'))
  const [emails, setEmails] = useState(splitList(savedAllowed).join(', '))

  const [allowChoice, setAllowChoice] = useState<AllowChoice>(
    savedValue(envVars, 'GOOGLE_CHAT_PROJECT_ID') && !savedAllowed ? 'approve' : 'list'
  )

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [credentials, setCredentials] = useState<LiveCheck>({ outcome: 'pending' })

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'mode', label: s.stepMode },
      { id: 'cloud', label: s.stepCloud },
      { id: 'talk', label: s.stepTalk },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

  function fieldError(key: string, value: string): string {
    const invalid = value.trim() ? validateMessagingEnv(key, value) : null

    switch (invalid?.code) {
      case 'emailAddress':
        return m.envErrors.emailAddress(invalid.value)

      case 'googleChatEventsUrl':
        return m.envErrors.googleChatEventsUrl(invalid.value)

      case 'googleChatProjectId':
        return m.envErrors.googleChatProjectId(invalid.value)

      case 'googleChatSubscription':
        return m.envErrors.googleChatSubscription(invalid.value)

      default:
        return ''
    }
  }

  const projectError = fieldError('GOOGLE_CHAT_PROJECT_ID', projectId)

  const embeddedProject = GOOGLE_CHAT_SUBSCRIPTION_RE.test(subscription.trim())
    ? subscriptionProject(subscription)
    : null

  const subscriptionError =
    fieldError('GOOGLE_CHAT_SUBSCRIPTION_NAME', subscription) ||
    (embeddedProject && projectId.trim() && embeddedProject !== projectId.trim() ? s.projectMismatch : '')

  const eventsUrlError = fieldError('GOOGLE_CHAT_HTTP_EVENTS_URL', eventsUrl)
  const saEmailError = fieldError('GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL', saEmail)

  const cloudOk =
    mode === 'pubsub'
      ? Boolean(projectId.trim() && subscription.trim()) && !projectError && !subscriptionError
      : Boolean(eventsUrl.trim() && saEmail.trim()) && !eventsUrlError && !saEmailError

  /** What the save puts in the allowlist: emails, or nothing (everyone who
   *  DMs gets a code). A message when an entry is not an email. */
  function allowedEmails(): { error: string } | { value: string } {
    if (audience === 'others' && allowChoice === 'approve') {
      return { value: '' }
    }

    const list = splitList(emails)

    if (list.length === 0) {
      return { error: s.emailsRequired }
    }

    const invalid = list.includes('*') ? '*' : findInvalidEmailSender(list.join(','))

    return invalid ? { error: m.envErrors.emailAddress(invalid) } : { value: Array.from(new Set(list)).join(',') }
  }

  async function finish() {
    const allowed = allowedEmails()

    if ('error' in allowed) {
      setError(allowed.error)

      return
    }

    setError('')
    setPhase('applying')
    setStep('ready')

    const env: Record<string, string> =
      mode === 'pubsub'
        ? { GOOGLE_CHAT_PROJECT_ID: projectId.trim(), GOOGLE_CHAT_SUBSCRIPTION_NAME: subscription.trim() }
        : {
            GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL: saEmail.trim(),
            GOOGLE_CHAT_HTTP_EVENTS_URL: eventsUrl.trim()
          }

    if (mode === 'http' && tokenAudience.trim()) {
      env.GOOGLE_CHAT_HTTP_EVENTS_AUDIENCE = tokenAudience.trim()
    }

    if (serviceAccount.trim()) {
      env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON = serviceAccount.trim()
    }

    if (allowed.value) {
      env.GOOGLE_CHAT_ALLOWED_USERS = allowed.value
    }

    // The other mode's values are cleared, so a setup that switched modes
    // never leaves the old one half-filled behind; an emptied list too.
    const otherMode =
      mode === 'pubsub'
        ? [
            'GOOGLE_CHAT_HTTP_EVENTS_URL',
            'GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL',
            'GOOGLE_CHAT_HTTP_EVENTS_AUDIENCE'
          ]
        : ['GOOGLE_CHAT_SUBSCRIPTION_NAME']

    const clear = [
      ...otherMode.filter(key => savedValue(envVars, key)),
      ...(!allowed.value && savedAllowed ? ['GOOGLE_CHAT_ALLOWED_USERS'] : [])
    ]

    try {
      await updateMessagingPlatform(
        'google_chat',
        clear.length > 0 ? { clear_env: clear, enabled: true, env } : { enabled: true, env },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      // The credentials check talks to Google Cloud, not the gateway: it runs
      // beside the restart instead of waiting for it.
      void testUntilOk('google_chat', scopeProfile, 1).then(setCredentials)
      setRestart(await restartAndWatch())
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

  const modeOptions: ChoiceOption<GoogleChatMode>[] = [
    { description: s.pubsubDesc, id: 'pubsub', title: s.pubsubTitle },
    { description: s.httpDesc, id: 'http', title: s.httpTitle }
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
              setEmails(event.target.value)
              setError('')
            }}
            placeholder="ana@acme.com, bruno@acme.com"
            value={emails}
          />
          <span className={cn('mt-1.5 block', STEP_NOTE)}>{s.listHint}</span>
        </>
      ),
      id: 'list',
      title: cs.listTitle
    },
    { description: s.approveDesc, id: 'approve', title: cs.approveTitle }
  ]

  const whoLine =
    audience === 'me' ? s.whoMe : allowChoice === 'approve' ? s.whoApprove : s.whoList(new Set(splitList(emails)).size)

  const checklist =
    mode === 'pubsub' ? [s.pubsubStep1, s.pubsubStep2, s.pubsubStep3, s.pubsubStep4] : [s.httpStep1, s.httpStep2]

  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null
  const back = (to: Step) => ({ label: t.common.back, onClick: () => setStep(to) })

  const help = (message: string, fallback?: ReactNode) =>
    message ? <span className="text-destructive">{message}</span> : fallback

  return (
    <StepsFrame current={step} slot="google-chat-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: () => setStep('mode') }} />
        </StepPanel>
      )}

      {step === 'mode' && (
        <StepPanel note={s.modeNote} title={s.modeTitle}>
          <ChoiceList label={s.modeTitle} onChange={setMode} options={modeOptions} value={mode} />
          <StepFooter back={back('who')} next={{ label: c.next, onClick: () => setStep('cloud') }} />
        </StepPanel>
      )}

      {step === 'cloud' && (
        <StepPanel note={mode === 'pubsub' ? s.cloudNote : s.cloudNoteHttp} title={s.cloudTitle}>
          <ol className="mt-2 list-decimal space-y-2 pl-[1.125rem] text-[0.8125rem] leading-5 text-(--ui-text-secondary)">
            {checklist.map(item => (
              <li key={item}>
                <Marked text={item} />
              </li>
            ))}
          </ol>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button onClick={() => openExternalLink(CHAT_API_CONFIG_URL)} size="sm" variant="outline">
              <ExternalLink />
              {s.openChatApi}
            </Button>
            <Button onClick={() => openExternalLink(CLOUD_CONSOLE_URL)} size="sm" variant="outline">
              <ExternalLink />
              {s.openConsole}
            </Button>
          </div>
          <StepField
            help={s.keyHelp}
            label={s.keyLabel}
            onChange={event => setServiceAccount(event.target.value)}
            placeholder={keySaved ? s.keyKept : '/home/ana/keys/work4you-chat.json'}
            value={serviceAccount}
          />
          {mode === 'pubsub' ? (
            <>
              <StepField
                help={help(projectError)}
                label={s.projectLabel}
                onChange={event => setProjectId(event.target.value)}
                placeholder="work4you-chat"
                value={projectId}
              />
              <StepField
                help={help(subscriptionError)}
                label={s.subscriptionLabel}
                onChange={event => setSubscription(event.target.value)}
                placeholder="projects/work4you-chat/subscriptions/chat-events"
                value={subscription}
              />
            </>
          ) : (
            <>
              <StepField
                help={help(eventsUrlError, s.eventsUrlHelp)}
                label={s.eventsUrlLabel}
                onChange={event => setEventsUrl(event.target.value)}
                placeholder="https://bot.example.com/api/platforms/google_chat/events"
                value={eventsUrl}
              />
              <StepField
                help={help(saEmailError, s.saEmailHelp)}
                label={s.saEmailLabel}
                onChange={event => setSaEmail(event.target.value)}
                placeholder="chat@system.gserviceaccount.com"
                value={saEmail}
              />
              <StepField
                help={s.audienceHelp}
                label={s.audienceLabel}
                onChange={event => setTokenAudience(event.target.value)}
                placeholder={eventsUrl.trim() || 'https://bot.example.com/api/platforms/google_chat/events'}
                value={tokenAudience}
              />
            </>
          )}
          <StepFooter
            back={back('mode')}
            next={{ disabled: !cloudOk, label: c.next, onClick: () => setStep('talk') }}
          />
        </StepPanel>
      )}

      {step === 'talk' && audience === 'me' && (
        <StepPanel note={s.meEmailNote} title={s.meEmailTitle}>
          <StepField
            label={s.meEmailLabel}
            onChange={event => {
              setEmails(event.target.value)
              setError('')
            }}
            placeholder="ana@acme.com"
            value={emails}
          />
          {errorLine}
          <StepFooter back={back('cloud')} next={{ label: c.next, onClick: () => void finish() }} />
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
          <StepFooter back={back('cloud')} next={{ label: c.next, onClick: () => void finish() }} />
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
          {phase === 'applied' && (
            <LiveCheckLine
              check={credentials}
              ok={mode === 'pubsub' ? s.checkPubsub : s.checkHttp}
              pending={s.checkPending}
            />
          )}
          {phase === 'applied' && <RestartLine restart={restart} />}
          <ReadyLine done>{whoLine}</ReadyLine>
        </ReadyView>
      )}
    </StepsFrame>
  )
}
