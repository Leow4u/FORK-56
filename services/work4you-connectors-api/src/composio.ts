import { sessionToolkitSlugs } from './allowlist.js'

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
  createSession(userId: string, authConfigs: Record<string, string>): Promise<ComposioSession>
  getSession(sessionId: string): Promise<ComposioSession | null>
  updateSessionToolkits(sessionId: string, slugs: string[]): Promise<void>
  authorize(
    sessionId: string,
    toolkit: string,
    callbackUrl: string,
  ): Promise<{ redirectUrl: string; connectedAccountId: string | null }>
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
    async createSession(userId, authConfigs) {
      const payload: Record<string, unknown> = {
        user_id: userId,
        toolkits: { enable: sessionToolkitSlugs() },
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
        `/api/v3/tool_router/session/${encodeURIComponent(sessionId)}/link`,
        { toolkit, callback_url: callbackUrl },
      )
      const row = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
      const redirectUrl = String(
        row.redirect_url || row.redirectUrl || '',
      )
      if (!redirectUrl) {
        throw new ComposioHttpError('composio_authorize_missing_url', 502, json)
      }
      const connectedAccountId = row.connected_account_id
        ? String(row.connected_account_id)
        : row.connectedAccountId
          ? String(row.connectedAccountId)
          : null
      return { redirectUrl, connectedAccountId }
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
  if (s === 'INITIATED' || s === 'INITIATING') return 'initiated'
  return 'disconnected'
}
