import { type ProfileScope } from '@/api/client'
import { cancelGhLogin, type GhLoginPoll, type GhLoginStart, pollGhLogin, startGhLogin } from '@/api/system'

/** How often the dialog asks the backend whether GitHub approved the code. */
export const GH_LOGIN_POLL_MS = 2000

export interface GhCliLoginHandle {
  /** The code + URL to show; resolved as soon as the backend has them. */
  start: GhLoginStart
  /** Resolves with the final poll once the flow leaves `pending`. Rejects
   *  only on transport failure; denied/expired/error resolve so the caller
   *  can show the backend's message. */
  done: Promise<GhLoginPoll>
  /** Stop polling and tell the backend to drop the session. Idempotent. */
  cancel: () => Promise<void>
}

/**
 * Capabilities → MCP "GitHub CLI" Connect.
 *
 * Mirrors the provider device-code flow in store/onboarding.ts: start, hand the
 * code to the UI, open the verification page, poll until terminal. The token
 * never reaches the renderer — the backend hands it to `gh` directly.
 */
export async function connectGhCli(opts: {
  open: (url: string) => void | Promise<void>
  profile?: ProfileScope
  pollMs?: number
  setInterval?: typeof window.setInterval
  clearInterval?: typeof window.clearInterval
}): Promise<GhCliLoginHandle> {
  const start = await startGhLogin(opts.profile)
  const setTimer = opts.setInterval ?? window.setInterval.bind(window)
  const clearTimer = opts.clearInterval ?? window.clearInterval.bind(window)
  const pollMs = opts.pollMs ?? GH_LOGIN_POLL_MS

  let timer: null | number = null
  let settled = false
  let cancelled = false
  let inFlight = false
  let resolveDone!: (poll: GhLoginPoll) => void
  let rejectDone!: (err: unknown) => void

  const done = new Promise<GhLoginPoll>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })

  const stop = () => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  const tick = async () => {
    if (settled || cancelled || inFlight) {
      return
    }

    inFlight = true

    try {
      const poll = await pollGhLogin(start.session_id, opts.profile)

      if (settled || cancelled) {
        return
      }

      if (poll.status !== 'pending') {
        settled = true
        stop()
        resolveDone(poll)
      }
    } catch (err) {
      if (settled || cancelled) {
        return
      }

      settled = true
      stop()
      rejectDone(err)
    } finally {
      inFlight = false
    }
  }

  timer = setTimer(() => void tick(), pollMs)

  const cancel = async () => {
    if (cancelled) {
      return
    }

    cancelled = true
    stop()

    if (!settled) {
      settled = true
      resolveDone({
        session_id: start.session_id,
        status: 'error',
        error_message: 'cancelled',
        login: null,
        setup_git: null
      })
    }

    try {
      await cancelGhLogin(start.session_id, opts.profile)
    } catch {
      // Best effort: the backend session expires on its own.
    }
  }

  // Open after wiring the poller so a slow browser launch can't miss an
  // early approval; `open` failing must not strand the flow.
  try {
    await opts.open(start.verification_url)
  } catch {
    // The dialog shows the URL too — the user can open it by hand.
  }

  return { start, done, cancel }
}

/** True when a Connect attempt failed because `gh` is not on the backend
 *  host (the backend answers 409 `gh_missing`). */
export function isGhMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''

  return /gh_missing/.test(message)
}
