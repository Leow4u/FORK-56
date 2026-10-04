/**
 * Long-polls the manager bot's updates. Polling, not a webhook, so the service
 * works before its domain does, and needs no inbound secret.
 *
 * Telegram hands each update to one getUpdates consumer: two machines polling
 * the same manager bot would split the updates (and trade 409s), and a pairing
 * lives in the memory of the machine that created it. Run exactly one.
 */
import { TelegramApiError, type TelegramPort, type TelegramUpdate } from './telegram.js'
import type { UpdateLoopState } from './setup.js'

/** Seconds Telegram holds a getUpdates call open when nothing happens. */
export const LONG_POLL_SECONDS = 50

const MAX_BACKOFF_MS = 30_000
const CONFLICT_BACKOFF_MS = 5_000
const BAD_TOKEN_BACKOFF_MS = 60_000

export interface UpdateLoopOptions {
  telegram: TelegramPort
  onUpdate: (update: TelegramUpdate) => Promise<void>
  signal: AbortSignal
  state?: UpdateLoopState
  now?: () => number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

function sleepFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

export function backoffMs(err: unknown, failures: number): number {
  if (err instanceof TelegramApiError) {
    if (err.retryAfter) return err.retryAfter * 1000
    if (err.code === 409) return CONFLICT_BACKOFF_MS
    if (err.code === 401 || err.code === 404) return BAD_TOKEN_BACKOFF_MS
  }
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, failures - 1))
}

function log(message: string): void {
  console.log(`[work4you-telegram-setup] ${message}`)
}

export async function runUpdateLoop(opts: UpdateLoopOptions): Promise<void> {
  const { telegram, onUpdate, signal } = opts
  const state = opts.state ?? { running: false, lastPollAt: null, lastError: null }
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? sleepFor
  let offset: number | undefined
  // getUpdates refuses to run while a webhook is set on the bot.
  let webhookCleared = false
  let failures = 0

  state.running = true
  try {
    while (!signal.aborted) {
      try {
        if (!webhookCleared) {
          await telegram.deleteWebhook()
          webhookCleared = true
        }
        const updates = await telegram.getUpdates(
          { offset, timeout: LONG_POLL_SECONDS, allowed_updates: ['managed_bot'] },
          signal,
        )
        if (failures > 0) log('getUpdates is working again')
        failures = 0
        state.lastPollAt = now()
        state.lastError = null
        for (const update of updates) {
          offset = Math.max(offset ?? 0, update.update_id + 1)
          try {
            await onUpdate(update)
          } catch (err) {
            log(`update ${update.update_id}: ${err instanceof Error ? err.message : 'failed'}`)
          }
        }
      } catch (err) {
        if (signal.aborted) break
        failures += 1
        const message = err instanceof Error ? err.message : 'getUpdates failed'
        state.lastError = message
        if (err instanceof TelegramApiError && err.code === 409) {
          // A webhook was set again, or another process polls this bot.
          webhookCleared = false
          log(`${message} — only one process may poll the manager bot`)
        } else if (failures === 1 || failures % 10 === 0) {
          log(message)
        }
        await sleep(backoffMs(err, failures), signal)
      }
    }
  } finally {
    state.running = false
  }
}
