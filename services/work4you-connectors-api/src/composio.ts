import { createHash } from 'node:crypto'

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
    userId: string,
    authConfigId?: string,
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

const SAFE_USER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

/**
 * Map Portal JWT `sub` onto a Composio `user_id`. Isolation stays 1:1 with
 * `sub`; colons in Privy DIDs (`did:privy:…`) are not a valid Composio id.
 */
export function toComposioUserId(portalSub: string): string {
  const sub = portalSub.trim()
  if (SAFE_USER_ID.test(sub)) return sub
  const digest = createHash('sha256').update(sub, 'utf8').digest('hex')
  return `w4y_${digest}`
}

export function formatComposioError(status: number, body: unknown): string {
  const prefix = `composio_${status}`
  const message = pickComposioMessage(body)
  if (!message) return prefix
  return `${prefix}: ${sanitizeComposioText(message)}`
}

function pickComposioMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const row = body as Record<string, unknown>
  const nested = row.error && typeof row.error === 'object' ? (row.error as Record<string, unknown>) : null
  const parts = [nested?.message, nested?.suggested_fix, row.message, row.detail].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  )
  return parts.join(' — ')
}

function sanitizeComposioText(value: string): string {
  const redacted = value
    .replace(/ak_[A-Za-z0-9]+/g, 'ak_***')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/COMPOSIO_API_KEY=\S+/gi, 'COMPOSIO_API_KEY=***')
  return redacted.length > 220 ? `${redacted.slice(0, 217)}...` : redacted
}

function asRecord(json: unknown): Record<string, unknown> {
  return json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
}

export function createComposioClient(opts: {
  apiBase: string
  apiKey: string
  callbackUrl?: string
  fetchImpl?: FetchLike
}): ComposioPort {
  const fetchImpl = opts.fetchImpl ?? fetch
  const base = opts.apiBase.replace(/\/$/, '')
  const authConfigCache = new Map<string, string>()

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
      const err = new ComposioHttpError(formatComposioError(res.status, json), res.status, json)
      console.warn(`[composio] ${method} ${path} -> ${err.message}`)
      throw err
    }
    return json
  }

  function parseSession(json: unknown): ComposioSession {
    const row = asRecord(json)
    const sessionId = String(row.session_id || row.sessionId || '')
    const mcp = (row.mcp && typeof row.mcp === 'object' ? row.mcp : {}) as Record<string, unknown>
    const mcpUrl = String(mcp.url || row.mcp_url || '')
    if (!sessionId || !mcpUrl) {
      throw new ComposioHttpError('composio_session_malformed', 502, json)
    }
    return { sessionId, mcpUrl }
  }

  function parseLink(json: unknown): { redirectUrl: string; connectedAccountId: string | null } {
    const row = asRecord(json)
    const redirectUrl = String(row.redirect_url || row.redirectUrl || '')
    if (!redirectUrl) {
      throw new ComposioHttpError('composio_authorize_missing_url', 502, json)
    }
    const connectedAccountId = row.connected_account_id
      ? String(row.connected_account_id)
      : row.connectedAccountId
        ? String(row.connectedAccountId)
        : row.id
          ? String(row.id)
          : null
    return { redirectUrl, connectedAccountId }
  }

  function sessionPayload(userId: string, authConfigs: Record<string, string>, enable: string[] | null) {
    const payload: Record<string, unknown> = {
      user_id: userId,
      manage_connections: {
        enable: true,
        callback_url: opts.callbackUrl,
      },
    }
    if (enable) {
      payload.toolkits = { enable }
    }
    if (Object.keys(authConfigs).length) {
      payload.auth_configs = authConfigs
    }
    return payload
  }

  async function resolveAuthConfigId(toolkit: string, explicit?: string): Promise<string> {
    if (explicit) return explicit
    const cached = authConfigCache.get(toolkit)
    if (cached) return cached

    const listed = asRecord(
      await request(
        'GET',
        `/api/v3.1/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}&limit=50`,
      ),
    )
    const items = Array.isArray(listed.items)
      ? listed.items
      : Array.isArray(listed.data)
        ? listed.data
        : []
    const rows = items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    const enabled = rows.filter((item) => String(item.status || 'ENABLED').toUpperCase() !== 'DISABLED')
    const preferred =
      enabled.find((item) => item.is_composio_managed === true) || enabled[0] || rows[0]
    const existingId = preferred ? String(preferred.id || '') : ''
    if (existingId) {
      authConfigCache.set(toolkit, existingId)
      return existingId
    }

    const created = asRecord(
      await request('POST', '/api/v3.1/auth_configs', {
        toolkit: { slug: toolkit },
        auth_config: { type: 'use_composio_managed_auth' },
      }),
    )
    const nested =
      created.auth_config && typeof created.auth_config === 'object'
        ? (created.auth_config as Record<string, unknown>)
        : null
    const createdId = String(created.id || nested?.id || '')
    if (!createdId) {
      throw new ComposioHttpError('composio_auth_config_missing', 502, created)
    }
    authConfigCache.set(toolkit, createdId)
    return createdId
  }

  return {
    async createSession(userId, authConfigs) {
      const uid = toComposioUserId(userId)
      try {
        const json = await request(
          'POST',
          '/api/v3.1/tool_router/session',
          sessionPayload(uid, authConfigs, sessionToolkitSlugs()),
        )
        return parseSession(json)
      } catch (err) {
        // A single invalid allowlist slug must not 400 every Connect click.
        if (err instanceof ComposioHttpError && err.status === 400) {
          const json = await request(
            'POST',
            '/api/v3.1/tool_router/session',
            sessionPayload(uid, authConfigs, []),
          )
          return parseSession(json)
        }
        throw err
      }
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

    async authorize(sessionId, toolkit, callbackUrl, userId, authConfigId) {
      const linkPath = `/api/v3.1/tool_router/session/${encodeURIComponent(sessionId)}/link`
      const sessionBodies: Array<Record<string, unknown>> = callbackUrl
        ? [{ toolkit, callback_url: callbackUrl }, { toolkit }]
        : [{ toolkit }]
      let last: ComposioHttpError | undefined
      for (const body of sessionBodies) {
        try {
          return parseLink(await request('POST', linkPath, body))
        } catch (err) {
          if (err instanceof ComposioHttpError && (err.status === 400 || err.status === 404)) {
            last = err
            continue
          }
          throw err
        }
      }

      // Hosted Connect Link (required for Composio-managed OAuth since 2026-07).
      const acId = await resolveAuthConfigId(toolkit, authConfigId)
      try {
        return parseLink(
          await request('POST', '/api/v3.1/connected_accounts/link', {
            auth_config_id: acId,
            user_id: toComposioUserId(userId),
            callback_url: callbackUrl,
          }),
        )
      } catch (err) {
        if (err instanceof ComposioHttpError && last) {
          throw new ComposioHttpError(
            `${err.message} (session_link: ${last.message})`,
            err.status,
            err.body,
          )
        }
        throw err
      }
    },

    async listAccounts(userId) {
      const params = new URLSearchParams()
      params.append('user_ids', toComposioUserId(userId))
      const json = await request('GET', `/api/v3.1/connected_accounts?${params.toString()}`)
      const row = asRecord(json)
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
