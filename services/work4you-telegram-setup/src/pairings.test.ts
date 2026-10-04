import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CLAIM_GRACE_MS,
  PAIRING_TTL_MS,
  PairingStore,
  TOMBSTONE_MS,
  generateBotUsername,
} from './pairings.js'

function clock() {
  let now = Date.UTC(2026, 9, 4, 12, 0, 0)
  return {
    now: () => now,
    advance(ms: number) {
      now += ms
    },
  }
}

test('suggested usernames fit Telegram and carry 80 random bits', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 2_000; i += 1) {
    const username = generateBotUsername()
    assert.match(username, /^work4you_[a-z2-7]{16}_bot$/)
    assert.ok(username.length <= 32)
    seen.add(username)
  }
  assert.equal(seen.size, 2_000)
})

test('only the poll token of a pairing opens it', () => {
  const store = new PairingStore()
  const a = store.create('Work4You')
  const b = store.create('Work4You')
  assert.ok(a && b)

  assert.equal(store.authorize(a.pairing, a.pollToken), true)
  assert.equal(store.authorize(a.pairing, b.pollToken), false)
  assert.equal(store.authorize(a.pairing, `${a.pollToken}x`), false)
  assert.equal(store.authorize(a.pairing, ''), false)
  assert.equal(store.authorize(a.pairing, null), false)
})

test('the poll token itself is not kept', () => {
  const store = new PairingStore()
  const created = store.create('Work4You')
  assert.ok(created)
  assert.equal(JSON.stringify(created.pairing).includes(created.pollToken), false)
})

test('a pairing moves from waiting to ready to claimed', () => {
  const c = clock()
  const store = new PairingStore({ now: c.now })
  const created = store.create('Work4You')
  assert.ok(created)
  const { pairing } = created

  assert.equal(store.state(pairing), 'waiting')
  pairing.botId = 77
  assert.equal(store.state(pairing), 'created')
  pairing.token = '77:token'
  assert.equal(store.state(pairing), 'ready')

  store.claim(pairing)
  c.advance(CLAIM_GRACE_MS)
  store.claim(pairing)
  assert.equal(store.state(pairing), 'ready', 'claiming again does not extend the grace window')
  c.advance(1)
  assert.equal(store.state(pairing), 'claimed')
})

test('a claimed token stays readable through the grace window even past expiry', () => {
  const c = clock()
  const store = new PairingStore({ now: c.now })
  const created = store.create('Work4You')
  assert.ok(created)
  const { pairing } = created
  pairing.botId = 77
  pairing.token = '77:token'

  c.advance(PAIRING_TTL_MS - 1)
  store.claim(pairing)
  c.advance(CLAIM_GRACE_MS / 2)
  assert.equal(store.state(pairing), 'ready')
})

test('only live pairings match a new bot', () => {
  const c = clock()
  const store = new PairingStore({ now: c.now })
  const live = store.create('Work4You')
  const claimed = store.create('Work4You')
  assert.ok(live && claimed)
  claimed.pairing.token = '1:token'
  store.claim(claimed.pairing)
  c.advance(CLAIM_GRACE_MS + 1)

  assert.equal(store.matchBot(live.pairing.suggestedUsername), live.pairing)
  assert.equal(store.matchBot(live.pairing.suggestedUsername.toUpperCase()), live.pairing)
  assert.equal(store.matchBot(claimed.pairing.suggestedUsername), undefined)
  assert.equal(store.matchBot('work4you_aaaaaaaaaaaaaaaa_bot'), undefined)

  c.advance(PAIRING_TTL_MS)
  assert.equal(store.matchBot(live.pairing.suggestedUsername), undefined)
})

test('sweeping drops finished tokens at once and forgets pairings later', () => {
  const c = clock()
  const store = new PairingStore({ now: c.now })
  const live = store.create('Work4You')
  const done = store.create('Work4You')
  assert.ok(live && done)
  live.pairing.token = '1:live'
  done.pairing.token = '2:done'
  store.claim(done.pairing)

  c.advance(CLAIM_GRACE_MS)
  store.sweep()
  assert.equal(done.pairing.token, undefined)
  assert.equal(live.pairing.token, '1:live')
  assert.equal(store.get(done.pairing.id), done.pairing, 'a finished pairing still answers claimed')

  c.advance(TOMBSTONE_MS)
  store.sweep()
  assert.equal(store.get(done.pairing.id), undefined)
  assert.equal(store.get(live.pairing.id), live.pairing)

  c.advance(PAIRING_TTL_MS)
  store.sweep()
  assert.equal(live.pairing.token, undefined)
  assert.equal(store.matchBot(live.pairing.suggestedUsername), undefined)
})

test('a full store refuses new pairings until old ones are forgotten', () => {
  const c = clock()
  const store = new PairingStore({ now: c.now, maxPairings: 2 })
  assert.ok(store.create('Work4You'))
  assert.ok(store.create('Work4You'))
  assert.equal(store.create('Work4You'), null)

  c.advance(PAIRING_TTL_MS + TOMBSTONE_MS)
  store.sweep()
  assert.ok(store.create('Work4You'))
})
