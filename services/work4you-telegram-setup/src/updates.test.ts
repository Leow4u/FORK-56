import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TelegramApiError, type GetUpdatesParams, type TelegramPort, type TelegramUpdate } from './telegram.js'
import { LONG_POLL_SECONDS, backoffMs, runUpdateLoop } from './updates.js'

type Step = TelegramUpdate[] | Error

/** A Bot API that answers getUpdates from a script, then stops the loop. */
class ScriptedTelegram implements TelegramPort {
  calls: string[] = []
  polls: GetUpdatesParams[] = []

  constructor(
    private steps: Step[],
    private readonly stop: AbortController,
  ) {}

  async getMe(): Promise<never> {
    throw new Error('not used')
  }

  async deleteWebhook(): Promise<void> {
    this.calls.push('deleteWebhook')
  }

  async getUpdates(params: GetUpdatesParams): Promise<TelegramUpdate[]> {
    this.calls.push('getUpdates')
    this.polls.push(params)
    const step = this.steps.shift()
    if (this.steps.length === 0) this.stop.abort()
    if (!step) return []
    if (step instanceof Error) throw step
    return step
  }

  async getManagedBotToken(): Promise<never> {
    throw new Error('not used')
  }
}

function managed(updateId: number, username: string): TelegramUpdate {
  return {
    update_id: updateId,
    managed_bot: {
      user: { id: 10, is_bot: false, first_name: 'Ana' },
      bot: { id: 20 + updateId, is_bot: true, first_name: 'Work4You', username },
    },
  }
}

test('the loop clears any webhook, asks only for managed_bot updates and acknowledges each one', async () => {
  const stop = new AbortController()
  const telegram = new ScriptedTelegram([[managed(5, 'a_bot'), managed(6, 'b_bot')], [], [managed(9, 'c_bot')]], stop)
  const seen: number[] = []
  const state = { running: false, lastPollAt: null, lastError: null }

  await runUpdateLoop({
    telegram,
    onUpdate: async (update) => {
      seen.push(update.update_id)
    },
    signal: stop.signal,
    state,
    sleep: async () => {},
  })

  assert.deepEqual(telegram.calls, ['deleteWebhook', 'getUpdates', 'getUpdates', 'getUpdates'])
  assert.deepEqual(seen, [5, 6, 9])
  assert.deepEqual(
    telegram.polls.map((p) => p.offset),
    [undefined, 7, 7],
  )
  for (const params of telegram.polls) {
    assert.deepEqual(params.allowed_updates, ['managed_bot'])
    assert.equal(params.timeout, LONG_POLL_SECONDS)
  }
  assert.equal(state.running, false)
})

test('an update that fails to apply does not stop the loop or get replayed', async () => {
  const stop = new AbortController()
  const telegram = new ScriptedTelegram([[managed(1, 'a_bot'), managed(2, 'b_bot')], []], stop)
  const seen: number[] = []

  await runUpdateLoop({
    telegram,
    onUpdate: async (update) => {
      seen.push(update.update_id)
      if (update.update_id === 1) throw new Error('boom')
    },
    signal: stop.signal,
    sleep: async () => {},
  })

  assert.deepEqual(seen, [1, 2])
  assert.equal(telegram.polls[1].offset, 3)
})

test('a 409 clears the webhook again and waits before polling', async () => {
  const stop = new AbortController()
  const conflict = new TelegramApiError(
    'getUpdates',
    409,
    "Conflict: can't use getUpdates method while webhook is active",
  )
  const telegram = new ScriptedTelegram([conflict, []], stop)
  const waits: number[] = []
  const state = { running: false, lastPollAt: null as number | null, lastError: null as string | null }

  await runUpdateLoop({
    telegram,
    onUpdate: async () => {},
    signal: stop.signal,
    state,
    now: () => 1234,
    sleep: async (ms) => {
      waits.push(ms)
    },
  })

  assert.deepEqual(telegram.calls, ['deleteWebhook', 'getUpdates', 'deleteWebhook', 'getUpdates'])
  assert.deepEqual(waits, [5_000])
  assert.equal(state.lastError, null, 'a later good poll clears the error')
  assert.equal(state.lastPollAt, 1234)
})

test('backoff follows Telegram, then grows to a cap', () => {
  assert.equal(backoffMs(new TelegramApiError('getUpdates', 429, 'Too Many Requests', 7), 1), 7_000)
  assert.equal(backoffMs(new TelegramApiError('getUpdates', 401, 'Unauthorized'), 1), 60_000)
  assert.equal(backoffMs(new TelegramApiError('getUpdates', 0, 'network error'), 1), 1_000)
  assert.equal(backoffMs(new Error('anything'), 3), 4_000)
  assert.equal(backoffMs(new Error('anything'), 50), 30_000)
})

test('aborting stops a waiting loop', async () => {
  const stop = new AbortController()
  const telegram: TelegramPort = {
    getMe: async () => {
      throw new Error('not used')
    },
    deleteWebhook: async () => {},
    getUpdates: async () => {
      throw new TelegramApiError('getUpdates', 0, 'network error')
    },
    getManagedBotToken: async () => {
      throw new Error('not used')
    },
  }
  setTimeout(() => stop.abort(), 20)
  const started = Date.now()
  await runUpdateLoop({ telegram, onUpdate: async () => {}, signal: stop.signal })
  assert.ok(Date.now() - started < 2_000)
})
