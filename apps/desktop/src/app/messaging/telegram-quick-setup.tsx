import { useEffect, useMemo, useState } from 'react'

import { StatusDot } from '@/components/status-dot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Check, ExternalLink, QrCode, Save, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { runGatewayRestart } from '@/store/system-actions'
import type { TelegramOnboardingStartResponse } from '@/types/work4you'
import {
  applyTelegramOnboarding,
  cancelTelegramOnboarding,
  getActionStatus,
  getTelegramOnboardingStatus,
  startTelegramOnboarding
} from '@/work4you'

import { TELEGRAM_USER_ID_RE } from './validate-env'

type Phase = 'applying' | 'idle' | 'ready' | 'starting' | 'waiting'

function formatExpiry(expiresAt: string): null | string {
  const ms = Date.parse(expiresAt) - Date.now()

  if (!Number.isFinite(ms) || ms <= 0) {
    return null
  }

  const seconds = Math.ceil(ms / 1000)

  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

/** 410 means the pairing was expired/claimed server-side — restartable, not retryable. */
function isTerminalOnboardingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return /\b410\b/.test(message) && /\b(expired|claimed|gone)\b/i.test(message)
}

/** `restart_started` only means the restart child spawned — not that it will
 *  succeed. Watch the action status briefly and surface a non-zero exit; in
 *  no-service installs the child becomes the foreground gateway and never
 *  exits, so "still running when we stop watching" counts as success. */
async function watchRestartOutcome(scopeProfile: null | string, onFailed: (exitCode: number) => void) {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500))

    try {
      const status = await getActionStatus('gateway-restart', 5, scopeProfile ?? undefined)

      if (status.running) {
        continue
      }

      if (status.exit_code !== 0 && status.exit_code !== null) {
        onFailed(status.exit_code)
      }

      return
    } catch {
      // transient fetch error; keep polling
    }
  }
}

/** QR-first Telegram onboarding, driving the same backend pairing flow as the
 *  web dashboard: start → poll until the user confirms in Telegram → pick the
 *  allowlist → one apply call that saves credentials, enables the platform,
 *  and restarts the gateway. */
export function TelegramQuickSetup({
  configured,
  onApplied,
  scopeProfile
}: {
  configured: boolean
  onApplied: () => void
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.telegramQuickSetup

  const [setup, setSetup] = useState<null | TelegramOnboardingStartResponse>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [botUsername, setBotUsername] = useState<null | string>(null)
  const [allowedIds, setAllowedIds] = useState<string[]>([])
  const [detectedOwnerId, setDetectedOwnerId] = useState<null | string>(null)
  const [newAllowedId, setNewAllowedId] = useState('')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

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
          setPhase('ready')
          setBotUsername(status.bot_username ?? null)
          setError('')

          if (status.owner_user_id && TELEGRAM_USER_ID_RE.test(status.owner_user_id)) {
            setDetectedOwnerId(status.owner_user_id)
            setAllowedIds([status.owner_user_id])
          }

          return
        }

        setError('')
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

  // Keep the expiry countdown moving while a pairing session is on screen.
  useEffect(() => {
    if (!setup) {
      return
    }

    const timer = setInterval(() => setTick(value => value + 1), 1000)

    return () => clearInterval(timer)
  }, [setup])

  const resetSetup = () => {
    setSetup(null)
    setQrDataUrl('')
    setPhase('idle')
    setBotUsername(null)
    setAllowedIds([])
    setDetectedOwnerId(null)
    setNewAllowedId('')
    setError('')
  }

  async function start() {
    setPhase('starting')
    setError('')
    setBotUsername(null)
    setAllowedIds([])
    setDetectedOwnerId(null)
    setNewAllowedId('')

    try {
      const res = await startTelegramOnboarding('Work4You')
      const { toDataURL } = await import('qrcode')
      const dataUrl = await toDataURL(res.qr_payload, { errorCorrectionLevel: 'M', margin: 1, width: 224 })
      setSetup(res)
      setQrDataUrl(dataUrl)
      setPhase('waiting')
    } catch (startError) {
      setPhase('idle')
      notifyError(startError, q.startFailed)
    }
  }

  async function cancel() {
    if (setup) {
      try {
        await cancelTelegramOnboarding(setup.pairing_id)
      } catch {
        // local cleanup still wins
      }
    }

    resetSetup()
  }

  function addAllowedId() {
    const trimmed = newAllowedId.trim()

    if (!TELEGRAM_USER_ID_RE.test(trimmed)) {
      setError(q.userIdMustBeNumeric)

      return
    }

    setError('')
    setAllowedIds(ids => (ids.includes(trimmed) ? ids : [...ids, trimmed]))
    setNewAllowedId('')
  }

  async function apply() {
    if (!setup) {
      return
    }

    if (allowedIds.length === 0) {
      setError(q.addAtLeastOne)

      return
    }

    setPhase('applying')
    setError('')

    try {
      const result = await applyTelegramOnboarding(setup.pairing_id, allowedIds, scopeProfile)
      resetSetup()

      if (result.restart_started) {
        notify({ kind: 'success', message: q.saved })
        void watchRestartOutcome(scopeProfile, exitCode =>
          notify({
            kind: 'error',
            message: q.restartFailedExit(exitCode),
            action: { label: m.restartGateway, onClick: () => void runGatewayRestart() }
          })
        )
      } else {
        const detail = result.restart_error ? `: ${result.restart_error}` : ''
        notify({
          kind: 'error',
          message: q.savedRestartFailed(detail),
          action: { label: m.restartGateway, onClick: () => void runGatewayRestart() }
        })
      }

      onApplied()
    } catch (applyError) {
      setPhase('ready')
      setError(applyError instanceof Error ? applyError.message : String(applyError))
    }
  }

  const expiresIn = useMemo(
    () => (setup ? formatExpiry(setup.expires_at) : null),
    // tick keeps the countdown fresh without recalculating on every render branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup, tick]
  )

  return (
    <section>
      <h4 className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {q.title}
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.66rem] font-medium normal-case tracking-normal text-primary">
          {q.recommended}
        </span>
      </h4>
      <p className="mt-1 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
        {q.intro}
      </p>
      {configured && phase === 'idle' && (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{q.replacesExisting}</p>
      )}

      {phase === 'idle' && (
        <div className="mt-3">
          <Button onClick={() => void start()} size="sm" variant="secondary">
            <QrCode />
            {q.createWithQr}
          </Button>
        </div>
      )}

      {phase === 'starting' && (
        <div className="mt-3">
          <Button disabled size="sm" variant="secondary">
            <QrCode />
            {q.starting}
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-xs leading-5 text-destructive">{error}</p>}

      {setup && qrDataUrl && (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <img alt={q.qrAlt} className="size-44 rounded-sm bg-white p-1.5" src={qrDataUrl} />
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.66rem] font-medium',
                expiresIn ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'
              )}
            >
              {expiresIn ? q.expiresIn(expiresIn) : q.expired}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            {phase === 'waiting' && (
              <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
                <StatusDot tone="warn" />
                {q.waiting}
              </p>
            )}

            {(phase === 'ready' || phase === 'applying') && (
              <>
                <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
                  <StatusDot tone="good" />
                  {q.ready}
                  {botUsername && <span className="font-mono text-foreground">@{botUsername}</span>}
                </p>

                <div>
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {q.allowedUsers}
                  </span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {allowedIds.map(id => (
                      <button
                        aria-label={q.removeUserAria(id)}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-foreground hover:bg-destructive/10 hover:text-destructive"
                        key={id}
                        onClick={() => setAllowedIds(ids => ids.filter(existing => existing !== id))}
                        type="button"
                      >
                        {id}
                        <X className="size-3" />
                      </button>
                    ))}
                    {detectedOwnerId && allowedIds.includes(detectedOwnerId) && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.66rem] font-medium text-primary">
                        {q.ownerDetected}
                      </span>
                    )}
                    {allowedIds.length === 0 && (
                      <span className="text-xs text-muted-foreground">{q.addAtLeastOne}</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      className="h-8 max-w-52 font-mono"
                      onChange={event => setNewAllowedId(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addAllowedId()
                        }
                      }}
                      placeholder={q.userIdPlaceholder}
                      value={newAllowedId}
                    />
                    <Button onClick={addAllowedId} size="sm" variant="ghost">
                      <Check />
                      {q.add}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={phase === 'applying'} onClick={() => void apply()} size="sm">
                    <Save />
                    {phase === 'applying' ? m.saving : q.saveAndRestart}
                  </Button>
                  <Button onClick={() => void cancel()} size="sm" variant="ghost">
                    {t.common.cancel}
                  </Button>
                </div>
              </>
            )}

            {phase === 'waiting' && (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => openExternalLink(setup.deep_link)} size="sm" variant="secondary">
                  <ExternalLink />
                  {q.openTelegram}
                </Button>
                <Button onClick={() => void cancel()} size="sm" variant="ghost">
                  {t.common.cancel}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
