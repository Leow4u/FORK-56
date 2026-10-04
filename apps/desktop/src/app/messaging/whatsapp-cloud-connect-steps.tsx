import { type ReactNode, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Copy, ExternalLink, RefreshCw } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
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
import { type MessagingEnvError, validateMessagingEnv } from './validate-env'
import {
  generateWhatsappCloudVerifyToken,
  WHATSAPP_CLOUD_LOCAL_HOST,
  WHATSAPP_CLOUD_NETWORK_HOST,
  whatsappCloudCallbackFor,
  whatsappCloudConfirmedNumber,
  whatsappCloudEnvValue,
  whatsappCloudIsNetworkExposed
} from './whatsapp-cloud-endpoint'

export const META_APPS_URL = 'https://developers.facebook.com/apps'

/** Who the person said will message the business number: only them (to
 *  test), or clients and team. */
type Audience = 'me' | 'others'

type Step = 'meta' | 'ready' | 'talk' | 'webhook' | 'who'

type Bind = 'local' | 'network'

type Phase = 'applied' | 'applying' | 'idle'

/** The first connection of the WhatsApp Cloud API, one question per screen:
 *  who will message the number, the three values from Meta, the webhook Meta
 *  calls, who may talk to the bot (a list — the Cloud API sends no approval
 *  codes), and a ready screen that checks the number with Meta through the
 *  existing live test. One save through the channel update, then the gateway
 *  restart. */
export function WhatsAppCloudConnectSteps({
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
  const s = m.whatsappCloudPage
  const c = m.channelSteps

  const saved = (key: string) => Boolean(envVars.find(field => field.key === key)?.is_set)
  const savedAllowed = whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_ALLOWED_USERS')

  const [audience, setAudience] = useState<Audience | null>(null)
  const [step, setStep] = useState<Step>('who')
  const [phoneNumberId, setPhoneNumberId] = useState(whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_PHONE_NUMBER_ID'))
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [bind, setBind] = useState<Bind>(whatsappCloudIsNetworkExposed(envVars) ? 'network' : 'local')
  const [publicUrl, setPublicUrl] = useState(whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_PUBLIC_URL'))
  const [numbers, setNumbers] = useState(savedAllowed.split(',').filter(Boolean).join(', '))
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [meta, setMeta] = useState<LiveCheck>({ outcome: 'pending' })

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'meta', label: s.stepMeta },
      { id: 'webhook', label: s.stepWebhook },
      { id: 'talk', label: s.stepTalk },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

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

  const metaOk =
    Boolean(phoneNumberId.trim()) &&
    Boolean(accessToken.trim() || saved('WHATSAPP_CLOUD_ACCESS_TOKEN')) &&
    Boolean(appSecret.trim() || saved('WHATSAPP_CLOUD_APP_SECRET')) &&
    !phoneNumberIdError &&
    !accessTokenError &&
    !appSecretError

  const webhookOk =
    Boolean(verifyToken.trim() || saved('WHATSAPP_CLOUD_VERIFY_TOKEN')) && !verifyTokenError && !publicUrlError

  const callbackUrl = whatsappCloudCallbackFor(publicUrlError ? '' : publicUrl, envVars)

  async function copyCallback() {
    try {
      await navigator.clipboard.writeText(callbackUrl)
      notify({ kind: 'success', message: t.common.copied })
    } catch (copyError) {
      notifyError(copyError, t.common.copyFailed)
    }
  }

  /** The numbers the save allows, or a message when the answer is not usable:
   *  the Cloud API answers nobody without a list. */
  function allowedNumbers(): { error: string } | { value: string } {
    const list = splitList(numbers)

    if (list.length === 0) {
      return { error: s.numbersRequired }
    }

    // `*` would let everyone in, which this channel's setup does not offer.
    const invalid = list.find(entry => entry === '*') ?? null
    const shape = validateMessagingEnv('WHATSAPP_CLOUD_ALLOWED_USERS', list.join(','))

    if (invalid || shape) {
      return { error: m.envErrors.whatsappNumber(invalid ?? (shape?.code === 'whatsappNumber' ? shape.value : '')) }
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
      WHATSAPP_CLOUD_ALLOWED_USERS: allowed.value,
      WHATSAPP_CLOUD_PHONE_NUMBER_ID: phoneNumberId.trim(),
      WHATSAPP_CLOUD_WEBHOOK_HOST: bind === 'network' ? WHATSAPP_CLOUD_NETWORK_HOST : WHATSAPP_CLOUD_LOCAL_HOST
    }

    for (const [key, value] of [
      ['WHATSAPP_CLOUD_ACCESS_TOKEN', accessToken],
      ['WHATSAPP_CLOUD_APP_SECRET', appSecret],
      ['WHATSAPP_CLOUD_VERIFY_TOKEN', verifyToken],
      ['WHATSAPP_CLOUD_PUBLIC_URL', publicUrl]
    ] as const) {
      if (value.trim()) {
        env[key] = value.trim()
      }
    }

    // An emptied origin is cleared, so a second run never keeps the old one.
    const clearOrigin = !publicUrl.trim() && whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_PUBLIC_URL')

    try {
      await updateMessagingPlatform(
        'whatsapp_cloud',
        clearOrigin ? { clear_env: ['WHATSAPP_CLOUD_PUBLIC_URL'], enabled: true, env } : { enabled: true, env },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      const restarted = await restartAndWatch()
      setRestart(restarted)
      setMeta(await testUntilOk('whatsapp_cloud', scopeProfile))
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

  const listOption: ChoiceOption<'list'>[] = [
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
            placeholder="5511999993977, 5511988880000"
            value={numbers}
          />
          <span className={cn('mt-1.5 block', STEP_NOTE)}>{s.listHint}</span>
        </>
      ),
      id: 'list',
      title: s.listTitle
    }
  ]

  const confirmed = meta.outcome === 'ok' ? whatsappCloudConfirmedNumber(meta.message ?? '') : null
  const whoLine = audience === 'me' ? s.whoMe : s.whoList(new Set(splitList(numbers)).size)
  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null
  const back = (to: Step) => ({ label: t.common.back, onClick: () => setStep(to) })

  const help = (message: string, fallback: ReactNode) =>
    message ? <span className="text-destructive">{message}</span> : fallback

  return (
    <StepsFrame current={step} slot="whatsapp-cloud-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: () => setStep('meta') }} />
        </StepPanel>
      )}

      {step === 'meta' && (
        <StepPanel note={s.metaNote} title={s.metaTitle}>
          <StepField
            help={help(phoneNumberIdError, s.phoneIdHelp)}
            label={s.phoneIdLabel}
            onChange={event => setPhoneNumberId(event.target.value)}
            placeholder="109876543210987"
            value={phoneNumberId}
          />
          <StepField
            help={help(accessTokenError, s.tokenHelp)}
            label={s.tokenLabel}
            onChange={event => setAccessToken(event.target.value)}
            placeholder={saved('WHATSAPP_CLOUD_ACCESS_TOKEN') ? s.savedKeep : 'EAA…'}
            type="password"
            value={accessToken}
          />
          <StepField
            action={
              <Button onClick={() => openExternalLink(META_APPS_URL)} size="sm" variant="outline">
                <ExternalLink />
                {s.openDashboard}
              </Button>
            }
            help={help(appSecretError, s.secretHelp)}
            label={s.secretLabel}
            onChange={event => setAppSecret(event.target.value)}
            placeholder={saved('WHATSAPP_CLOUD_APP_SECRET') ? s.savedKeep : ''}
            type="password"
            value={appSecret}
          />
          <StepFooter
            back={back('who')}
            next={{ disabled: !metaOk, label: c.next, onClick: () => setStep('webhook') }}
          />
        </StepPanel>
      )}

      {step === 'webhook' && (
        <StepPanel note={s.webhookNote} title={s.webhookTitle}>
          <StepField
            action={
              <Button onClick={() => setVerifyToken(generateWhatsappCloudVerifyToken())} size="sm" variant="outline">
                <RefreshCw />
                {s.generate}
              </Button>
            }
            help={help(verifyTokenError, s.verifyHelp)}
            label={s.verifyLabel}
            onChange={event => setVerifyToken(event.target.value)}
            placeholder={saved('WHATSAPP_CLOUD_VERIFY_TOKEN') ? s.savedKeep : ''}
            value={verifyToken}
          />
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
            help={help(publicUrlError, publicUrl.trim() ? s.publicUrlHelp : s.tunnelWarning)}
            label={s.publicUrlLabel}
            onChange={event => setPublicUrl(event.target.value)}
            placeholder="https://bot.example.com"
            value={publicUrl}
          />
          <div className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-[0.78125rem] font-medium text-(--ui-text-secondary)">{s.callbackLabel}</span>
            <UrlRow copyLabel={s.copyCallback} url={callbackUrl} />
            <span className={STEP_NOTE}>
              <Marked className="text-(--ui-text-secondary)" text={s.callbackHelp} />
            </span>
          </div>
          <StepFooter
            back={back('meta')}
            next={{ disabled: !webhookOk, label: c.next, onClick: () => setStep('talk') }}
          />
        </StepPanel>
      )}

      {step === 'talk' && audience === 'me' && (
        <StepPanel note={s.meNumberNote} title={s.meNumberTitle}>
          <StepField
            help={s.listDesc}
            label={s.meNumberLabel}
            onChange={event => {
              setNumbers(event.target.value)
              setError('')
            }}
            placeholder="5511999993977"
            value={numbers}
          />
          {errorLine}
          <StepFooter back={back('webhook')} next={{ label: c.next, onClick: () => void finish() }} />
        </StepPanel>
      )}

      {step === 'talk' && audience === 'others' && (
        <StepPanel
          note={<Marked className="text-(--ui-text-secondary)" text={s.talkNote(s.othersTitle)} />}
          title={s.talkTitle}
        >
          <ChoiceList label={s.talkTitle} onChange={() => undefined} options={listOption} value="list" />
          {errorLine}
          <StepFooter back={back('webhook')} next={{ label: c.next, onClick: () => void finish() }} />
        </StepPanel>
      )}

      {step === 'ready' && (
        <ReadyView
          busy={phase === 'applying'}
          footer={
            <>
              <Button onClick={() => void copyCallback()} size="sm" variant="outline">
                <Copy />
                {s.copyCallback}
              </Button>
              <Button disabled={phase === 'applying'} onClick={onDone} size="sm">
                {t.common.done}
              </Button>
            </>
          }
          note={phase === 'applied' ? <Marked className="text-(--ui-text-secondary)" text={s.tryIt} /> : undefined}
          title={phase === 'applying' ? s.readySaving : s.readySetUp}
        >
          {phase === 'applied' && (
            <LiveCheckLine
              check={meta}
              ok={<Marked text={confirmed ? s.checkMeta(confirmed.number, confirmed.name) : s.checkMetaGeneric} />}
              pending={s.checkMetaPending}
            />
          )}
          {phase === 'applied' && <RestartLine restart={restart} />}
          <ReadyLine done>{whoLine}</ReadyLine>
        </ReadyView>
      )}
    </StepsFrame>
  )
}
