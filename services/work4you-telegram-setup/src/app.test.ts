import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createApp } from './app.js'
import { CLAIM_GRACE_MS, PAIRING_TTL_MS, TOMBSTONE_MS } from './pairings.js'
import { RateLimiter } from './rate-limit.js'
import { TelegramSetup } from './setup.js'
import { TelegramApiError, type TelegramPort, type TelegramUpdate, type TelegramUser } from './telegram.js'

const MANAGER = 'Work4YouSetupBot'
const OWNER_ID = 5_012_345_678

class FakeTelegram implements TelegramPort {
  me: TelegramUser = { id: 1, is_bot: true, first_name: 'Work4You Setup', username: MANAGER, can_manage_bots: true }
  tokens = new Map<number, string>()
  tokenFailures = 0
  getMeCalls = 0
  tokenCalls: number[] = []

  async getMe(): Promise<TelegramUser> {
    this.getMeCalls += 1
    return this.me
  }

  async deleteWebhook(): Promise<void> {}

  async getUpdates(): Promise<TelegramUpdate[]> {
    return []
  }

  async getManagedBotToken(botUserId: number): Promise<string> {
    this.tokenCalls.push(botUserId)
    if (this.tokenFailures > 0) {
      this.tokenFailures -= 1
      throw new TelegramApiError('getManagedBotToken', 500, 'Internal Server Error')
    }
    const token = this.tokens.get(botUserId)
    if (!token) throw new TelegramApiError('getManagedBotToken', 400, 'Bad Request: bot not found')
    return token
  }
}

function harness(opts: { telegram?: FakeTelegram | null; createLimit?: number } = {}) {
  let now = Date.UTC(2026, 9, 4, 12, 0, 0)
  const clock = {
    now: () => now,
    advance(ms: number) {
      now += ms
    },
  }
  const telegram = opts.telegram === undefined ? new FakeTelegram() : opts.telegram
  const setup = new TelegramSetup({ telegram, now: clock.now })
  const app = createApp({
    setup,
    createLimiter: new RateLimiter(opts.createLimit ?? 100, 10 * 60_000, clock.now),
  })

  async function start(body: unknown = { bot_name: 'Work4You' }, headers: Record<string, string> = {}) {
    const res = await app.request('/v1/telegram/pairings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    return { res, status: res.status, body: (await res.json()) as Record<string, any> }
  }

  async function poll(pairingId: string, pollToken?: string) {
    const res = await app.request(`/v1/telegram/pairings/${encodeURIComponent(pairingId)}`, {
      headers: pollToken ? { authorization: `Bearer ${pollToken}` } : {},
    })
    return { res, status: res.status, body: (await res.json()) as Record<string, any> }
  }

  /** What Telegram sends the manager bot once the person confirms the new bot. */
  async function createBot(username: string, botId = 7_700_000_001, token = `${botId}:AAH-${'x'.repeat(31)}`) {
    telegram?.tokens.set(botId, token)
    const update: TelegramUpdate = {
      update_id: botId,
      managed_bot: {
        user: { id: OWNER_ID, is_bot: false, first_name: 'Ana' },
        bot: { id: botId, is_bot: true, first_name: 'Work4You', username },
      },
    }
    await setup.handleUpdate(update)
    return { botId, token }
  }

  return { app, setup, telegram, clock, start, poll, createBot }
}

test('a pairing carries everything the app shows and polls with', async () => {
  const h = harness()
  const { res, status, body } = await h.start()

  assert.equal(status, 201)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.match(body.pairing_id, /^[0-9a-f]{32}$/)
  assert.ok(body.poll_token.length >= 40)
  assert.match(body.suggested_username, /^work4you_[a-z2-7]{16}_bot$/)
  assert.ok(body.suggested_username.length <= 32)
  assert.equal(body.deep_link, `https://t.me/newbot/${MANAGER}/${body.suggested_username}?name=Work4You`)
  assert.equal(body.qr_payload, body.deep_link)
  assert.equal(Date.parse(body.expires_at), h.clock.now() + PAIRING_TTL_MS)
  assert.match(body.expires_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/)
})

test('every pairing gets its own id, poll token and username', async () => {
  const h = harness()
  const a = (await h.start()).body
  const b = (await h.start()).body

  assert.notEqual(a.pairing_id, b.pairing_id)
  assert.notEqual(a.poll_token, b.poll_token)
  assert.notEqual(a.suggested_username, b.suggested_username)
})

test('the bot name rides in the link, cleaned and within Telegram limits', async () => {
  const h = harness()

  const spaced = (await h.start({ bot_name: '  My \n Team\tBot ' })).body
  assert.ok(spaced.deep_link.endsWith('?name=My%20Team%20Bot'))

  const long = (await h.start({ bot_name: 'n'.repeat(100) })).body
  assert.ok(long.deep_link.endsWith(`?name=${'n'.repeat(64)}`))

  for (const body of [{}, { bot_name: '   ' }, { bot_name: 42 }, null]) {
    const fallback = (await h.start(body)).body
    assert.ok(fallback.deep_link.endsWith('?name=Work4You'), JSON.stringify(body))
  }
})

test('the app reads the token of the bot made from its QR code, once', async () => {
  const h = harness()
  const { pairing_id, poll_token, suggested_username, expires_at } = (await h.start()).body

  const waiting = await h.poll(pairing_id, poll_token)
  assert.equal(waiting.status, 200)
  assert.deepEqual(waiting.body, { status: 'waiting', expires_at })

  const { botId, token } = await h.createBot(suggested_username)
  assert.deepEqual(h.telegram?.tokenCalls, [botId])

  const ready = await h.poll(pairing_id, poll_token)
  assert.equal(ready.status, 200)
  assert.equal(ready.res.headers.get('cache-control'), 'no-store')
  assert.deepEqual(ready.body, {
    status: 'ready',
    token,
    bot_username: suggested_username,
    owner_user_id: String(OWNER_ID),
  })

  // A response lost on the way can be read again, briefly.
  h.clock.advance(CLAIM_GRACE_MS)
  assert.deepEqual((await h.poll(pairing_id, poll_token)).body, ready.body)

  h.clock.advance(1)
  const claimed = await h.poll(pairing_id, poll_token)
  assert.equal(claimed.status, 410)
  assert.equal(claimed.body.error, 'claimed')
  assert.equal(JSON.stringify(claimed.body).includes(token), false)
})

test('a poll without the poll token learns nothing and claims nothing', async () => {
  const h = harness()
  const { pairing_id, poll_token, suggested_username } = (await h.start()).body
  const other = (await h.start()).body
  await h.createBot(suggested_username)

  for (const bearer of [undefined, 'wrong', other.poll_token]) {
    const res = await h.poll(pairing_id, bearer)
    assert.equal(res.status, 401)
    assert.deepEqual(res.body, { error: 'unauthorized' })
  }
  const lowercase = await h.app.request(`/v1/telegram/pairings/${pairing_id}`, {
    headers: { authorization: poll_token },
  })
  assert.equal(lowercase.status, 401)

  // None of those reads started the grace window.
  h.clock.advance(CLAIM_GRACE_MS * 2)
  assert.equal((await h.poll(pairing_id, poll_token)).body.status, 'ready')
})

test('an unknown pairing is not found', async () => {
  const h = harness()
  const res = await h.poll('0'.repeat(32), 'whatever')
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, { error: 'not_found' })
})

test('a QR code nobody uses expires, and a late bot is not delivered', async () => {
  const h = harness()
  const { pairing_id, poll_token, suggested_username } = (await h.start()).body

  h.clock.advance(PAIRING_TTL_MS)
  const expired = await h.poll(pairing_id, poll_token)
  assert.equal(expired.status, 410)
  assert.equal(expired.body.error, 'expired')

  await h.createBot(suggested_username)
  assert.deepEqual(h.telegram?.tokenCalls, [])
  assert.equal((await h.poll(pairing_id, poll_token)).body.error, 'expired')
})

test('a token read but never collected is dropped when the pairing expires', async () => {
  const h = harness()
  const { pairing_id, poll_token, suggested_username } = (await h.start()).body
  await h.createBot(suggested_username)

  h.clock.advance(PAIRING_TTL_MS)
  const res = await h.poll(pairing_id, poll_token)
  assert.equal(res.status, 410)
  assert.equal(res.body.error, 'expired')
  h.setup.sweep()
  assert.equal(h.setup.store.get(pairing_id)?.token, undefined)
})

test('each bot goes to the pairing whose username it was created with', async () => {
  const h = harness()
  const a = (await h.start()).body
  const b = (await h.start()).body

  const { token } = await h.createBot(b.suggested_username)
  assert.equal((await h.poll(a.pairing_id, a.poll_token)).body.status, 'waiting')
  assert.equal((await h.poll(b.pairing_id, b.poll_token)).body.token, token)
})

test('Telegram usernames match without regard to case; any other edit does not match', async () => {
  const h = harness()
  const edited = (await h.start()).body
  const cased = (await h.start()).body

  await h.createBot(`${edited.suggested_username.slice(0, -4)}x_bot`, 7_700_000_010)
  assert.equal((await h.poll(edited.pairing_id, edited.poll_token)).body.status, 'waiting')
  assert.deepEqual(h.telegram?.tokenCalls, [])

  const upper = cased.suggested_username.toUpperCase()
  const { token } = await h.createBot(upper, 7_700_000_011)
  const ready = await h.poll(cased.pairing_id, cased.poll_token)
  assert.equal(ready.body.token, token)
  assert.equal(ready.body.bot_username, upper)
})

test('a token Telegram fails to hand over is fetched again on a later poll', async () => {
  const h = harness()
  const { pairing_id, poll_token, suggested_username } = (await h.start()).body
  assert.ok(h.telegram)
  h.telegram.tokenFailures = 1

  const { token } = await h.createBot(suggested_username)
  const failed = await h.poll(pairing_id, poll_token)
  assert.equal(failed.status, 502)
  assert.deepEqual(failed.body, { error: 'telegram_token_fetch_failed' })
  assert.equal(h.telegram.tokenCalls.length, 1, 'a poll right after a failure does not hit Telegram')

  h.clock.advance(2_000)
  const ready = await h.poll(pairing_id, poll_token)
  assert.equal(ready.status, 200)
  assert.equal(ready.body.token, token)
  assert.equal(h.telegram.tokenCalls.length, 2)
})

test('a token Telegram replaces before the app collects it is the one delivered', async () => {
  const h = harness()
  const { pairing_id, poll_token, suggested_username } = (await h.start()).body
  await h.createBot(suggested_username, 7_700_000_020, `7700000020:AAF-${'a'.repeat(31)}`)
  const { token } = await h.createBot(suggested_username, 7_700_000_020, `7700000020:AAG-${'b'.repeat(31)}`)

  assert.equal((await h.poll(pairing_id, poll_token)).body.token, token)
})

test('without a manager bot token, new pairings say the service is not configured', async () => {
  const h = harness({ telegram: null })
  const res = await h.start()
  assert.equal(res.status, 503)
  assert.deepEqual(res.body, { error: 'telegram_manager_bot_token_not_configured' })

  const health = (await (await h.app.request('/healthz')).json()) as Record<string, any>
  assert.equal(health.manager_bot.configured, false)
  assert.equal(health.manager_bot.error, 'telegram_manager_bot_token_not_configured')
})

test('a manager bot without Bot Management Mode is refused until it is turned on', async () => {
  const h = harness()
  assert.ok(h.telegram)
  h.telegram.me = { ...h.telegram.me, can_manage_bots: false }

  const refused = await h.start()
  assert.equal(refused.status, 503)
  assert.deepEqual(refused.body, { error: 'telegram_manager_bot_not_enabled' })

  h.telegram.me = { ...h.telegram.me, can_manage_bots: true }
  h.clock.advance(15_000)
  assert.equal((await h.start()).status, 201)
})

test('Telegram being unreachable answers 503, and recovers', async () => {
  const h = harness()
  assert.ok(h.telegram)
  const fake = h.telegram
  const getMe = fake.getMe.bind(fake)
  fake.getMe = async () => {
    throw new TelegramApiError('getMe', 0, 'network error')
  }

  const down = await h.start()
  assert.equal(down.status, 503)
  assert.deepEqual(down.body, { error: 'telegram_unavailable' })

  fake.getMe = getMe
  h.clock.advance(15_000)
  assert.equal((await h.start()).status, 201)
})

test('a manager bot token Telegram rejects is reported as invalid', async () => {
  const h = harness()
  assert.ok(h.telegram)
  h.telegram.getMe = async () => {
    throw new TelegramApiError('getMe', 401, 'Unauthorized')
  }

  const res = await h.start()
  assert.equal(res.status, 503)
  assert.deepEqual(res.body, { error: 'telegram_manager_bot_token_invalid' })
  const health = (await (await h.app.request('/healthz')).json()) as Record<string, any>
  assert.equal(health.manager_bot.error, 'telegram_manager_bot_token_invalid')
})

test('the manager bot is looked up once, not on every pairing', async () => {
  const h = harness()
  await h.start()
  await h.start()
  await h.start()
  assert.equal(h.telegram?.getMeCalls, 1)
})

test('one client IP can start only so many pairings', async () => {
  const h = harness({ createLimit: 2 })
  const ip = { 'fly-client-ip': '203.0.113.7' }

  assert.equal((await h.start(undefined, ip)).status, 201)
  assert.equal((await h.start(undefined, ip)).status, 201)
  const limited = await h.start(undefined, ip)
  assert.equal(limited.status, 429)
  assert.deepEqual(limited.body, { error: 'rate_limited' })
  assert.equal(limited.res.headers.get('retry-after'), '60')

  assert.equal((await h.start(undefined, { 'fly-client-ip': '203.0.113.8' })).status, 201)
  h.clock.advance(10 * 60_000)
  assert.equal((await h.start(undefined, ip)).status, 201)
})

test('a finished pairing is forgotten after a while', async () => {
  const h = harness()
  const { pairing_id, poll_token, suggested_username } = (await h.start()).body
  await h.createBot(suggested_username)
  await h.poll(pairing_id, poll_token)

  h.clock.advance(CLAIM_GRACE_MS + 1)
  h.setup.sweep()
  assert.equal(h.setup.store.get(pairing_id)?.token, undefined)
  assert.equal((await h.poll(pairing_id, poll_token)).body.error, 'claimed')

  h.clock.advance(TOMBSTONE_MS)
  h.setup.sweep()
  assert.equal((await h.poll(pairing_id, poll_token)).status, 404)
})

test('healthz shows the manager bot once it is checked', async () => {
  const h = harness()
  await h.start()
  const res = await h.app.request('/healthz')
  assert.equal(res.status, 200)
  const health = (await res.json()) as Record<string, any>
  assert.equal(health.status, 'ok')
  assert.deepEqual(health.manager_bot, {
    configured: true,
    username: MANAGER,
    can_manage_bots: true,
    error: null,
  })
  assert.equal(health.pairings, 1)
})

test('unknown routes answer JSON 404', async () => {
  const h = harness()
  const res = await h.app.request('/v1/telegram/nothing')
  assert.equal(res.status, 404)
  assert.deepEqual(await res.json(), { error: 'not_found' })
})
