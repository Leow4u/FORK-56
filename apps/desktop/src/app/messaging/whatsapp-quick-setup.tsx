import { useEffect, useMemo, useState } from 'react'

import { StatusDot } from '@/components/status-dot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, QrCode, Save } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
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

// `preparing` covers the backend's `installing` (first-run npm install of the
// bundled bridge, can take minutes) and `starting` (bridge boot) statuses —
// both mean "no QR yet, keep polling".
type Phase = 'applying' | 'connected' | 'idle' | 'preparing' | 'starting' | 'waiting'

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

/** QR-first WhatsApp onboarding, driving the same backend flow as the web
 *  dashboard: start spawns the bundled Node.js bridge → poll streams the
 *  Linked Devices QR → the user scans it → one apply call that saves the
 *  mode/allowlist, enables the platform, and restarts the gateway. When a
 *  session already exists on disk, start reports the linked account
 *  immediately and the flow skips straight to save. */
export function WhatsAppQuickSetup({
  allowedUsersSet,
  configured,
  onApplied,
  savedMode,
  scopeProfile
}: {
  allowedUsersSet: boolean
  configured: boolean
  onApplied: () => void
  savedMode?: null | string
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.whatsappQuickSetup

  const [setup, setSetup] = useState<null | WhatsAppOnboardingStatusResponse>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [mode, setMode] = useState<WhatsAppOnboardingMode>(savedMode === 'self-chat' ? 'self-chat' : 'bot')
  const [allowedUsers, setAllowedUsers] = useState('')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const polling = phase === 'preparing' || phase === 'waiting'

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
          const { toDataURL } = await import('qrcode')
          const dataUrl = await toDataURL(status.qr_payload, { errorCorrectionLevel: 'M', margin: 1, width: 224 })

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
    if (!setup || phase === 'connected' || phase === 'applying') {
      return
    }

    const timer = setInterval(() => setTick(value => value + 1), 1000)

    return () => clearInterval(timer)
  }, [phase, setup])

  const resetSetup = () => {
    setSetup(null)
    setQrDataUrl('')
    setPhase('idle')
    setError('')
  }

  function validateAllowedUsers(): boolean {
    const invalid = findInvalidWhatsAppUser(allowedUsers)

    if (invalid) {
      setError(m.envErrors.whatsappNumber(invalid))

      return false
    }

    return true
  }

  async function start() {
    if (!validateAllowedUsers()) {
      return
    }

    setPhase('starting')
    setError('')
    setQrDataUrl('')

    try {
      const res = await startWhatsAppOnboarding(mode, allowedUsers, scopeProfile)
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
        const { toDataURL } = await import('qrcode')
        const dataUrl = await toDataURL(res.qr_payload, { errorCorrectionLevel: 'M', margin: 1, width: 224 })
        setQrDataUrl(dataUrl)
        setPhase('waiting')

        return
      }

      setPhase('preparing')
    } catch (startError) {
      setPhase('idle')
      notifyError(startError, q.startFailed)
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

  async function apply() {
    if (!setup) {
      return
    }

    if (!validateAllowedUsers()) {
      return
    }

    setPhase('applying')
    setError('')

    try {
      const result = await applyWhatsAppOnboarding(
        setup.pairing_id,
        { allowed_users: allowedUsers, mode },
        scopeProfile
      )

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
      setPhase('connected')
      setError(applyError instanceof Error ? applyError.message : String(applyError))
    }
  }

  const expiresIn = useMemo(
    () => (setup ? formatExpiry(setup.expires_at) : null),
    // tick keeps the countdown fresh without recalculating on every render branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup, tick]
  )

  const linkedLabel = setup?.account_phone
    ? `+${setup.account_phone}`
    : setup?.account_name || setup?.account_id || ''

  const chatUrl = setup?.account_phone ? `https://wa.me/${setup.account_phone}` : ''

  const allowlistNote = !allowedUsers.trim()
    ? mode === 'self-chat'
      ? allowedUsersSet
        ? q.allowKeepSaved
        : q.allowSelfChatAuto
      : allowedUsersSet
        ? q.allowKeepSaved
        : q.allowPairingFallback
    : q.allowPairingFallback

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

      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3">
        <div>
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {q.modeLabel}
          </span>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              disabled={phase !== 'idle' && phase !== 'connected'}
              onClick={() => setMode('bot')}
              size="sm"
              variant={mode === 'bot' ? 'secondary' : 'ghost'}
            >
              {q.modeBot}
            </Button>
            <Button
              disabled={phase !== 'idle' && phase !== 'connected'}
              onClick={() => setMode('self-chat')}
              size="sm"
              variant={mode === 'self-chat' ? 'secondary' : 'ghost'}
            >
              {q.modeSelfChat}
            </Button>
          </div>
          <p className="mt-1.5 max-w-72 text-xs leading-5 text-muted-foreground">
            {mode === 'bot' ? q.modeBotHelp : q.modeSelfChatHelp}
          </p>
        </div>

        <div className="min-w-0 flex-1 basis-64">
          <label
            className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            htmlFor="whatsapp-quick-allowed-users"
          >
            {q.allowedUsersLabel}
          </label>
          <Input
            className="mt-1.5 h-8 max-w-96 font-mono"
            disabled={phase === 'applying'}
            id="whatsapp-quick-allowed-users"
            onChange={event => {
              setAllowedUsers(event.target.value)
              setError('')
            }}
            placeholder={q.allowedUsersPlaceholder}
            value={allowedUsers}
          />
          <p className="mt-1.5 max-w-96 text-xs leading-5 text-muted-foreground">{allowlistNote}</p>
        </div>
      </div>

      {phase === 'idle' && (
        <div className="mt-3">
          <Button onClick={() => void start()} size="sm" variant="secondary">
            <QrCode />
            {q.pairWithQr}
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

      {/* Idle/pairing errors sit under the controls they block; connected-phase
          errors render next to the save controls below. */}
      {error && phase !== 'connected' && phase !== 'applying' && (
        <p className="mt-2 text-xs leading-5 text-destructive">{error}</p>
      )}

      {setup && polling && (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            {qrDataUrl ? (
              <img alt={q.qrAlt} className="size-44 rounded-sm bg-white p-1.5" src={qrDataUrl} />
            ) : (
              <div className="flex size-44 items-center justify-center rounded-sm border border-border bg-muted/40 p-3 text-center text-xs leading-5 text-muted-foreground">
                {q.waitingForQr}
              </div>
            )}
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
            <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
              <StatusDot tone="warn" />
              {phase === 'waiting' ? q.waiting : setup.status === 'installing' ? q.preparing : q.startingBridge}
            </p>
            {phase === 'waiting' && <p className="text-xs leading-5 text-muted-foreground">{q.scanHint}</p>}
            <div>
              <Button onClick={() => void cancel()} size="sm" variant="ghost">
                {t.common.cancel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {setup && (phase === 'connected' || phase === 'applying') && (
        <div className="mt-3 space-y-3">
          <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
            <StatusDot tone="good" />
            <span>
              {linkedLabel ? q.linkedAs(linkedLabel) : q.deviceLinked}
              {chatUrl && (
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

          <ol className="list-decimal space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
            <li>{q.stepSaveRestart}</li>
            <li>{mode === 'self-chat' ? q.stepMessageSelf : q.stepMessageBot}</li>
            <li>{allowlistNote}</li>
          </ol>

          {error && <p className="text-xs leading-5 text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={phase === 'applying'} onClick={() => void apply()} size="sm">
              <Save />
              {phase === 'applying' ? m.saving : q.saveAndRestart}
            </Button>
            <Button disabled={phase === 'applying'} onClick={() => void cancel()} size="sm" variant="ghost">
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
