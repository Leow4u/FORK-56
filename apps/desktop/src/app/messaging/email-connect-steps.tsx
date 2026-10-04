import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
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
import { detectEmailPreset, EMAIL_PROVIDER_PRESETS, type EmailProviderPreset } from './email-presets'
import { findInvalidEmailSender, validateMessagingEnv } from './validate-env'

/** Who the person said will email the bot: only them, or their team or
 *  clients. */
type Audience = 'me' | 'others'

type Step = 'mailbox' | 'ready' | 'who' | 'write'

type Phase = 'applied' | 'applying' | 'idle'

const CUSTOM = 'custom'
const SANS_FIELD = 'font-sans text-[0.8125rem]'

const savedValue = (envVars: MessagingEnvVarInfo[], key: string) =>
  envVars.find(field => field.key === key)?.value?.trim() || ''

/** The first connection of Email, one question per screen: who will write to
 *  the bot, its mailbox (the provider fills in the mail servers), who may
 *  write (a list — email has no approval codes), and a ready screen that logs
 *  in to IMAP and SMTP through the existing live test. One save through the
 *  channel update, then the gateway restart. */
export function EmailConnectSteps({
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
  /** The channel list reports Email on and connected. */
  platformConnected: boolean
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.emailPage
  const c = m.channelSteps

  const savedImap = savedValue(envVars, 'EMAIL_IMAP_HOST')
  const savedPreset = EMAIL_PROVIDER_PRESETS.find(preset => preset.imapHost === savedImap) ?? null
  const passwordSaved = Boolean(envVars.find(field => field.key === 'EMAIL_PASSWORD')?.is_set)

  const [audience, setAudience] = useState<Audience | null>(null)
  const [step, setStep] = useState<Step>('who')
  const [address, setAddress] = useState(savedValue(envVars, 'EMAIL_ADDRESS'))
  const [password, setPassword] = useState('')

  // null → custom mail servers. A provider picked by hand stays picked while
  // the address is still being typed.
  const [provider, setProvider] = useState<EmailProviderPreset | null>(
    savedImap ? savedPreset : detectEmailPreset(savedValue(envVars, 'EMAIL_ADDRESS'))
  )

  const [providerPinned, setProviderPinned] = useState(Boolean(savedImap))
  const [imapHost, setImapHost] = useState(savedPreset ? '' : savedImap)
  const [imapPort, setImapPort] = useState(savedValue(envVars, 'EMAIL_IMAP_PORT'))
  const [smtpHost, setSmtpHost] = useState(savedPreset ? '' : savedValue(envVars, 'EMAIL_SMTP_HOST'))
  const [smtpPort, setSmtpPort] = useState(savedValue(envVars, 'EMAIL_SMTP_PORT'))
  const [addresses, setAddresses] = useState(splitList(savedValue(envVars, 'EMAIL_ALLOWED_USERS')).join(', '))
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [login, setLogin] = useState<LiveCheck>({ outcome: 'pending' })

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'mailbox', label: s.stepMailbox },
      { id: 'write', label: s.stepWrite },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

  function fieldError(key: string, value: string): string {
    const invalid = value.trim() ? validateMessagingEnv(key, value) : null

    switch (invalid?.code) {
      case 'emailAddress':
        return m.envErrors.emailAddress(invalid.value)

      case 'emailHost':
        return m.envErrors.emailHost(invalid.value)

      case 'emailPort':
        return m.envErrors.emailPort(invalid.value)

      default:
        return ''
    }
  }

  const addressError = fieldError('EMAIL_ADDRESS', address)
  const imapHostError = provider ? '' : fieldError('EMAIL_IMAP_HOST', imapHost)
  const smtpHostError = provider ? '' : fieldError('EMAIL_SMTP_HOST', smtpHost)
  const imapPortError = provider ? '' : fieldError('EMAIL_IMAP_PORT', imapPort)
  const smtpPortError = provider ? '' : fieldError('EMAIL_SMTP_PORT', smtpPort)

  const servers = provider
    ? { imap: provider.imapHost, smtp: provider.smtpHost }
    : { imap: imapHost.trim(), smtp: smtpHost.trim() }

  const mailboxOk =
    Boolean(address.trim() && (password || passwordSaved) && servers.imap && servers.smtp) &&
    !addressError &&
    !imapHostError &&
    !smtpHostError &&
    !imapPortError &&
    !smtpPortError

  function onAddressChange(value: string) {
    setAddress(value)

    if (!providerPinned) {
      setProvider(detectEmailPreset(value))
    }
  }

  /** The addresses the save allows, or a message when the answer is not
   *  usable: email answers nobody without a list, and `*` would drop all mail. */
  function allowedAddresses(): { error: string } | { value: string } {
    const list = splitList(addresses)

    if (list.length === 0) {
      return { error: s.addressesRequired }
    }

    const invalid = list.includes('*') ? '*' : findInvalidEmailSender(list.join(','))

    return invalid ? { error: m.envErrors.emailAddress(invalid) } : { value: Array.from(new Set(list)).join(',') }
  }

  async function finish() {
    const allowed = allowedAddresses()

    if ('error' in allowed) {
      setError(allowed.error)

      return
    }

    setError('')
    setPhase('applying')
    setStep('ready')

    const env: Record<string, string> = {
      EMAIL_ADDRESS: address.trim(),
      EMAIL_ALLOWED_USERS: allowed.value,
      EMAIL_IMAP_HOST: servers.imap,
      EMAIL_SMTP_HOST: servers.smtp
    }

    if (password) {
      env.EMAIL_PASSWORD = password
    }

    // Ports exist only on custom servers; providers ride the adapter's
    // defaults (993 / 587), so a port left from custom servers is cleared.
    const clear: string[] = []

    for (const [key, value] of [
      ['EMAIL_IMAP_PORT', imapPort],
      ['EMAIL_SMTP_PORT', smtpPort]
    ] as const) {
      if (!provider && value.trim()) {
        env[key] = value.trim()
      } else if (savedValue(envVars, key)) {
        clear.push(key)
      }
    }

    try {
      await updateMessagingPlatform(
        'email',
        clear.length > 0 ? { clear_env: clear, enabled: true, env } : { enabled: true, env },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      // The login check talks to the mail servers, not the gateway: it runs
      // beside the restart instead of waiting for it.
      void testUntilOk('email', scopeProfile, 1).then(setLogin)
      setRestart(await restartAndWatch())
    } catch (saveError) {
      setPhase('idle')
      setStep('write')
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    }
  }

  const audienceOptions: ChoiceOption<Audience>[] = [
    { description: s.meDesc, id: 'me', title: s.meTitle },
    { description: s.othersDesc, id: 'others', title: s.othersTitle }
  ]

  const providerOptions = [
    ...EMAIL_PROVIDER_PRESETS.map(preset => ({ id: preset.id, label: preset.label })),
    { id: CUSTOM, label: s.custom }
  ]

  const whoLine = audience === 'me' ? s.whoMe : s.whoList(new Set(splitList(addresses)).size)
  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null
  const back = (to: Step) => ({ label: t.common.back, onClick: () => setStep(to) })
  const help = (message: string) => (message ? <span className="text-destructive">{message}</span> : undefined)

  return (
    <StepsFrame current={step} slot="email-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: () => setStep('mailbox') }} />
        </StepPanel>
      )}

      {step === 'mailbox' && (
        <StepPanel note={s.mailboxNote} title={s.mailboxTitle}>
          <StepField
            className={SANS_FIELD}
            help={help(addressError)}
            label={s.addressLabel}
            onChange={event => onAddressChange(event.target.value)}
            placeholder="bot@example.com"
            value={address}
          />
          <div className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-[0.78125rem] font-medium text-(--ui-text-secondary)">{s.providerLabel}</span>
            <SegmentedControl
              className="flex flex-wrap"
              onChange={id => {
                setProvider(EMAIL_PROVIDER_PRESETS.find(preset => preset.id === id) ?? null)
                setProviderPinned(true)
              }}
              options={providerOptions}
              value={provider?.id ?? CUSTOM}
            />
            {provider && (
              <span className={STEP_NOTE}>
                {s.serversFilled(`${provider.imapHost}:993`, `${provider.smtpHost}:587`)}
              </span>
            )}
          </div>
          {!provider && (
            <div className="grid max-w-[35rem] grid-cols-[minmax(0,1fr)_6rem] gap-x-2">
              <StepField
                help={help(imapHostError)}
                label={s.imapHostLabel}
                onChange={event => setImapHost(event.target.value)}
                placeholder="imap.example.com"
                value={imapHost}
              />
              <StepField
                help={help(imapPortError)}
                label={s.imapPortLabel}
                onChange={event => setImapPort(event.target.value)}
                placeholder="993"
                value={imapPort}
              />
              <StepField
                help={help(smtpHostError)}
                label={s.smtpHostLabel}
                onChange={event => setSmtpHost(event.target.value)}
                placeholder="smtp.example.com"
                value={smtpHost}
              />
              <StepField
                help={help(smtpPortError)}
                label={s.smtpPortLabel}
                onChange={event => setSmtpPort(event.target.value)}
                placeholder="587"
                value={smtpPort}
              />
            </div>
          )}
          <StepField
            help={s.passwordHelp}
            label={s.passwordLabel}
            onChange={event => setPassword(event.target.value)}
            placeholder={passwordSaved ? s.passwordKept : ''}
            type="password"
            value={password}
          />
          <StepFooter
            back={back('who')}
            next={{ disabled: !mailboxOk, label: c.next, onClick: () => setStep('write') }}
          />
        </StepPanel>
      )}

      {step === 'write' && audience === 'me' && (
        <StepPanel note={s.meAddressNote} title={s.meAddressTitle}>
          <StepField
            className={SANS_FIELD}
            label={s.meAddressLabel}
            onChange={event => {
              setAddresses(event.target.value)
              setError('')
            }}
            placeholder="ana@example.com"
            value={addresses}
          />
          {errorLine}
          <StepFooter back={back('mailbox')} next={{ label: c.next, onClick: () => void finish() }} />
        </StepPanel>
      )}

      {step === 'write' && audience === 'others' && (
        <StepPanel
          note={<Marked className="text-(--ui-text-secondary)" text={s.writeNote(s.othersTitle)} />}
          title={s.writeTitle}
        >
          <StepField
            className={SANS_FIELD}
            help={s.allowedHelp}
            label={s.allowedLabel}
            onChange={event => {
              setAddresses(event.target.value)
              setError('')
            }}
            placeholder="ana@example.com, bruno@example.com"
            value={addresses}
          />
          {errorLine}
          <StepFooter back={back('mailbox')} next={{ label: c.next, onClick: () => void finish() }} />
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
              <Marked className="text-(--ui-text-secondary)" text={s.tryIt(address.trim())} />
            ) : undefined
          }
          title={phase === 'applying' ? s.readySaving : platformConnected ? s.readyTitle : s.readySetUp}
        >
          {phase === 'applied' && (
            <LiveCheckLine
              check={login}
              ok={<Marked text={s.checkLogin(address.trim())} />}
              pending={s.checkLoginPending}
            />
          )}
          {phase === 'applied' && <RestartLine restart={restart} />}
          <ReadyLine done>{whoLine}</ReadyLine>
        </ReadyView>
      )}
    </StepsFrame>
  )
}
