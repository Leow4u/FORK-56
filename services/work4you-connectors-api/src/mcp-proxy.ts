import type { Context } from 'hono'

import type { TokenStore } from './tokens.js'

export type FetchLike = typeof fetch

export interface McpProxyDeps {
  tokens: TokenStore
  composioApiKey: string
  fetchImpl?: FetchLike
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

export async function proxyMcp(c: Context, deps: McpProxyDeps): Promise<Response> {
  if (!deps.composioApiKey) {
    return c.json({ error: 'upstream_not_configured' }, 503)
  }
  const auth = c.req.header('authorization') ?? ''
  const match = auth.match(/^Bearer\s+(\S+)/i)
  if (!match) {
    return c.json({ error: 'missing_mcp_token' }, 401)
  }
  const record = deps.tokens.get(match[1])
  if (!record) {
    return c.json({ error: 'unknown_mcp_token' }, 401)
  }

  const incoming = new URL(c.req.url)
  const upstreamBase = record.composioMcpUrl.replace(/\/+$/, '')
  const suffix = incoming.pathname.replace(/^\/mcp/, '') || ''
  const target = `${upstreamBase}${suffix}${incoming.search}`

  const headers = new Headers()
  c.req.raw.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    if (key.toLowerCase() === 'authorization') return
    headers.set(key, value)
  })
  headers.set('x-api-key', deps.composioApiKey)

  const init: RequestInit & { duplex?: 'half' } = {
    method: c.req.method,
    headers,
    redirect: 'manual',
  }
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    init.body = c.req.raw.body
    init.duplex = 'half'
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const upstream = await fetchImpl(target, init)
  const outHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    outHeaders.set(key, value)
  })
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  })
}
