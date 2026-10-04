import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** How long a QR code stays valid. The app keeps its own copy of the pairing
 *  for exactly this long, so it bounds the whole setup, saving included. */
export const PAIRING_TTL_MS = 10 * 60_000

/** After the first read of the token, the same app may read it again for this
 *  long, so a response lost on the way does not strand a bot that exists. */
export const CLAIM_GRACE_MS = 60_000

/** How long a finished pairing still answers expired/claimed before it is
 *  forgotten (and answers not_found). Its token is dropped when it finishes. */
export const TOMBSTONE_MS = 10 * 60_000

const DEFAULT_MAX_PAIRINGS = 20_000

// Same shape the Work4You CLI generates: 16 characters from a 32-symbol
// alphabet (80 bits) keep work4you_<slug>_bot within Telegram's 32-character
// username limit. The username is the only thing the managed_bot update shares
// with the QR code, so it is the correlation key and must not be guessable.
const USERNAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

export function generateBotUsername(): string {
  let slug = ''
  for (let i = 0; i < 16; i += 1) slug += USERNAME_ALPHABET[randomInt(USERNAME_ALPHABET.length)]
  return `work4you_${slug}_bot`
}

export type PairingState = 'waiting' | 'created' | 'ready' | 'claimed' | 'expired'

export interface Pairing {
  id: string
  suggestedUsername: string
  botName: string
  createdAt: number
  expiresAt: number
  /** sha256 of the poll token. The token itself is only ever in the create response. */
  pollTokenHash: Buffer
  /** Set from the managed_bot update. */
  botId?: number
  botUsername?: string
  ownerUserId?: number
  token?: string
  lastTokenAttemptAt?: number
  claimedAt?: number
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

export interface PairingStoreOptions {
  now?: () => number
  maxPairings?: number
}

export class PairingStore {
  private byId = new Map<string, Pairing>()
  private byUsername = new Map<string, string>()
  private readonly now: () => number
  private readonly maxPairings: number

  constructor(opts: PairingStoreOptions = {}) {
    this.now = opts.now ?? Date.now
    this.maxPairings = opts.maxPairings ?? DEFAULT_MAX_PAIRINGS
  }

  get size(): number {
    return this.byId.size
  }

  /** A new pairing and its poll token, or null when the store is full. */
  create(botName: string): { pairing: Pairing; pollToken: string } | null {
    if (this.byId.size >= this.maxPairings) return null
    let suggestedUsername = generateBotUsername()
    while (this.byUsername.has(suggestedUsername)) suggestedUsername = generateBotUsername()
    const pollToken = randomBytes(32).toString('base64url')
    const now = this.now()
    const pairing: Pairing = {
      id: randomBytes(16).toString('hex'),
      suggestedUsername,
      botName,
      createdAt: now,
      expiresAt: now + PAIRING_TTL_MS,
      pollTokenHash: sha256(pollToken),
    }
    this.byId.set(pairing.id, pairing)
    this.byUsername.set(suggestedUsername, pairing.id)
    return { pairing, pollToken }
  }

  get(id: string): Pairing | undefined {
    return this.byId.get(id)
  }

  /** Constant-time check of the bearer poll token. */
  authorize(pairing: Pairing, pollToken: string | null): boolean {
    if (!pollToken) return false
    return timingSafeEqual(sha256(pollToken), pairing.pollTokenHash)
  }

  state(pairing: Pairing): PairingState {
    const now = this.now()
    if (pairing.claimedAt !== undefined) {
      return pairing.token && now - pairing.claimedAt <= CLAIM_GRACE_MS ? 'ready' : 'claimed'
    }
    if (now >= pairing.expiresAt) return 'expired'
    if (pairing.token) return 'ready'
    if (pairing.botId !== undefined) return 'created'
    return 'waiting'
  }

  /** The live pairing a new bot belongs to, by the username it was created with.
   *  Telegram usernames are case-insensitive; the person may only change case
   *  and still match. Any other edit leaves the bot unmatched, by design: the
   *  username is all that ties a new bot to a QR code. */
  matchBot(username: string): Pairing | undefined {
    const id = this.byUsername.get(username.toLowerCase())
    const pairing = id ? this.byId.get(id) : undefined
    if (!pairing) return undefined
    const state = this.state(pairing)
    return state === 'waiting' || state === 'created' || state === 'ready' ? pairing : undefined
  }

  /** The first read starts the grace window; later reads do not extend it. */
  claim(pairing: Pairing): void {
    pairing.claimedAt ??= this.now()
  }

  /** Drop the tokens of finished pairings and forget old ones. */
  sweep(): void {
    const now = this.now()
    for (const [id, pairing] of this.byId) {
      const finishedAt =
        pairing.claimedAt !== undefined ? pairing.claimedAt + CLAIM_GRACE_MS : pairing.expiresAt
      if (now < finishedAt) continue
      pairing.token = undefined
      if (this.byUsername.get(pairing.suggestedUsername) === id) {
        this.byUsername.delete(pairing.suggestedUsername)
      }
      if (now >= finishedAt + TOMBSTONE_MS) this.byId.delete(id)
    }
  }
}
