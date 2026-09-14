export type ConnectionStatus = 'disconnected' | 'initiated' | 'active' | 'expired'

export type ComposioSession = {
  sessionId: string
  mcpUrl: string
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
    return { sessionId, mcpUrl }
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
      const json = await request(
        'GET',
        `/api/v3/connected_accounts?${params.toString()}`,
      )
      const row = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
      const items = Array.isArray(row.items)
        ? row.items
        : Array.isArray(row.data)
          ? row.data
          : []
      return items
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => {
          const toolkitObj =
            item.toolkit && typeof item.toolkit === 'object'
              ? (item.toolkit as Record<string, unknown>)
              : null
          const toolkit = String(
            toolkitObj?.slug || item.toolkit_slug || item.appName || '',
          )
          return {
            id: String(item.id || item.connected_account_id || ''),
            toolkit,
            status: String(item.status || '').toUpperCase(),
          }
        })
        .filter((item) => item.id && item.toolkit)
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
