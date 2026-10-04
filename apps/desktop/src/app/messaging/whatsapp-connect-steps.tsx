import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Check } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { WhatsAppOnboardingMode, WhatsAppOnboardingStatusResponse } from '@/types/work4you'
import {
  applyWhatsAppOnboarding,
  cancelWhatsAppOnboarding,
  getWhatsAppOnboardingStatus,
  startWhatsAppOnboarding
} from '@/work4you'

import {
  ChoiceList,
  type ChoiceOption,
  ReadyLine,
  RestartLine,
  type RestartState,
  STEP_NOTE,
  StepFooter,
  StepPanel,
  StepsFrame,
  watchRestartOutcome
} from './channel-steps'
import { findInvalidWhatsAppUser } from './validate-env'

/** Who the person said will use the channel. `self` and `solo` are both
 *  "just me"; they differ in which number answers — the person's own one
 *  (the bridge's self-chat mode) or a second one (bot mode). `team` is bot
 *  mode with other people allowed in. */
type Audience = 'self' | 'solo' | 'team'

type Step = 'connect' | 'ready' | 'talk' | 'who'

/** Who gets a reply once other people are allowed in: the numbers on a list
 *  (anyone else asks for approval) or whoever writes, each approved here. */
type AllowChoice = 'approve' | 'list'

// `preparing` covers the backend's `installing` (first-run npm install of the
// bundled bridge, can take minutes) and `starting` (bridge boot) statuses —
// both mean "no QR yet, keep polling". `applied` is past the save: the pairing
// session is gone server-side and nothing polls any more.
type Phase = 'applied' | 'applying' | 'connected' | 'idle' | 'preparing' | 'starting' | 'waiting'

/** 404/410 mean the pairing is gone server-side — restartable, not retryable. */
function isTerminalOnboardingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return (/\b410\b/.test(message) && /\b(expired|gone)\b/i.test(message)) || /\b404\b/.test(message)
}

async function qrDataUrlFor(payload: string): Promise<string> {
  const { toDataURL } = await import('qrcode')

  return toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 224 })
}

/** The first connection of WhatsApp, one question per screen: who will use
 *  it, the Linked Devices QR, who may talk to the bot (only when other people
 *  are let in), and a ready screen. The same backend flow as before — start
 *  spawns the bundled bridge, polling streams the QR, one apply call saves
 *  the mode and allowlist, enables the channel and restarts the gateway —
 *  with the "Bot / Self-chat" choice turned into what the person wants. */
export function WhatsAppConnectSteps({
  onAdvanced,
  onApplied,
  onDone,
  platformConnected,
  savedMode,
  scopeProfile
}: {
  /** "Already linked another way": the person wants the raw settings. */
  onAdvanced: () => void
  /** The setup was saved; the channel list should be refreshed. */
  onApplied: () => void
  /** Done on the ready screen. */
  onDone: () => void
  /** The channel list reports WhatsApp on and connected. */
  platformConnected: boolean
  savedMode?: null | string
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.whatsappQuickSetup
  const s = m.whatsappSteps
  const c = m.channelSteps

  const [audience, setAudience] = useState<Audience | null>(savedMode === 'self-chat' ? 'self' : null)
  const [step, setStep] = useState<Step>('who')
  const [setup, setSetup] = useState<null | WhatsAppOnboardingStatusResponse>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [allowChoice, setAllowChoice] = useState<AllowChoice>('list')
  const [allowedUsers, setAllowedUsers] = useState('')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })

  const mode: WhatsAppOnboardingMode = audience === 'self' ? 'self-chat' : 'bot'
  const polling = phase === 'preparing' || phase === 'waiting'

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'connect', label: s.stepConnect },
      ...(audience === 'team' ? [{ id: 'talk' as const, label: s.stepTalk }] : []),
      { id: 'ready', label: s.stepReady }
    ],
    [audience, s]
  )

  useEffect(() => {
    if (!setup || !polling) {
      return
    }

    let cancelled = false
    let timeout: null | ReturnType<typeof setTimeout> = null
    let lastQr = setup.qr_payload ?? ''

    const poll = async () => {
      try {
        const status = await getWhatsAppOnboardingStatus(setup.pairing_id)

        if (cancelled) {
          return
        }

        setSetup(status)

        // The bridge rotates the QR periodically; re-render whenever the
        // payload moves so a stale code never lingers on screen.
        if (status.qr_payload && status.qr_payload !== lastQr) {
          lastQr = status.qr_payload
          const dataUrl = await qrDataUrlFor(status.qr_payload)

          if (cancelled) {
            return
          }

          setQrDataUrl(dataUrl)
        }

        if (status.status === 'connected') {
          setPhase('connected')
          setError('')

          return
        }

        if (status.status === 'error' || status.status === 'cancelled' || status.status === 'expired') {
          setSetup(null)
          setQrDataUrl('')
          setPhase('idle')
          setError(status.error || q.sessionExpired)

          return
        }

        if (status.qr_payload) {
          setPhase('waiting')
        }

        setError('')
        timeout = setTimeout(() => void poll(), 1500)
      } catch (pollError) {
        if (cancelled) {
          return
        }

        const expiresAt = Date.parse(setup.expires_at)
        const expired = Number.isFinite(expiresAt) && Date.now() >= expiresAt

        if (isTerminalOnboardingError(pollError) || expired) {
          setSetup(null)
          setQrDataUrl('')
          setPhase('idle')
          setError(q.sessionExpired)

          return
        }

        timeout = setTimeout(() => void poll(), 2000)
      }
    }

    timeout = setTimeout(() => void poll(), 1200)

    return () => {
      cancelled = true

      if (timeout) {
        clearTimeout(timeout)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, q.sessionExpired, setup?.pairing_id])

  const resetSetup = () => {
    setSetup(null)
    setQrDataUrl('')
    setPhase('idle')
    setError('')
  }

  async function start() {
    setPhase('starting')
    setError('')
    setQrDataUrl('')

    try {
      const res = await startWhatsAppOnboarding(mode, '', scopeProfile)
      setSetup(res)

      if (res.status === 'error') {
        setSetup(null)
        setPhase('idle')
        setError(res.error || q.startFailed)

        return
      }

      if (res.status === 'connected') {
        // A session already exists on disk — the account is linked; only the
        // save + restart is missing.
        setPhase('connected')

        return
      }

      if (res.qr_payload) {
        setQrDataUrl(await qrDataUrlFor(res.qr_payload))
        setPhase('waiting')

        return
      }

      setPhase('preparing')
    } catch (startError) {
      setPhase('idle')
      setError(startError instanceof Error ? startError.message : q.startFailed)
    }
  }

  async function cancel() {
    if (setup) {
      try {
        await cancelWhatsAppOnboarding(setup.pairing_id)
      } catch {
        // local cleanup still wins
      }
    }

    resetSetup()
  }

  function goConnect() {
    if (!audience) {
      return
    }

    setStep('connect')
    void start()
  }

  function goBackToWho() {
    void cancel()
    setStep('who')
  }

  /** The one save: mode + allowlist, enable, restart — then the ready screen
   *  reports on the restart. A failed save returns to the screen it left. */
  async function finish() {
    if (!setup) {
      return
    }

    const listed = audience === 'team' && allowChoice === 'list'
    const users = listed ? allowedUsers.trim() : ''

    if (listed) {
      if (!users) {
        setError(s.numbersRequired)

        return
      }

      const invalid = findInvalidWhatsAppUser(users)

      if (invalid) {
        setError(m.envErrors.whatsappNumber(invalid))

        return
      }
    }

    const from: Step = audience === 'team' ? 'talk' : 'connect'
    setError('')
    setPhase('applying')
    setStep('ready')

    try {
      const result = await applyWhatsAppOnboarding(setup.pairing_id, { allowed_users: users, mode }, scopeProfile)
      setPhase('applied')
      onApplied()

      if (result.restart_started) {
        setRestart({ outcome: 'pending' })
        setRestart(await watchRestartOutcome(scopeProfile))
      } else {
        setRestart({ detail: result.restart_error, outcome: 'none' })
      }
    } catch (applyError) {
      setPhase('connected')
      setStep(from)
      setError(applyError instanceof Error ? applyError.message : String(applyError))
    }
  }

  const linkedLabel = setup?.account_phone ? `+${setup.account_phone}` : setup?.account_name || setup?.account_id || ''
  const chatUrl = setup?.account_phone ? `https://wa.me/${setup.account_phone}` : ''
  const stepIndex = steps.findIndex(entry => entry.id === step)
  const linked = phase === 'connected' || phase === 'applying' || phase === 'applied'

  const audienceOptions: ChoiceOption<Audience>[] = [
    { description: s.selfDesc, id: 'self', title: s.selfTitle },
    { description: s.soloDesc, id: 'solo', title: s.soloTitle },
    { description: s.teamDesc, id: 'team', title: s.teamTitle }
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
              setAllowedUsers(event.target.value)
              setError('')
            }}
            placeholder="5511999993977, 5511988880000"
            value={allowedUsers}
          />
          <span className={cn('mt-1.5 block', STEP_NOTE)}>{s.listHint}</span>
        </>
      ),
      id: 'list',
      title: s.listTitle
    },
    { description: s.approveDesc, id: 'approve', title: s.approveTitle }
  ]

  const connectStatus = linked
    ? linkedLabel
      ? q.linkedAs(linkedLabel)
      : q.deviceLinked
    : phase === 'waiting'
      ? s.waitingScan
      : setup?.status === 'installing'
        ? q.preparing
        : q.startingBridge

  const whoLine =
    audience === 'self'
      ? s.whoSelf
      : audience === 'solo'
        ? s.whoSolo
        : allowChoice === 'list'
          ? s.whoList(allowedUsers.split(',').filter(part => part.trim()).length)
          : s.whoApprove

  const tryIt =
    audience === 'self' ? s.tryItSelf : setup?.account_phone ? s.tryItBot(`+${setup.account_phone}`) : s.tryItBotUnknown

  const teamNote = s.talkNote(s.teamTitle)
  const [teamNoteBefore, teamNoteAfter] = teamNote.split(s.teamTitle)

  return (
    <StepsFrame current={step} slot="whatsapp-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: goConnect }} />
        </StepPanel>
      )}

      {step === 'connect' && (
        <StepPanel note={s.connectNote} title={s.connectTitle}>
          <div className="mt-[1.125rem] grid grid-cols-1 items-start gap-7 sm:grid-cols-[12.5rem_minmax(0,1fr)]">
            {linked ? (
              <div className="grid size-50 place-items-center rounded-[0.625rem] bg-emerald-500/12 text-emerald-500">
                <Check className="size-10" />
              </div>
            ) : qrDataUrl ? (
              <img alt={q.qrAlt} className="size-50 rounded-[0.625rem] bg-white p-3" src={qrDataUrl} />
            ) : (
              <div className="flex size-50 items-center justify-center rounded-[0.625rem] border border-(--ui-stroke-quaternary) p-4 text-center text-xs leading-5 text-(--ui-text-tertiary)">
                {error ? q.startFailed : q.waitingForQr}
              </div>
            )}

            <div className="min-w-0">
              <ol className="list-decimal space-y-2 pl-[1.125rem] text-[0.8125rem] leading-5 text-(--ui-text-secondary)">
                <li>
                  {s.connectStepLead}
                  {s.connectStepPath.split(' › ').map(part => (
                    <span key={part}>
                      {' › '}
                      <b className="font-medium text-foreground">{part}</b>
                    </span>
                  ))}
                  .
                </li>
                <li>{s.connectStep2}</li>
              </ol>

              {error ? (
                <p className="mt-4 flex flex-wrap items-center gap-x-2 text-[0.78rem] leading-5 text-destructive">
                  {error}
                  <Button onClick={() => void start()} size="inline" variant="link">
                    {c.tryAgain}
                  </Button>
                </p>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-[0.78rem] leading-5 text-(--ui-text-secondary)">
                  {linked ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Codicon name="loading" size="0.75rem" spinning />
                  )}
                  <span>{connectStatus}</span>
                </p>
              )}

              <p className={cn('mt-3.5', STEP_NOTE)}>
                {s.alreadyLinked}{' '}
                <button
                  className="text-(--ui-text-secondary) underline underline-offset-[3px] hover:text-foreground"
                  onClick={onAdvanced}
                  type="button"
                >
                  {s.advancedSetup}
                </button>
              </p>
            </div>
          </div>
          <StepFooter
            back={{ label: t.common.back, onClick: goBackToWho }}
            next={{
              disabled: phase !== 'connected',
              label: c.next,
              onClick: () => (audience === 'team' ? setStep('talk') : void finish())
            }}
          />
        </StepPanel>
      )}

      {step === 'talk' && (
        <StepPanel
          note={
            <>
              {teamNoteBefore}
              <b className="font-medium text-(--ui-text-secondary)">{s.teamTitle}</b>
              {teamNoteAfter}
            </>
          }
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
          {error && <p className="mt-3 text-xs leading-4 text-destructive">{error}</p>}
          <StepFooter
            back={{ label: t.common.back, onClick: () => setStep('connect') }}
            next={{ label: c.next, onClick: () => void finish() }}
          />
        </StepPanel>
      )}

      {step === 'ready' && (
        <div className="flex flex-col items-start">
          <span className="mb-3 grid size-10 place-items-center rounded-full bg-emerald-500 text-background">
            {phase === 'applying' ? <Codicon name="loading" size="1.1rem" spinning /> : <Check className="size-5" />}
          </span>
          <h2 className="text-[1.0625rem] font-semibold text-foreground">
            {phase === 'applying' ? s.readySaving : platformConnected ? s.readyTitle : s.readySetUp}
          </h2>
          <ul className="mt-3 grid gap-1.5 text-[0.8125rem] text-(--ui-text-secondary)">
            <ReadyLine done>{linkedLabel ? s.checkLinkedAs(linkedLabel) : s.checkLinked}</ReadyLine>
            {phase === 'applied' && <RestartLine restart={restart} scopeProfile={scopeProfile} />}
            <ReadyLine done>{whoLine}</ReadyLine>
          </ul>
          {phase === 'applied' && <p className={cn('mt-3.5', STEP_NOTE)}>{tryIt}</p>}
          <div className="mt-5 flex w-full items-center justify-end gap-2">
            {phase === 'applied' && chatUrl && (
              <Button onClick={() => openExternalLink(chatUrl)} size="sm" variant="outline">
                {s.sendTest}
              </Button>
            )}
            <Button disabled={phase === 'applying'} onClick={onDone} size="sm">
              {t.common.done}
            </Button>
          </div>
        </div>
      )}
    </StepsFrame>
  )
}
