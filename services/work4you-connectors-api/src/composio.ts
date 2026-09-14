export type ConnectionStatus = 'disconnected' | 'initiated' | 'active' | 'expired'

export type ComposioSession = {
  sessionId: string
  mcpUrl: string
  /** Tool-router `config.user_id`. Wait uses this to refuse another HOME's session. */
  userId?: string
}

export type ConnectedAccount = {
  id: string
  toolkit: string
  status: string
}

export interface ComposioPort {
  createSession(
    userId: string,
    authConfigs: Record<string, string>,
    enable: string[],
  ): Promise<ComposioSession>
  getSession(sessionId: string): Promise<ComposioSession | null>
  updateSessionToolkits(sessionId: string, slugs: string[]): Promise<void>
  /** Official Connect status: GET .../session/{id}/toolkits (session.toolkits()). */
  listSessionToolkits(sessionId: string, toolkit?: string): Promise<ConnectedAccount[]>
  pinSessionAccount(sessionId: string, toolkit: string, accountId: string): Promise<void>
  authorize(
    sessionId: string,
    toolkit: string,
    callbackUrl: string,
  ): Promise<{ redirectUrl: string; connectedAccountId: string | null }>
  getAccount(accountId: string): Promise<ConnectedAccount | null>
  listAccounts(userId: string): Promise<ConnectedAccount[]>
  disableAccount(accountId: string): Promise<void>
}

export class ComposioHttpError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

type FetchLike = typeof fetch

const LINK_ACCOUNT_ID_KEYS = [
  'connected_account_id',
  'connectedAccountId',
  'connection_id',
  'connectionId',
] as const

function firstTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function accountIdFromRecord(row: Record<string, unknown>): string | null {
  for (const key of LINK_ACCOUNT_ID_KEYS) {
    const found = firstTrimmedString(row[key])
    if (found) return found
  }
  const nested = row.connected_account ?? row.connectedAccount ?? row.data
  if (nested && typeof nested === 'object') {
    const nestedId = accountIdFromRecord(nested as Record<string, unknown>)
    if (nestedId) return nestedId
    const id = firstTrimmedString((nested as Record<string, unknown>).id)
    if (id) return id
  }
  return null
}

function accountIdFromRedirect(redirectUrl: string): string | null {
  try {
    const parsed = new URL(redirectUrl)
    for (const key of LINK_ACCOUNT_ID_KEYS) {
      const found = firstTrimmedString(parsed.searchParams.get(key))
      if (found) return found
    }
  } catch {
    return null
  }
  return null
}

function composioAccountStatus(nested: Record<string, unknown>): string {
  const direct = firstTrimmedString(nested.status)
  if (direct) return direct.toUpperCase()
  const state = nested.state
  if (!state || typeof state !== 'object') return ''
  const rec = state as Record<string, unknown>
  const inner = rec.val && typeof rec.val === 'object' ? (rec.val as Record<string, unknown>) : rec
  const nestedStatus = firstTrimmedString(inner.status)
  return nestedStatus ? nestedStatus.toUpperCase() : ''
}

function composioAccountToolkit(nested: Record<string, unknown>): string {
  const toolkitObj =
    nested.toolkit && typeof nested.toolkit === 'object'
      ? (nested.toolkit as Record<string, unknown>)
      : null
  return (
    firstTrimmedString(toolkitObj?.slug) ||
    firstTrimmedString(nested.toolkit_slug) ||
    firstTrimmedString(nested.appName) ||
    (typeof nested.toolkit === 'string' ? firstTrimmedString(nested.toolkit) : null) ||
    ''
  )
}

function parseConnectedAccount(json: unknown, fallbackId: string): ConnectedAccount | null {
  const item = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const nested =
    item.item && typeof item.item === 'object' ? (item.item as Record<string, unknown>) : item
  const id = firstTrimmedString(nested.id) || firstTrimmedString(nested.connected_account_id) || fallbackId
  if (!id) return null
  return {
    id,
    toolkit: composioAccountToolkit(nested),
    status: composioAccountStatus(nested),
  }
}

/** session.toolkits() item: connected when connected_account.status === 'ACTIVE'. */
function parseSessionToolkitAccount(item: unknown, fallbackToolkit: string): ConnectedAccount | null {
  if (!item || typeof item !== 'object') return null
  const rec = item as Record<string, unknown>
  const connection = rec.connection && typeof rec.connection === 'object'
    ? (rec.connection as Record<string, unknown>)
    : rec
  const nestedRaw = rec.connected_account ?? rec.connectedAccount
    ?? connection.connected_account ?? connection.connectedAccount ?? connection
  const nested =
    nestedRaw && typeof nestedRaw === 'object' ? (nestedRaw as Record<string, unknown>) : null
  if (!nested) return null
  const id = firstTrimmedString(nested.id) || firstTrimmedString(nested.connected_account_id)
  if (!id) return null
  const slug =
    firstTrimmedString(rec.slug) ||
    composioAccountToolkit(rec) ||
    composioAccountToolkit(nested) ||
    fallbackToolkit
  return {
    id,
    toolkit: slug,
    status: composioAccountStatus(nested),
  }
}

/** Composio /link payloads vary; this is the same account id wait() must poll. */
export function connectedAccountIdFromLinkPayload(
  json: unknown,
  redirectUrl = '',
): string | null {
  if (json && typeof json === 'object') {
    const row = json as Record<string, unknown>
    const linkToken = firstTrimmedString(row.link_token)
    const fromBody = accountIdFromRecord(row)
    if (fromBody && fromBody !== linkToken) return fromBody
  }
  return accountIdFromRedirect(redirectUrl)
}

export function createComposioClient(opts: {
  apiBase: string
  apiKey: string
  callbackUrl?: string
  fetchImpl?: FetchLike
}): ComposioPort {
  const fetchImpl = opts.fetchImpl ?? fetch
  const base = opts.apiBase.replace(/\/$/, '')

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }
    if (!res.ok) {
      throw new ComposioHttpError(
        `composio_${res.status}`,
        res.status,
        json,
      )
    }
    return json
  }

  function parseSession(json: unknown): ComposioSession {
    const row = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
    const sessionId = String(row.session_id || row.sessionId || '')
    const mcp = (row.mcp && typeof row.mcp === 'object' ? row.mcp : {}) as Record<string, unknown>
    const mcpUrl = String(mcp.url || row.mcp_url || '')
    if (!sessionId || !mcpUrl) {
      throw new ComposioHttpError('composio_session_malformed', 502, json)
    }
    const config =
      row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {}
    const userId = firstTrimmedString(config.user_id) || firstTrimmedString(row.user_id) || undefined
    return { sessionId, mcpUrl, userId }
  }

  return {
    async createSession(userId, authConfigs, enable) {
      const payload: Record<string, unknown> = {
        user_id: userId,
        toolkits: { enable },
        manage_connections: {
          enable: true,
          callback_url: opts.callbackUrl,
        },
      }
      if (Object.keys(authConfigs).length) {
        payload.auth_configs = authConfigs
      }
      const json = await request('POST', '/api/v3.1/tool_router/session', payload)
      return parseSession(json)
    },

    async getSession(sessionId) {
      try {
        const json = await request(
          'GET',
          `/api/v3.1/tool_router/session/${encodeURIComponent(sessionId)}`,
        )
        return parseSession(json)
      } catch (err) {
        if (err instanceof ComposioHttpError && (err.status === 404 || err.status === 410)) {
          return null
        }
        throw err
      }
    },

    async updateSessionToolkits(sessionId, slugs) {
      await request(
        'PATCH',
        `/api/v3.1/tool_router/session/${encodeURIComponent(sessionId)}`,
        { toolkits: { enable: slugs } },
      )
    },

    async listSessionToolkits(sessionId, toolkit) {
      const params = new URLSearchParams()
      params.set('limit', '50')
      const slug = (toolkit ?? '').trim()
      if (slug) params.set('toolkits', slug)
      try {
        const json = await request(
          'GET',
          `/api/v3.1/tool_router/session/${encodeURIComponent(sessionId)}/toolkits?${params.toString()}`,
        )
        const row = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
        const items = Array.isArray(row.items) ? row.items : []
        return items
          .map((item) => parseSessionToolkitAccount(item, slug))
          .filter((item): item is ConnectedAccount => !!item && !!item.id)
      } catch (err) {
        if (err instanceof ComposioHttpError && (err.status === 404 || err.status === 410)) {
          return []
        }
        throw err
      }
    },

    async pinSessionAccount(sessionId, toolkit, accountId) {
      const slug = toolkit.trim()
      const id = accountId.trim()
      if (!slug || !id) return
      await request(
        'PATCH',
        `/api/v3.1/tool_router/session/${encodeURIComponent(sessionId)}`,
        { connected_accounts: { [slug]: [id] } },
      )
    },

    async authorize(sessionId, toolkit, callbackUrl) {
      const json = await request(
        'POST',
        `/api/v3.1/tool_router/session/${encodeURIComponent(sessionId)}/link`,
        { toolkit, callback_url: callbackUrl },
      )
      const row = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
      const redirectUrl = String(
        row.redirect_url || row.redirectUrl || '',
      )
      if (!redirectUrl) {
        throw new ComposioHttpError('composio_authorize_missing_url', 502, json)
      }
      return {
        redirectUrl,
        connectedAccountId: connectedAccountIdFromLinkPayload(json, redirectUrl),
      }
    },

    async getAccount(accountId) {
      const paths = [
        `/api/v3.1/connected_accounts/${encodeURIComponent(accountId)}`,
        `/api/v3/connected_accounts/${encodeURIComponent(accountId)}`,
      ]
      for (const path of paths) {
        try {
          const json = await request('GET', path)
          return parseConnectedAccount(json, accountId)
        } catch (err) {
          if (err instanceof ComposioHttpError && (err.status === 404 || err.status === 410)) {
            continue
          }
          throw err
        }
      }
      return null
    },

    async listAccounts(userId) {
      const params = new URLSearchParams()
      params.append('user_ids', userId)
      // v3.1 defaults to PRIVATE only. Tool-router OAuth often lands as
      // SHARED; omitting this made wait miss the ACTIVE ca_ after Google.
      params.append('account_type', 'ALL')
      const paths = [
        `/api/v3.1/connected_accounts?${params.toString()}`,
        `/api/v3/connected_accounts?${params.toString()}`,
      ]
      let json: unknown = null
      for (const path of paths) {
        try {
          json = await request('GET', path)
          break
        } catch (err) {
          if (err instanceof ComposioHttpError && (err.status === 404 || err.status === 410)) {
            continue
          }
          throw err
        }
      }
      if (!json) return []
      const row = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
      const items = Array.isArray(row.items)
        ? row.items
        : Array.isArray(row.data)
          ? row.data
          : []
      // Same parser as getAccount: Composio puts ACTIVE on state.val.status.
      // Top-level item.status was empty, so wait never saw OAuth complete.
      return items
        .map((item) => parseConnectedAccount(item, ''))
        .filter((item): item is ConnectedAccount => !!item && !!item.id)
    },

    async disableAccount(accountId) {
      try {
        await request(
          'POST',
          `/api/v3.1/connected_accounts/${encodeURIComponent(accountId)}/disable`,
        )
      } catch (err) {
        if (err instanceof ComposioHttpError && err.status === 404) {
          await request(
            'PATCH',
            `/api/v3/connected_accounts/${encodeURIComponent(accountId)}`,
            { enabled: false, status: 'INACTIVE' },
          )
          return
        }
        throw err
      }
    },
  }
}

export function statusFromAccount(status: string): ConnectionStatus {
  const s = status.toUpperCase()
  if (s === 'ACTIVE') return 'active'
  if (s === 'EXPIRED') return 'expired'
  if (s === 'INITIATED' || s === 'INITIATING' || s === 'INITIALIZING') return 'initiated'
  return 'disconnected'
}
