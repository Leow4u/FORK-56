/**
 * The few Bot API calls the setup service makes, as the manager bot.
 *
 * The request URL carries the manager bot token, so no error raised here ever
 * includes the URL or the underlying fetch error: only the method name, the
 * Telegram error code and Telegram's own description.
 */

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name?: string
  username?: string
  /** True when Bot Management Mode is on. Only getMe returns it. */
  can_manage_bots?: boolean
}

/** A bot managed by the manager bot was created, got a new token, or changed owner. */
export interface ManagedBotUpdated {
  /** The person who created the bot. */
  user: TelegramUser
  bot: TelegramUser
}

export interface TelegramUpdate {
  update_id: number
  managed_bot?: ManagedBotUpdated
}

export interface GetUpdatesParams {
  offset?: number
  /** Long-poll timeout in seconds. */
  timeout: number
  allowed_updates: string[]
}

export interface TelegramPort {
  getMe(): Promise<TelegramUser>
  deleteWebhook(): Promise<void>
  getUpdates(params: GetUpdatesParams, signal?: AbortSignal): Promise<TelegramUpdate[]>
  /** The token of a bot the manager bot manages, by the bot's user id. */
  getManagedBotToken(botUserId: number): Promise<string>
}

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    /** Telegram's error_code, the HTTP status, or 0 when no response came back. */
    readonly code: number,
    readonly description: string,
    /** Seconds Telegram asks us to wait (429). */
    readonly retryAfter?: number,
  ) {
    super(`${method} failed: ${code || 'no response'} ${description}`)
    this.name = 'TelegramApiError'
  }
}

type BotApiResponse<T> = {
  ok?: boolean
  result?: T
  error_code?: number
  description?: string
  parameters?: { retry_after?: number }
}

export interface TelegramClientOptions {
  token: string
  apiBase?: string
  fetchImpl?: typeof fetch
  /** Timeout for every call but the long poll, which waits its own timeout plus this. */
  timeoutMs?: number
}

export function createTelegramClient(opts: TelegramClientOptions): TelegramPort {
  const apiBase = (opts.apiBase || 'https://api.telegram.org').replace(/\/+$/, '')
  const fetchImpl = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? 10_000

  async function call<T>(
    method: string,
    params: Record<string, unknown>,
    callTimeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    const timeout = AbortSignal.timeout(callTimeoutMs)
    let res: Response
    try {
      res = await fetchImpl(`${apiBase}/bot${opts.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      })
    } catch {
      throw new TelegramApiError(method, 0, timeout.aborted ? 'timed out' : 'network error')
    }
    let body: BotApiResponse<T>
    try {
      body = (await res.json()) as BotApiResponse<T>
    } catch {
      throw new TelegramApiError(method, res.status, 'invalid response')
    }
    if (!body.ok) {
      throw new TelegramApiError(
        method,
        body.error_code ?? res.status,
        body.description ?? 'request failed',
        body.parameters?.retry_after,
      )
    }
    return body.result as T
  }

  return {
    getMe: () => call<TelegramUser>('getMe', {}, timeoutMs),
    async deleteWebhook() {
      await call<boolean>('deleteWebhook', { drop_pending_updates: false }, timeoutMs)
    },
    getUpdates: (params, signal) =>
      call<TelegramUpdate[]>('getUpdates', { ...params }, params.timeout * 1000 + timeoutMs, signal),
    getManagedBotToken: (botUserId) => call<string>('getManagedBotToken', { user_id: botUserId }, timeoutMs),
  }
}
