import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'

import {
  ALLOWLIST,
  BLOCKED_SESSION_SLUGS,
  POPULAR_SLUGS,
  SECTION_IDS,
  authConfigsFromEnv,
  isAllowlisted,
  sessionToolkitSlugs,
  toolkitLogoUrl,
} from './allowlist.js'
import { AuthError, type ConnectorClaims } from './auth.js'
import { ComposioHttpError, statusFromAccount, type ComposioPort } from './composio.js'
import { proxyMcp, type FetchLike } from './mcp-proxy.js'
import type { TokenStore } from './tokens.js'

export interface AppConfig {
  publicBaseUrl: string
  composioApiKey: string
  hasComposioKey: boolean
  authConfigId: (slug: string) => string | undefined
}

export interface AppDeps {
  config: AppConfig
  composio: ComposioPort
  tokens: TokenStore
  verifyBearer: (authorization: string | undefined) => Promise<ConnectorClaims>
  sleep?: (ms: number) => Promise<void>
  fetchImpl?: FetchLike
}

function jsonError(c: Context, status: 400 | 401 | 403 | 404 | 502 | 503, error: string, detail?: string) {
  return c.json(detail ? { error, detail } : { error }, status)
}

async function requireUser(c: Context, deps: AppDeps): Promise<ConnectorClaims | Response> {
  try {
    return await deps.verifyBearer(c.req.header('authorization'))
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(c, err.status === 403 ? 403 : 401, err.message)
    }
    const message = err instanceof Error ? err.message : 'unauthorized'
    return jsonError(c, 401, 'unauthorized', message)
  }
}

function pickAccount(
  accounts: Awaited<ReturnType<ComposioPort['listAccounts']>>,
  slug: string,
) {
  const matches = accounts.filter((a) => a.toolkit === slug)
  return matches.find((a) => a.status === 'ACTIVE') ?? matches[0]
}

function mapApp(
  slug: string,
  name: string,
  description: string,
  section: string,
  popular: boolean,
  rawStatus: string | undefined,
) {
  const status = rawStatus ? statusFromAccount(rawStatus) : 'disconnected'
  return {
    slug,
    name,
    description,
    section,
    popular,
    status,
    connected: status === 'active',
    source: 'composio' as const,
    notes: slug === 'instagram' ? 'instagram_business_creator' : null,
    logo: toolkitLogoUrl(slug),
  }
}

async function ensureSession(deps: AppDeps, userId: string) {
  const enable = sessionToolkitSlugs()
  const authConfigs = authConfigsFromEnv(deps.config.authConfigId)
  const existing = deps.tokens.getBySub(userId)
  if (existing) {
    const session = await deps.composio.getSession(existing.sessionId)
    if (session) {
      await deps.composio.updateSessionToolkits(existing.sessionId, enable)
      return {
        token: existing.token,
        sessionId: existing.sessionId,
        mcpUrl: session.mcpUrl,
      }
    }
    deps.tokens.revokeBySub(userId)
  }
  const created = await deps.composio.createSession(userId, authConfigs)
  const record = deps.tokens.issue(userId, created.sessionId, created.mcpUrl)
  return {
    token: record.token,
    sessionId: created.sessionId,
    mcpUrl: created.mcpUrl,
  }
}

function requireComposio(c: Context, deps: AppDeps) {
  if (!deps.config.hasComposioKey || !deps.config.composioApiKey) {
    return jsonError(c, 503, 'upstream_not_configured')
  }
  return null
}

export function createApp(deps: AppDeps) {
  const app = new Hono()
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))

  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: [
        'Authorization',
        'Content-Type',
        'Accept',
        'mcp-session-id',
        'Mcp-Session-Id',
      ],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    }),
  )

  app.onError((err, c) => {
    if (err instanceof AuthError) {
      return jsonError(c, err.status === 403 ? 403 : 401, err.message)
    }
    if (err instanceof ComposioHttpError) {
      return jsonError(c, 502, 'upstream_error', err.message)
    }
    console.error(err)
    return c.json({ error: 'internal_error' }, 500)
  })

  app.get('/healthz', (c) =>
    c.json({
      ok: true,
      service: 'work4you-connectors-api',
      composio: deps.config.hasComposioKey,
    }),
  )

  app.get('/connected', (c) =>
    c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connected</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #0b0b0c; color: #f5f5f4; }
      main { text-align: center; max-width: 28rem; padding: 2rem; }
      h1 { font-size: 1.25rem; font-weight: 600; }
      p { color: #a8a29e; }
    </style>
  </head>
  <body>
    <main>
      <h1>You're connected</h1>
      <p>You can close this window and return to Work4You.</p>
    </main>
  </body>
</html>`),
  )

  app.post('/v1/bootstrap', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const user = await requireUser(c, deps)
    if (user instanceof Response) return user
    const session = await ensureSession(deps, user.sub)
    return c.json({
      mcp: {
        name: 'work4you_apps',
        url: `${deps.config.publicBaseUrl}/mcp`,
        transport: 'streamableHttp',
        token_env: 'WORK4YOU_APPS_MCP_TOKEN',
        token: session.token,
      },
      user_id: user.sub,
    })
  })

  app.get('/v1/apps', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const user = await requireUser(c, deps)
    if (user instanceof Response) return user
    await ensureSession(deps, user.sub)
    const accounts = await deps.composio.listAccounts(user.sub)
    const apps = ALLOWLIST.map((app) => {
      const account = pickAccount(accounts, app.slug)
      return mapApp(
        app.slug,
        app.name,
        app.description,
        app.section,
        Boolean(app.popular) || POPULAR_SLUGS.includes(app.slug),
        account?.status,
      )
    })
    return c.json({
      apps,
      sections: [...SECTION_IDS],
      popular: [...POPULAR_SLUGS],
    })
  })

  app.post('/v1/apps/:slug/authorize', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const user = await requireUser(c, deps)
    if (user instanceof Response) return user
    const slug = c.req.param('slug')
    if (!isAllowlisted(slug) || BLOCKED_SESSION_SLUGS.includes(slug)) {
      return jsonError(c, 404, 'unknown_app')
    }
    const session = await ensureSession(deps, user.sub)
    const body = (await c.req.json().catch(() => ({}))) as { callback_url?: string }
    const callbackUrl = body.callback_url || `${deps.config.publicBaseUrl}/connected`
    const link = await deps.composio.authorize(session.sessionId, slug, callbackUrl)
    return c.json({
      slug,
      redirect_url: link.redirectUrl,
      connection_id: link.connectedAccountId,
    })
  })

  app.get('/v1/apps/:slug/wait', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const user = await requireUser(c, deps)
    if (user instanceof Response) return user
    const slug = c.req.param('slug')
    if (!isAllowlisted(slug)) {
      return jsonError(c, 404, 'unknown_app')
    }
    const rawTimeout = Number(c.req.query('timeout_ms') ?? 25_000)
    const timeoutMs = Number.isFinite(rawTimeout)
      ? Math.max(0, Math.min(rawTimeout, 25_000))
      : 25_000
    const started = Date.now()
    for (;;) {
      const accounts = await deps.composio.listAccounts(user.sub)
      const account = pickAccount(accounts, slug)
      if (account?.status === 'ACTIVE') {
        return c.json({ slug, status: 'active', connected: true })
      }
      if (Date.now() - started >= timeoutMs) {
        return c.json({
          slug,
          status: account ? statusFromAccount(account.status) : 'disconnected',
          connected: false,
        })
      }
      await sleep(Math.min(1500, Math.max(50, timeoutMs)))
    }
  })

  app.post('/v1/apps/:slug/disconnect', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const user = await requireUser(c, deps)
    if (user instanceof Response) return user
    const slug = c.req.param('slug')
    if (!isAllowlisted(slug)) {
      return jsonError(c, 404, 'unknown_app')
    }
    const accounts = await deps.composio.listAccounts(user.sub)
    const account = pickAccount(accounts, slug)
    if (account) {
      await deps.composio.disableAccount(account.id)
    }
    return c.json({ slug, disconnected: true })
  })

  const mcp = (c: Parameters<typeof proxyMcp>[0]) =>
    proxyMcp(c, {
      tokens: deps.tokens,
      composioApiKey: deps.config.composioApiKey,
      fetchImpl: deps.fetchImpl,
    })
  app.all('/mcp', mcp)
  app.all('/mcp/*', mcp)

  return app
}
