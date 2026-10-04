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
import { validateMessagingEnv } from './validate-env'

export const TWILIO_CONSOLE_URL = 'https://console.twilio.com/'

/** Who the person said will text the bot: only them, or clients and team. */
type Audience = 'me' | 'others'

type Step = 'ready' | 'text' | 'twilio' | 'webhook' | 'who'

/** Who gets a reply once other people text: the numbers on a list (anyone
 *  else is ignored), or whoever texts, each approved by code. */
type AllowChoice = 'approve' | 'list'

type Phase = 'applied' | 'applying' | 'idle'

const savedValue = (envVars: MessagingEnvVarInfo[], key: string) =>
  envVars.find(field => field.key === key)?.value?.trim() || ''

/** The first connection of SMS through Twilio, one question per screen: who
 *  will text the bot, the Twilio account, the webhook Twilio calls (the
 *  gateway refuses to start without it), who may text, and a ready screen
 *  that checks the account and the number with the existing live test. One
 *  save through the channel update, then the gateway restart. */
export function SmsConnectSteps({
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
  /** The channel list reports SMS on and connected. */
  platformConnected: boolean
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.smsPage
  const c = m.channelSteps

  const tokenSaved = Boolean(envVars.find(field => field.key === 'TWILIO_AUTH_TOKEN')?.is_set)
  const savedAllowed = savedValue(envVars, 'SMS_ALLOWED_USERS')

  const [audience, setAudience] = useState<Audience | null>(null)
  const [step, setStep] = useState<Step>('who')
  const [accountSid, setAccountSid] = useState(savedValue(envVars, 'TWILIO_ACCOUNT_SID'))
  const [authToken, setAuthToken] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(savedValue(envVars, 'TWILIO_PHONE_NUMBER'))
  const [webhookUrl, setWebhookUrl] = useState(savedValue(envVars, 'SMS_WEBHOOK_URL'))
  const [numbers, setNumbers] = useState(splitList(savedAllowed).join(', '))
  // Run again on a saved setup without a list: people were being approved.
  const [allowChoice, setAllowChoice] = useState<AllowChoice>(tokenSaved && !savedAllowed ? 'approve' : 'list')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [twilio, setTwilio] = useState<LiveCheck>({ outcome: 'pending' })

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'twilio', label: s.stepTwilio },
      { id: 'webhook', label: s.stepWebhook },
      { id: 'text', label: s.stepText },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

  function fieldError(key: string, value: string): string {
    const invalid = value.trim() ? validateMessagingEnv(key, value) : null

    switch (invalid?.code) {
      case 'smsNumber':
        return m.envErrors.smsNumber(invalid.value)

      case 'smsWebhookUrl':
        return m.envErrors.smsWebhookUrl(invalid.value)

      case 'twilioAccountSid':
        return m.envErrors.twilioAccountSid

      default:
        return ''
    }
  }

  const sidError = fieldError('TWILIO_ACCOUNT_SID', accountSid)
  const numberError = fieldError('TWILIO_PHONE_NUMBER', phoneNumber)
  const webhookError = fieldError('SMS_WEBHOOK_URL', webhookUrl)

  const twilioOk =
    Boolean(accountSid.trim() && phoneNumber.trim() && (authToken.trim() || tokenSaved)) && !sidError && !numberError

  /** What the save puts in the allowlist: numbers, or nothing (everyone who
   *  texts gets a code). A message when an entry is not a + number. */
  function allowedNumbers(): { error: string } | { value: string } {
    if (audience === 'others' && allowChoice === 'approve') {
      return { value: '' }
    }

    const list = splitList(numbers)

    if (list.length === 0) {
      return { error: s.numbersRequired }
    }

    // `*` is not a number: approving people is the other answer here.
    if (list.includes('*')) {
      return { error: m.envErrors.smsNumber('*') }
    }

    const shape = validateMessagingEnv('SMS_ALLOWED_USERS', list.join(','))

    if (shape?.code === 'smsNumber') {
      return { error: m.envErrors.smsNumber(shape.value) }
    }

    return { value: Array.from(new Set(list)).join(',') }
  }

  async function finish() {
    const allowed = allowedNumbers()

    if ('error' in allowed) {
      setError(allowed.error)

      return
    }

    setError('')
    setPhase('applying')
    setStep('ready')

    const env: Record<string, string> = {
      SMS_WEBHOOK_URL: webhookUrl.trim(),
      TWILIO_ACCOUNT_SID: accountSid.trim(),
      TWILIO_PHONE_NUMBER: phoneNumber.trim()
    }

    if (authToken.trim()) {
      env.TWILIO_AUTH_TOKEN = authToken.trim()
    }

    if (allowed.value) {
      env.SMS_ALLOWED_USERS = allowed.value
    }

    const clearList = !allowed.value && savedAllowed

    try {
      await updateMessagingPlatform(
        'sms',
        clearList ? { clear_env: ['SMS_ALLOWED_USERS'], enabled: true, env } : { enabled: true, env },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      // The account check talks to Twilio, not the gateway: it runs beside
      // the restart instead of waiting for it.
      void testUntilOk('sms', scopeProfile, 1).then(setTwilio)
      setRestart(await restartAndWatch())
    } catch (saveError) {
      setPhase('idle')
      setStep('text')
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
            aria-label={s.listTitle}
            className="mt-2.5 h-8 font-mono text-[0.78rem]"
            onChange={event => {
              setNumbers(event.target.value)
              setError('')
            }}
            placeholder="+5511999993977, +5511988880000"
            value={numbers}
          />
          <span className={cn('mt-1.5 block', STEP_NOTE)}>{s.listHint}</span>
        </>
      ),
      id: 'list',
      title: s.listTitle
    },
    { description: s.approveDesc, id: 'approve', title: s.approveTitle }
  ]

  const whoLine =
    audience === 'me' ? s.whoMe : allowChoice === 'approve' ? s.whoApprove : s.whoList(new Set(splitList(numbers)).size)

  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null
  const back = (to: Step) => ({ label: t.common.back, onClick: () => setStep(to) })

  const help = (message: string, fallback?: ReactNode) =>
    message ? <span className="text-destructive">{message}</span> : fallback

  return (
    <StepsFrame current={step} slot="sms-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: () => setStep('twilio') }} />
        </StepPanel>
      )}

      {step === 'twilio' && (
        <StepPanel note={s.twilioNote} title={s.twilioTitle}>
          <StepField
            action={
              <Button onClick={() => openExternalLink(TWILIO_CONSOLE_URL)} size="sm" variant="outline">
                <ExternalLink />
                {s.openConsole}
              </Button>
            }
            help={help(sidError)}
            label={s.sidLabel}
            onChange={event => setAccountSid(event.target.value)}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={accountSid}
          />
          <StepField
            label={s.tokenLabel}
            onChange={event => setAuthToken(event.target.value)}
            placeholder={tokenSaved ? s.tokenKept : ''}
            type="password"
            value={authToken}
          />
          <StepField
            help={help(numberError, s.numberHelp)}
            label={s.numberLabel}
            onChange={event => setPhoneNumber(event.target.value)}
            placeholder="+15551234567"
            value={phoneNumber}
          />
          <StepFooter
            back={back('who')}
            next={{ disabled: !twilioOk, label: c.next, onClick: () => setStep('webhook') }}
          />
        </StepPanel>
      )}

      {step === 'webhook' && (
        <StepPanel note={s.webhookNote} title={s.webhookTitle}>
          <StepField
            help={help(webhookError, <Marked className="text-(--ui-text-secondary)" text={s.webhookHelp} />)}
            label={s.webhookLabel}
            onChange={event => setWebhookUrl(event.target.value)}
            placeholder="https://bot.example.com/webhooks/twilio"
            value={webhookUrl}
          />
          <ol className="mt-2 list-decimal space-y-2 pl-[1.125rem] text-[0.8125rem] leading-5 text-(--ui-text-secondary)">
            <li>
              <Marked text={s.webhookStep1} />
            </li>
            <li>
              <Marked text={s.webhookStep2} />
            </li>
          </ol>
          <span className="mt-1.5 block text-xs leading-4 text-amber-500">{s.webhookCaution}</span>
          <StepFooter
            back={back('twilio')}
            next={{
              disabled: !webhookUrl.trim() || Boolean(webhookError),
              label: c.next,
              onClick: () => setStep('text')
            }}
          />
        </StepPanel>
      )}

      {step === 'text' && audience === 'me' && (
        <StepPanel note={s.meNumberNote} title={s.meNumberTitle}>
          <StepField
            help={s.listHint}
            label={s.meNumberLabel}
            onChange={event => {
              setNumbers(event.target.value)
              setError('')
            }}
            placeholder="+5511999993977"
            value={numbers}
          />
          {errorLine}
          <StepFooter back={back('webhook')} next={{ label: c.next, onClick: () => void finish() }} />
        </StepPanel>
      )}

      {step === 'text' && audience === 'others' && (
        <StepPanel
          note={<Marked className="text-(--ui-text-secondary)" text={s.textNote(s.othersTitle)} />}
          title={s.textTitle}
        >
          <ChoiceList
            label={s.textTitle}
            onChange={choice => {
              setAllowChoice(choice)
              setError('')
            }}
            options={allowOptions}
            value={allowChoice}
          />
          {errorLine}
          <StepFooter back={back('webhook')} next={{ label: c.next, onClick: () => void finish() }} />
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
              <Marked className="text-(--ui-text-secondary)" text={s.tryIt(phoneNumber.trim())} />
            ) : undefined
          }
          title={phase === 'applying' ? s.readySaving : platformConnected ? s.readyTitle : s.readySetUp}
        >
          {phase === 'applied' && (
            <LiveCheckLine
              check={twilio}
              ok={<Marked text={s.checkTwilio(phoneNumber.trim())} />}
              pending={s.checkTwilioPending}
            />
          )}
          {phase === 'applied' && <RestartLine restart={restart} />}
          <ReadyLine done>{whoLine}</ReadyLine>
        </ReadyView>
      )}
    </StepsFrame>
  )
}
