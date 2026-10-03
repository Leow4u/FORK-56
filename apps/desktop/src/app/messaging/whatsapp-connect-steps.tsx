import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { StatusDot } from '@/components/status-dot'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Check, ExternalLink, RefreshCw } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { runGatewayRestart } from '@/store/system-actions'
import type { WhatsAppOnboardingMode, WhatsAppOnboardingStatusResponse } from '@/types/work4you'
import {
  applyWhatsAppOnboarding,
  cancelWhatsAppOnboarding,
  getActionStatus,
  getWhatsAppOnboardingStatus,
  startWhatsAppOnboarding
} from '@/work4you'

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

interface RestartState {
  detail?: string
  exitCode?: number
  /** `none`: the save went through but no restart was spawned. */
  outcome: 'failed' | 'none' | 'ok' | 'pending'
}

const CAPTION = 'text-xs leading-5 text-muted-foreground'

function formatExpiry(expiresAt: string): null | string {
  const ms = Date.parse(expiresAt) - Date.now()

  if (!Number.isFinite(ms) || ms <= 0) {
    return null
  }

  const seconds = Math.ceil(ms / 1000)

  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

/** 404/410 mean the pairing is gone server-side — restartable, not retryable. */
function isTerminalOnboardingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return (/\b410\b/.test(message) && /\b(expired|gone)\b/i.test(message)) || /\b404\b/.test(message)
}

/** `restart_started` only means the restart child spawned — not that it will
 *  succeed. Watch the action status briefly and surface a non-zero exit; in
 *  no-service installs the child becomes the foreground gateway and never
 *  exits, so "still running when we stop watching" counts as success. */
async function watchRestartOutcome(scopeProfile: null | string): Promise<RestartState> {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500))

    try {
      const status = await getActionStatus('gateway-restart', 5, scopeProfile ?? undefined)

      if (status.running) {
        continue
      }

      if (status.exit_code !== 0 && status.exit_code !== null) {
        return { exitCode: status.exit_code, outcome: 'failed' }
      }

      return { outcome: 'ok' }
    } catch {
      // transient fetch error; keep polling
    }
  }

  return { outcome: 'ok' }
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
  savedMode,
  scopeProfile
}: {
  /** "Already linked another way": the person wants the raw settings. */
  onAdvanced: () => void
  /** The setup was saved; the channel list should be refreshed. */
  onApplied: () => void
  /** Done on the ready screen. */
  onDone: () => void
  savedMode?: null | string
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.whatsappQuickSetup
  const s = m.whatsappSteps

  const [audience, setAudience] = useState<Audience | null>(savedMode === 'self-chat' ? 'self' : null)
  const [step, setStep] = useState<Step>('who')
  const [setup, setSetup] = useState<null | WhatsAppOnboardingStatusResponse>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [allowChoice, setAllowChoice] = useState<AllowChoice>('list')
  const [allowedUsers, setAllowedUsers] = useState('')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
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

  // Keep the expiry countdown moving while a pairing session is on screen.
  useEffect(() => {
    if (!setup || !polling) {
      return
    }

    const timer = setInterval(() => setTick(value => value + 1), 1000)

    return () => clearInterval(timer)
  }, [polling, setup])

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

  const expiresIn = useMemo(
    () => (setup ? formatExpiry(setup.expires_at) : null),
    // tick keeps the countdown fresh without recalculating on every render branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup, tick]
  )

  const linkedLabel = setup?.account_phone ? `+${setup.account_phone}` : setup?.account_name || setup?.account_id || ''
  const chatUrl = setup?.account_phone ? `https://wa.me/${setup.account_phone}` : ''
  const stepIndex = steps.findIndex(entry => entry.id === step)

  const audienceOptions: ChoiceOption<Audience>[] = [
    { description: s.selfDesc, id: 'self', title: s.selfTitle },
    { description: s.soloDesc, id: 'solo', title: s.soloTitle },
    { description: s.teamDesc, id: 'team', title: s.teamTitle }
  ]

  const allowOptions: ChoiceOption<AllowChoice>[] = [
    {
      description: s.listDesc,
      extra: (
        <div className="mt-2 grid gap-1.5">
          <Input
            aria-label={s.listTitle}
            className="h-8 max-w-96 font-mono"
            onChange={event => {
              setAllowedUsers(event.target.value)
              setError('')
            }}
            placeholder={q.allowedUsersPlaceholder}
            value={allowedUsers}
          />
          <span className={CAPTION}>{s.listHint}</span>
        </div>
      ),
      id: 'list',
      title: s.listTitle
    },
    { description: s.approveDesc, id: 'approve', title: s.approveTitle }
  ]

  const connectStatus =
    phase === 'connected' || phase === 'applying' || phase === 'applied'
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

  return (
    <section className="space-y-4" data-slot="whatsapp-connect-steps">
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {steps.map((entry, index) => {
          const state = entry.id === step ? 'active' : index < stepIndex ? 'done' : 'todo'

          return (
            <li
              aria-current={state === 'active' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5',
                state === 'active' ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
              key={entry.id}
            >
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-full text-[0.66rem] tabular-nums',
                  state === 'active' && 'bg-primary text-primary-foreground',
                  state === 'done' && 'bg-primary/10 text-primary',
                  state === 'todo' && 'bg-(--ui-bg-tertiary) text-muted-foreground'
                )}
              >
                {state === 'done' ? <Check className="size-3" /> : index + 1}
              </span>
              {entry.label}
            </li>
          )
        })}
      </ol>

      <div className="rounded-xl border border-(--ui-stroke-quaternary) p-5">
        {step === 'who' && (
          <StepPanel note={s.whoNote} title={s.whoTitle}>
            <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
            <StepFooter next={{ disabled: !audience, label: s.next, onClick: goConnect }} />
          </StepPanel>
        )}

        {step === 'connect' && (
          <StepPanel note={s.connectNote} title={s.connectTitle}>
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex flex-col items-center gap-2">
                {phase === 'connected' ? (
                  <div className="grid size-44 place-items-center rounded-sm bg-primary/10 text-primary">
                    <Check className="size-8" />
                  </div>
                ) : qrDataUrl ? (
                  <img alt={q.qrAlt} className="size-44 rounded-sm bg-white p-1.5" src={qrDataUrl} />
                ) : (
                  <div className="flex size-44 items-center justify-center rounded-sm border border-(--ui-stroke-quaternary) bg-muted/40 p-3 text-center text-xs leading-5 text-muted-foreground">
                    {error ? q.startFailed : q.waitingForQr}
                  </div>
                )}
                {setup && polling && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.66rem] font-medium',
                      expiresIn ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {expiresIn ? q.expiresIn(expiresIn) : q.expired}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 basis-64 space-y-3">
                <ol className={cn('list-decimal space-y-1 pl-5', CAPTION)}>
                  <li>{s.connectStep1}</li>
                  <li>{s.connectStep2}</li>
                </ol>
                {error ? (
                  <p className="flex flex-wrap items-center gap-x-2 text-xs leading-5 text-destructive">
                    {error}
                    <Button onClick={() => void start()} size="inline" variant="link">
                      {s.tryAgain}
                    </Button>
                  </p>
                ) : (
                  <p className={cn('flex items-center gap-2', CAPTION)}>
                    {phase === 'connected' ? (
                      <StatusDot tone="good" />
                    ) : (
                      <Codicon name="loading" size="0.75rem" spinning />
                    )}
                    <span>
                      {connectStatus}
                      {phase === 'connected' && chatUrl && (
                        <button
                          className="ml-2 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                          onClick={() => openExternalLink(chatUrl)}
                          type="button"
                        >
                          {q.openChatLink}
                          <ExternalLink className="size-3" />
                        </button>
                      )}
                    </span>
                  </p>
                )}
                <p className={CAPTION}>
                  {s.alreadyLinked}{' '}
                  <Button onClick={onAdvanced} size="inline" variant="link">
                    {s.advancedSetup}
                  </Button>
                </p>
              </div>
            </div>
            <StepFooter
              back={{ label: t.common.back, onClick: goBackToWho }}
              next={{
                disabled: phase !== 'connected',
                label: s.next,
                onClick: () => (audience === 'team' ? setStep('talk') : void finish())
              }}
            />
          </StepPanel>
        )}

        {step === 'talk' && (
          <StepPanel note={s.talkNote} title={s.talkTitle}>
            <ChoiceList
              label={s.talkTitle}
              onChange={choice => {
                setAllowChoice(choice)
                setError('')
              }}
              options={allowOptions}
              value={allowChoice}
            />
            {error && <p className="text-xs leading-5 text-destructive">{error}</p>}
            <StepFooter
              back={{ label: t.common.back, onClick: () => setStep('connect') }}
              next={{ label: s.next, onClick: () => void finish() }}
            />
          </StepPanel>
        )}

        {step === 'ready' && (
          <div className="space-y-4">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              {phase === 'applying' ? <Codicon name="loading" size="1.1rem" spinning /> : <Check className="size-5" />}
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {phase === 'applying' ? s.readySaving : s.readyTitle}
            </h2>
            <ul className="grid gap-1.5 text-xs leading-5 text-foreground">
              <ReadyLine done>{linkedLabel ? s.checkLinkedAs(linkedLabel) : s.checkLinked}</ReadyLine>
              <ReadyLine done={phase === 'applied'}>{s.checkSaved}</ReadyLine>
              {phase === 'applied' && (
                <ReadyLine
                  done={restart.outcome === 'ok'}
                  failed={restart.outcome !== 'ok' && restart.outcome !== 'pending'}
                >
                  {restart.outcome === 'ok'
                    ? s.checkRestarted
                    : restart.outcome === 'pending'
                      ? s.checkRestarting
                      : restart.outcome === 'failed'
                        ? s.checkRestartFailed(restart.exitCode ?? 1)
                        : s.checkRestartNotStarted(restart.detail ? `: ${restart.detail}` : '')}
                  {(restart.outcome === 'failed' || restart.outcome === 'none') && (
                    <Button className="ml-2" onClick={() => void runGatewayRestart()} size="xs" variant="secondary">
                      <RefreshCw />
                      {m.restartGateway}
                    </Button>
                  )}
                </ReadyLine>
              )}
              <ReadyLine done>{whoLine}</ReadyLine>
            </ul>
            {phase === 'applied' && (
              <p className={CAPTION}>
                {tryIt}
                {audience !== 'self' && chatUrl && (
                  <button
                    className="ml-2 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    onClick={() => openExternalLink(chatUrl)}
                    type="button"
                  >
                    {q.openChatLink}
                    <ExternalLink className="size-3" />
                  </button>
                )}
              </p>
            )}
            <StepFooter next={{ disabled: phase === 'applying', label: t.common.done, onClick: onDone }} />
          </div>
        )}
      </div>
    </section>
  )
}

interface ChoiceOption<T extends string> {
  description: string
  /** Shown under the option while it is selected (an input, a hint). Kept
   *  outside the option's button so the control stays its own element. */
  extra?: ReactNode
  id: T
  title: string
}

function ChoiceList<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string
  onChange: (id: T) => void
  options: ChoiceOption<T>[]
  value: null | T
}) {
  return (
    <div aria-label={label} className="grid gap-1.5" role="radiogroup">
      {options.map(option => {
        const selected = option.id === value

        return (
          <div
            className={cn(
              'rounded-lg px-3 py-2.5',
              selected
                ? 'bg-(--ui-sidebar-surface-background) ring-1 ring-(--ui-stroke-secondary) ring-inset'
                : 'hover:bg-(--ui-sidebar-surface-background)'
            )}
            key={option.id}
          >
            <button
              aria-checked={selected}
              className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-left"
              onClick={() => onChange(option.id)}
              role="radio"
              type="button"
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 grid size-4 place-items-center rounded-full border',
                  selected ? 'border-primary' : 'border-(--ui-stroke-secondary)'
                )}
              >
                {selected && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{option.title}</span>
                <span className={cn('block', CAPTION)}>{option.description}</span>
              </span>
            </button>
            {selected && option.extra ? <div className="pl-7">{option.extra}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

function StepPanel({ children, note, title }: { children: ReactNode; note: string; title: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className={cn('mt-1', CAPTION)}>{note}</p>
      </div>
      {children}
    </div>
  )
}

function StepFooter({
  back,
  next
}: {
  back?: { label: string; onClick: () => void }
  next: { disabled?: boolean; label: string; onClick: () => void }
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {back && (
        <Button onClick={back.onClick} size="sm" variant="ghost">
          {back.label}
        </Button>
      )}
      <span className="flex-1" />
      <Button disabled={next.disabled} onClick={next.onClick} size="sm">
        {next.label}
      </Button>
    </div>
  )
}

function ReadyLine({ children, done, failed = false }: { children: ReactNode; done: boolean; failed?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {failed ? (
        <StatusDot className="size-2" tone="bad" />
      ) : done ? (
        <Check className="size-3.5 text-primary" />
      ) : (
        <Codicon name="loading" size="0.8rem" spinning />
      )}
      <span className="flex flex-wrap items-center">{children}</span>
    </li>
  )
}
