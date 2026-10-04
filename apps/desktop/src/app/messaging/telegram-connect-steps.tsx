import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Check, ExternalLink } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { TelegramOnboardingStartResponse } from '@/types/work4you'
import {
  applyTelegramOnboarding,
  cancelTelegramOnboarding,
  getTelegramOnboardingStatus,
  startTelegramOnboarding,
  updateMessagingPlatform
} from '@/work4you'

import { splitList } from './channel-settings'
import {
  ChoiceList,
  type ChoiceOption,
  Marked,
  ReadyLine,
  ReadyView,
  restartAndWatch,
  RestartLine,
  type RestartState,
  splitAround,
  STEP_NOTE,
  StepField,
  StepFooter,
  StepPanel,
  StepsFrame,
  watchRestartOutcome
} from './channel-steps'
import { TELEGRAM_USER_ID_RE, validateMessagingEnv } from './validate-env'

/** Who the person said will use the bot: only them, or them and others. */
type Audience = 'me' | 'others'

/** How the bot comes to exist: Telegram's managed-bot QR (the default), or a
 *  token the person already got from @BotFather. */
type Method = 'qr' | 'token'

type Step = 'create' | 'ready' | 'talk' | 'who'

/** Who gets a reply on the token path when other people are let in: the ids
 *  on a list, or whoever messages, each approved by code. */
type AllowChoice = 'approve' | 'list'

// `created`: the bot exists and its token waits server-side for the save.
// `applied`: past the save — nothing polls any more.
type Phase = 'applied' | 'applying' | 'created' | 'idle' | 'starting' | 'waiting'

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

  return (/\b410\b/.test(message) && /\b(expired|claimed|gone)\b/i.test(message)) || /\b404\b/.test(message)
}

const firstInvalidId = (ids: string[]) => ids.find(id => !TELEGRAM_USER_ID_RE.test(id)) ?? null

/** The first connection of Telegram, one question per screen: who will use
 *  it, creating the bot (Telegram's QR, or a @BotFather token), who may talk
 *  to it, and a ready screen. The QR path is the same backend flow as before
 *  — start, poll until the person confirms in Telegram, one apply call that
 *  saves the token and the allowlist, enables the channel and restarts the
 *  gateway. The token path saves through the plain channel update. */
export function TelegramConnectSteps({
  onApplied,
  onDone,
  platformConnected,
  scopeProfile
}: {
  /** The setup was saved; the channel list should be refreshed. */
  onApplied: () => void
  /** Done on the ready screen. */
  onDone: () => void
  /** The channel list reports Telegram on and connected. */
  platformConnected: boolean
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.telegramQuickSetup
  const s = m.telegramPage
  const c = m.channelSteps
  const cs = m.channelSettings

  const [audience, setAudience] = useState<Audience | null>(null)
  const [method, setMethod] = useState<Method>('qr')
  const [step, setStep] = useState<Step>('who')
  const [setup, setSetup] = useState<null | TelegramOnboardingStartResponse>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [botUsername, setBotUsername] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [token, setToken] = useState('')
  const [ids, setIds] = useState('')
  const [allowChoice, setAllowChoice] = useState<AllowChoice>('list')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })
  const [, setTick] = useState(0)

  const created = method === 'qr' && (phase === 'created' || phase === 'applying' || phase === 'applied')
  // "Just me" through the QR needs no question: Telegram tells us who made
  // the bot. Asked only when it did not, or when the bot came from a token.
  const asksWho = audience === 'others' || method === 'token' || (created && !ownerId)

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'create', label: s.stepCreate },
      ...(asksWho ? [{ id: 'talk' as const, label: s.stepTalk }] : []),
      { id: 'ready', label: s.stepReady }
    ],
    [asksWho, s]
  )

  useEffect(() => {
    if (!setup || phase !== 'waiting') {
      return
    }

    let cancelled = false
    let timeout: null | ReturnType<typeof setTimeout> = null

    const poll = async () => {
      try {
        const status = await getTelegramOnboardingStatus(setup.pairing_id)

        if (cancelled) {
          return
        }

        if (status.status === 'ready') {
          const owner =
            status.owner_user_id && TELEGRAM_USER_ID_RE.test(status.owner_user_id) ? status.owner_user_id : ''

          setBotUsername(status.bot_username ?? '')
          setOwnerId(owner)
          setIds(current => current || owner)
          setPhase('created')
          setError('')

          return
        }

        timeout = setTimeout(() => void poll(), 2000)
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
  }, [phase, q.sessionExpired, setup])

  // Keep the expiry countdown moving while the QR is on screen.
  useEffect(() => {
    if (!setup || phase !== 'waiting') {
      return
    }

    const timer = setInterval(() => setTick(value => value + 1), 1000)

    return () => clearInterval(timer)
  }, [phase, setup])

  async function start() {
    setPhase('starting')
    setError('')
    setQrDataUrl('')

    try {
      const res = await startTelegramOnboarding('Work4You')
      const { toDataURL } = await import('qrcode')
      setQrDataUrl(await toDataURL(res.qr_payload, { errorCorrectionLevel: 'M', margin: 1, width: 224 }))
      setSetup(res)
      setPhase('waiting')
    } catch (startError) {
      setPhase('idle')
      setError(startError instanceof Error && startError.message ? startError.message : q.startFailed)
    }
  }

  /** Let the QR session go: the screen resets at once (a QR started right
   *  after must not be wiped by this one's late answer), the server is told
   *  in the background, and local cleanup wins if that fails. */
  function cancel() {
    const pairingId = setup?.pairing_id

    setSetup(null)
    setQrDataUrl('')
    setPhase('idle')
    setBotUsername('')
    setOwnerId('')

    if (pairingId) {
      void cancelTelegramOnboarding(pairingId).catch(() => undefined)
    }
  }

  function goCreate() {
    if (!audience) {
      return
    }

    setStep('create')
    setError('')

    // A bot already made (or a QR still on screen) survives going back to
    // change the answer — only an empty or expired session starts a new one.
    if (method === 'qr' && !setup) {
      void start()
    }
  }

  function switchToToken() {
    cancel()
    setMethod('token')
    setError('')
  }

  function switchToQr() {
    setMethod('qr')
    setError('')
    void start()
  }

  function afterCreate() {
    if (method === 'token') {
      const invalid = validateMessagingEnv('TELEGRAM_BOT_TOKEN', token)

      if (!token.trim() || invalid) {
        setError(m.envErrors.telegramToken)

        return
      }
    }

    setError('')

    if (asksWho) {
      setStep('talk')
    } else {
      void finish()
    }
  }

  /** The ids the save allows, or a message when the answer is not usable. */
  function allowedIds(): { error: string } | { ids: string[] } {
    if (audience === 'me') {
      const id = method === 'qr' && ownerId ? ownerId : ids.trim()

      if (!id) {
        return { error: s.idsRequired }
      }

      return TELEGRAM_USER_ID_RE.test(id) ? { ids: [id] } : { error: m.envErrors.telegramUserId(id) }
    }

    if (method === 'token' && allowChoice === 'approve') {
      return { ids: [] }
    }

    const list = splitList(ids)

    if (list.length === 0) {
      return { error: s.idsRequired }
    }

    const invalid = firstInvalidId(list)

    return invalid ? { error: m.envErrors.telegramUserId(invalid) } : { ids: Array.from(new Set(list)) }
  }

  /** The one save — token and allowlist, the channel on, the gateway
   *  restarted — then the ready screen reports on the restart. A failed save
   *  returns to the screen it left. */
  async function finish() {
    const allowed = allowedIds()

    if ('error' in allowed) {
      setError(allowed.error)

      return
    }

    const from = step

    setError('')
    setPhase('applying')
    setStep('ready')

    try {
      if (method === 'qr') {
        if (!setup) {
          throw new Error(q.sessionExpired)
        }

        const result = await applyTelegramOnboarding(setup.pairing_id, allowed.ids, scopeProfile)

        if (result.bot_username) {
          setBotUsername(result.bot_username)
        }

        setSetup(null)
        setPhase('applied')
        onApplied()

        if (result.restart_started) {
          setRestart({ outcome: 'pending' })
          setRestart(await watchRestartOutcome(scopeProfile))
        } else {
          setRestart({ detail: result.restart_error, outcome: 'none' })
        }

        return
      }

      await updateMessagingPlatform(
        'telegram',
        allowed.ids.length > 0
          ? { enabled: true, env: { TELEGRAM_ALLOWED_USERS: allowed.ids.join(','), TELEGRAM_BOT_TOKEN: token.trim() } }
          : { clear_env: ['TELEGRAM_ALLOWED_USERS'], enabled: true, env: { TELEGRAM_BOT_TOKEN: token.trim() } },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      setRestart(await restartAndWatch())
    } catch (applyError) {
      setPhase(method === 'qr' && setup ? 'created' : 'idle')
      setStep(from)
      setError(applyError instanceof Error ? applyError.message : String(applyError))
    }
  }

  const expiresIn = setup ? formatExpiry(setup.expires_at) : null
  const othersChosen = audience === 'others'

  const audienceOptions: ChoiceOption<Audience>[] = [
    { description: s.meDesc, id: 'me', title: s.meTitle },
    { description: s.othersDesc, id: 'others', title: s.othersTitle }
  ]

  const idsInput = (
    <Input
      aria-label={s.idsLabel}
      className="mt-2.5 h-8 font-mono text-[0.78rem]"
      onChange={event => {
        setIds(event.target.value)
        setError('')
      }}
      placeholder="123456789, 987654321"
      value={ids}
    />
  )

  const allowOptions: ChoiceOption<AllowChoice>[] = [
    { description: s.listDesc, extra: idsInput, id: 'list', title: cs.listTitle },
    { description: cs.approveDesc, id: 'approve', title: cs.approveTitle }
  ]

  const whoLine =
    audience === 'me'
      ? s.whoMe
      : method === 'token' && allowChoice === 'approve'
        ? s.whoApprove
        : s.whoList(new Set(splitList(ids)).size)

  const linkPieces = splitAround(s.createStep1, s.createStep1Link)
  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null

  return (
    <StepsFrame current={step} slot="telegram-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: goCreate }} />
        </StepPanel>
      )}

      {step === 'create' && method === 'qr' && (
        <StepPanel note={s.createNote} title={s.createTitle}>
          <div className="mt-[1.125rem] grid grid-cols-1 items-start gap-7 sm:grid-cols-[12.5rem_minmax(0,1fr)]">
            {created ? (
              <div className="grid size-50 place-items-center rounded-[0.625rem] bg-emerald-500/12 text-emerald-500">
                <Check className="size-10" />
              </div>
            ) : qrDataUrl ? (
              <img alt={q.qrAlt} className="size-50 rounded-[0.625rem] bg-white p-3" src={qrDataUrl} />
            ) : (
              <div className="flex size-50 items-center justify-center rounded-[0.625rem] border border-(--ui-stroke-quaternary) p-4 text-center text-xs leading-5 text-(--ui-text-tertiary)">
                {error ? q.startFailed : s.starting}
              </div>
            )}

            <div className="min-w-0">
              <ol className="list-decimal space-y-2 pl-[1.125rem] text-[0.8125rem] leading-5 text-(--ui-text-secondary)">
                <li>
                  {linkPieces && setup ? (
                    <>
                      {linkPieces[0]}
                      <button
                        className="text-(--ui-text-secondary) underline underline-offset-[3px] hover:text-foreground"
                        onClick={() => openExternalLink(setup.deep_link)}
                        type="button"
                      >
                        {linkPieces[1]}
                      </button>
                      {linkPieces[2]}
                    </>
                  ) : (
                    s.createStep1
                  )}
                </li>
                <li>
                  <Marked text={s.createStep2} />
                </li>
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
                  {created ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Codicon name="loading" size="0.75rem" spinning />
                  )}
                  <span>
                    {created
                      ? botUsername
                        ? s.created(botUsername)
                        : s.checkTokenSaved
                      : phase === 'waiting'
                        ? q.waiting
                        : s.starting}
                  </span>
                </p>
              )}

              {phase === 'waiting' && setup && (
                <div className="mt-3 flex items-center gap-2">
                  <Button onClick={() => openExternalLink(setup.deep_link)} size="sm" variant="outline">
                    <ExternalLink />
                    {q.openTelegram}
                  </Button>
                  <span className={STEP_NOTE}>{expiresIn ? q.expiresIn(expiresIn) : q.expired}</span>
                </div>
              )}

              {!created && (
                <p className={cn('mt-3.5', STEP_NOTE)}>
                  {s.haveToken}{' '}
                  <button
                    className="text-(--ui-text-secondary) underline underline-offset-[3px] hover:text-foreground"
                    onClick={switchToToken}
                    type="button"
                  >
                    {s.useToken}
                  </button>
                </p>
              )}
            </div>
          </div>
          <StepFooter
            back={{ label: t.common.back, onClick: () => setStep('who') }}
            next={{ disabled: !created, label: c.next, onClick: afterCreate }}
          />
        </StepPanel>
      )}

      {step === 'create' && method === 'token' && (
        <StepPanel note={s.tokenNote} title={s.tokenTitle}>
          <StepField
            label={s.tokenLabel}
            onChange={event => {
              setToken(event.target.value)
              setError('')
            }}
            placeholder="123456789:AA…"
            type="password"
            value={token}
          />
          {errorLine}
          <p className={cn('mt-3.5', STEP_NOTE)}>
            <button
              className="text-(--ui-text-secondary) underline underline-offset-[3px] hover:text-foreground"
              onClick={switchToQr}
              type="button"
            >
              {s.useQr}
            </button>
          </p>
          <StepFooter
            back={{ label: t.common.back, onClick: () => setStep('who') }}
            next={{ disabled: !token.trim(), label: c.next, onClick: afterCreate }}
          />
        </StepPanel>
      )}

      {step === 'talk' && audience === 'me' && (
        <StepPanel note={s.meIdNote} title={s.meIdTitle}>
          <StepField
            label={s.meIdLabel}
            onChange={event => {
              setIds(event.target.value)
              setError('')
            }}
            placeholder="123456789"
            value={ids}
          />
          {errorLine}
          <StepFooter
            back={{ label: t.common.back, onClick: () => setStep('create') }}
            next={{ label: c.next, onClick: () => void finish() }}
          />
        </StepPanel>
      )}

      {step === 'talk' && othersChosen && (
        <StepPanel
          note={
            <Marked
              className="text-(--ui-text-secondary)"
              text={(method === 'qr' ? s.talkNoteList : s.talkNote)(s.othersTitle)}
            />
          }
          title={s.talkTitle}
        >
          {method === 'qr' ? (
            <StepField
              help={
                ownerId ? <Marked className="text-(--ui-text-secondary)" text={s.listOwnerHint(ownerId)} /> : s.listHint
              }
              label={s.idsLabel}
              onChange={event => {
                setIds(event.target.value)
                setError('')
              }}
              placeholder="123456789, 987654321"
              value={ids}
            />
          ) : (
            <ChoiceList
              label={s.talkTitle}
              onChange={choice => {
                setAllowChoice(choice)
                setError('')
              }}
              options={allowOptions}
              value={allowChoice}
            />
          )}
          {errorLine}
          <StepFooter
            back={{ label: t.common.back, onClick: () => setStep('create') }}
            next={{ label: c.next, onClick: () => void finish() }}
          />
        </StepPanel>
      )}

      {step === 'ready' && (
        <ReadyView
          busy={phase === 'applying'}
          footer={
            <>
              {phase === 'applied' && botUsername && (
                <Button onClick={() => openExternalLink(`https://t.me/${botUsername}`)} size="sm" variant="outline">
                  <ExternalLink />
                  {s.openInTelegram}
                </Button>
              )}
              <Button disabled={phase === 'applying'} onClick={onDone} size="sm">
                {t.common.done}
              </Button>
            </>
          }
          note={phase === 'applied' ? <Marked className="text-(--ui-text-secondary)" text={s.tryIt} /> : undefined}
          title={phase === 'applying' ? s.readySaving : platformConnected ? s.readyTitle : s.readySetUp}
        >
          <ReadyLine done>
            {method === 'qr' && botUsername ? <Marked text={s.checkCreated(botUsername)} /> : s.checkTokenSaved}
          </ReadyLine>
          {phase === 'applied' && <RestartLine restart={restart} />}
          <ReadyLine done>{whoLine}</ReadyLine>
        </ReadyView>
      )}
    </StepsFrame>
  )
}
