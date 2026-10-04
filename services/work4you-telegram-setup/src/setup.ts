/**
 * The setup flow, between the Work4You app and the manager bot:
 *
 * 1. The app asks for a pairing and shows its t.me/newbot link as a QR code.
 * 2. The person opens it and Telegram creates their bot, managed by ours.
 * 3. Telegram sends the manager bot a managed_bot update for the new bot; its
 *    username ties it to the pairing, and getManagedBotToken returns its token.
 * 4. The app polls with its poll token and reads the token once.
 */
import { PairingStore, type Pairing } from './pairings.js'
import { TelegramApiError, type ManagedBotUpdated, type TelegramPort, type TelegramUpdate } from './telegram.js'

export const DEFAULT_BOT_NAME = 'Work4You'

/** Telegram's limit for a bot's display name. */
const MAX_BOT_NAME_LENGTH = 64

/** A bot whose token could not be read is retried on the app's next poll, at most this often. */
const TOKEN_RETRY_MS = 2_000

/** How long a working manager bot is trusted before getMe is asked again. */
const MANAGER_OK_TTL_MS = 60 * 60_000

/** How long a failed manager check stands, so a fixed setting is picked up quickly. */
const MANAGER_RETRY_MS = 15_000

export type ManagerError =
  | 'telegram_manager_bot_token_not_configured'
  | 'telegram_manager_bot_token_invalid'
  | 'telegram_manager_bot_not_enabled'
  | 'telegram_unavailable'

export type ManagerStatus =
  | { ok: true; username: string }
  | { ok: false; error: ManagerError }

export interface SetupResponse {
  status: 200 | 201 | 401 | 404 | 410 | 502 | 503
  body: Record<string, unknown>
}

export interface UpdateLoopState {
  running: boolean
  lastPollAt: number | null
  lastError: string | null
}

export function sanitizeBotName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_BOT_NAME
  const name = [...value.replace(/\s+/g, ' ').replace(/\p{Cc}/gu, '').trim()]
    .slice(0, MAX_BOT_NAME_LENGTH)
    .join('')
    .trim()
  return name || DEFAULT_BOT_NAME
}

export function newBotLink(managerUsername: string, suggestedUsername: string, botName: string): string {
  return (
    `https://t.me/newbot/${encodeURIComponent(managerUsername)}/${encodeURIComponent(suggestedUsername)}` +
    `?name=${encodeURIComponent(botName)}`
  )
}

/** ISO 8601 in UTC, to the second: every client parses it, older Pythons included. */
function isoSeconds(ms: number): string {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z')
}

function bearerToken(authorization: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? '')
  return match ? match[1] : null
}

function log(message: string): void {
  console.log(`[work4you-telegram-setup] ${message}`)
}

export interface TelegramSetupOptions {
  /** Null when TELEGRAM_MANAGER_BOT_TOKEN is not set. */
  telegram: TelegramPort | null
  store?: PairingStore
  now?: () => number
}

export class TelegramSetup {
  readonly store: PairingStore
  readonly updates: UpdateLoopState = { running: false, lastPollAt: null, lastError: null }
  private readonly telegram: TelegramPort | null
  private readonly now: () => number
  private manager: { status: ManagerStatus; checkedAt: number; canManageBots: boolean | null } | null =
    null
  private managerCheck: Promise<ManagerStatus> | null = null
  private tokenFetches = new Map<string, Promise<void>>()

  constructor(opts: TelegramSetupOptions) {
    this.telegram = opts.telegram
    this.now = opts.now ?? Date.now
    this.store = opts.store ?? new PairingStore({ now: this.now })
  }

  /** The manager bot's username, once getMe confirms Bot Management Mode is on. */
  async managerStatus(): Promise<ManagerStatus> {
    if (!this.telegram) return { ok: false, error: 'telegram_manager_bot_token_not_configured' }
    const cached = this.manager
    if (cached) {
      const ttl = cached.status.ok ? MANAGER_OK_TTL_MS : MANAGER_RETRY_MS
      if (this.now() - cached.checkedAt < ttl) return cached.status
    }
    this.managerCheck ??= this.checkManager(this.telegram).finally(() => {
      this.managerCheck = null
    })
    return this.managerCheck
  }

  private async checkManager(telegram: TelegramPort): Promise<ManagerStatus> {
    let status: ManagerStatus
    let canManageBots: boolean | null = null
    try {
      const me = await telegram.getMe()
      canManageBots = me.can_manage_bots === true
      if (!me.username) {
        status = { ok: false, error: 'telegram_unavailable' }
      } else if (!canManageBots) {
        status = { ok: false, error: 'telegram_manager_bot_not_enabled' }
        log(`@${me.username} cannot manage bots: turn on Bot Management Mode for it in @BotFather`)
      } else {
        status = { ok: true, username: me.username }
      }
    } catch (err) {
      // Telegram answers 401 (or 404, for a malformed token) to a token it does not know.
      const rejected = err instanceof TelegramApiError && (err.code === 401 || err.code === 404)
      status = { ok: false, error: rejected ? 'telegram_manager_bot_token_invalid' : 'telegram_unavailable' }
      log(`getMe: ${err instanceof Error ? err.message : 'failed'}`)
    }
    const previous = this.manager?.status
    if (status.ok && (!previous || !previous.ok || previous.username !== status.username)) {
      log(`manager bot @${status.username} is ready`)
    }
    this.manager = { status, checkedAt: this.now(), canManageBots }
    return status
  }

  health(): Record<string, unknown> {
    const status = this.manager?.status
    return {
      status: 'ok',
      service: 'work4you-telegram-setup',
      manager_bot: {
        configured: Boolean(this.telegram),
        username: status?.ok ? status.username : null,
        can_manage_bots: this.manager?.canManageBots ?? null,
        error: !this.telegram
          ? 'telegram_manager_bot_token_not_configured'
          : status && !status.ok
            ? status.error
            : null,
      },
      updates: {
        running: this.updates.running,
        last_poll_at: this.updates.lastPollAt === null ? null : new Date(this.updates.lastPollAt).toISOString(),
        last_error: this.updates.lastError,
      },
      pairings: this.store.size,
    }
  }

  async createPairing(rawBotName: unknown): Promise<SetupResponse> {
    const manager = await this.managerStatus()
    if (!manager.ok) return { status: 503, body: { error: manager.error } }
    const created = this.store.create(sanitizeBotName(rawBotName))
    if (!created) return { status: 503, body: { error: 'busy' } }
    const { pairing, pollToken } = created
    const deepLink = newBotLink(manager.username, pairing.suggestedUsername, pairing.botName)
    return {
      status: 201,
      body: {
        pairing_id: pairing.id,
        poll_token: pollToken,
        suggested_username: pairing.suggestedUsername,
        deep_link: deepLink,
        qr_payload: deepLink,
        expires_at: isoSeconds(pairing.expiresAt),
      },
    }
  }

  async pollPairing(pairingId: string, authorization: string | undefined): Promise<SetupResponse> {
    const pairing = this.store.get(pairingId)
    if (!pairing) return { status: 404, body: { error: 'not_found' } }
    if (!this.store.authorize(pairing, bearerToken(authorization))) {
      return { status: 401, body: { error: 'unauthorized' } }
    }

    if (this.store.state(pairing) === 'created') await this.fetchToken(pairing)

    switch (this.store.state(pairing)) {
      case 'waiting':
        return { status: 200, body: { status: 'waiting', expires_at: isoSeconds(pairing.expiresAt) } }
      case 'created':
        return { status: 502, body: { error: 'telegram_token_fetch_failed' } }
      case 'ready':
        this.store.claim(pairing)
        return {
          status: 200,
          body: {
            status: 'ready',
            token: pairing.token,
            bot_username: pairing.botUsername ?? null,
            owner_user_id: pairing.ownerUserId === undefined ? null : String(pairing.ownerUserId),
          },
        }
      case 'claimed':
        return { status: 410, body: { error: 'claimed', status: 'claimed' } }
      case 'expired':
        return { status: 410, body: { error: 'expired', status: 'expired' } }
    }
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.managed_bot) await this.handleManagedBot(update.managed_bot)
  }

  private async handleManagedBot(managed: ManagedBotUpdated): Promise<void> {
    const bot = managed.bot
    if (!bot || typeof bot.id !== 'number' || typeof bot.username !== 'string') return
    const pairing = this.store.matchBot(bot.username)
    if (!pairing) return
    pairing.botId = bot.id
    pairing.botUsername = bot.username
    if (typeof managed.user?.id === 'number') pairing.ownerUserId = managed.user.id
    log(`pairing ${pairing.id.slice(0, 8)}: @${bot.username} created`)
    // A new update (a creation, or a token Telegram replaced) is always read at once.
    pairing.lastTokenAttemptAt = undefined
    await this.fetchToken(pairing)
  }

  /** One getManagedBotToken at a time per pairing; failures retry on a later poll. */
  private fetchToken(pairing: Pairing): Promise<void> {
    const running = this.tokenFetches.get(pairing.id)
    if (running) return running
    const telegram = this.telegram
    const botId = pairing.botId
    if (!telegram || botId === undefined) return Promise.resolve()
    if (pairing.lastTokenAttemptAt !== undefined && this.now() - pairing.lastTokenAttemptAt < TOKEN_RETRY_MS) {
      return Promise.resolve()
    }
    pairing.lastTokenAttemptAt = this.now()
    const fetching = telegram
      .getManagedBotToken(botId)
      .then((token) => {
        // A pairing that expired while Telegram answered keeps no token.
        const state = this.store.state(pairing)
        if (typeof token === 'string' && token && (state === 'created' || state === 'ready')) {
          pairing.token = token
        }
      })
      .catch((err: unknown) => {
        log(`pairing ${pairing.id.slice(0, 8)}: getManagedBotToken: ${err instanceof Error ? err.message : 'failed'}`)
      })
      .finally(() => {
        this.tokenFetches.delete(pairing.id)
      })
    this.tokenFetches.set(pairing.id, fetching)
    return fetching
  }

  sweep(): void {
    this.store.sweep()
  }
}
