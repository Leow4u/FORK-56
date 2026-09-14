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

/** Same regex as work4you_cli.profiles._PROFILE_ID_RE. */
export const PROFILE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

export function profileFromHeader(raw: string | undefined): string | { error: 'invalid_profile' } {
  const value = (raw ?? '').trim()
  if (!value) return 'default'
  if (!PROFILE_ID_RE.test(value)) return { error: 'invalid_profile' }
  return value
}

export function composioEntityId(sub: string, profile: string): string {
  return `${sub}::${profile}`
}

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

function storedToolkitSlugs(
  connected: readonly string[] | undefined,
  extra: readonly string[] = [],
  exclude: readonly string[] = [],
): string[] {
  const excluded = new Set(exclude.map((slug) => slug.trim().toLowerCase()).filter(Boolean))
  const base = [...(connected ?? []), ...extra].filter(
    (slug) => !excluded.has(slug.trim().toLowerCase()),
  )
  return sessionToolkitSlugs(base)
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

async function ensureSession(
  deps: AppDeps,
  entityId: string,
  sub: string,
  extraEnable: readonly string[] = [],
  exclude: readonly string[] = [],
  baseSlugs?: readonly string[],
) {
  const existing = deps.tokens.getByEntityId(entityId)
  const stored = baseSlugs ?? existing?.connectedSlugs ?? []
  const enable = storedToolkitSlugs(stored, extraEnable, exclude)
  const connected = storedToolkitSlugs(stored, [], exclude)
  const authConfigs = authConfigsFromEnv(deps.config.authConfigId)
  if (existing) {
    const session = await deps.composio.getSession(existing.sessionId)
    if (session) {
      await deps.composio.updateSessionToolkits(existing.sessionId, enable)
      if (baseSlugs) deps.tokens.replaceConnectedSlugs(entityId, connected)
      return {
        token: existing.token,
        sessionId: existing.sessionId,
        mcpUrl: session.mcpUrl,
        connected,
      }
    }
  }
  const created = await deps.composio.createSession(entityId, authConfigs, enable)
  const record = deps.tokens.issue(entityId, created.sessionId, created.mcpUrl, sub, {
    connectedSlugs: connected,
    accountIds: existing?.accountIds,
  })
  return {
    token: record.token,
    sessionId: created.sessionId,
    mcpUrl: created.mcpUrl,
    connected,
  }
}

function requireComposio(c: Context, deps: AppDeps) {
  if (!deps.config.hasComposioKey || !deps.config.composioApiKey) {
    return jsonError(c, 503, 'upstream_not_configured')
  }
  return null
}

type ScopedUser = {
  user: ConnectorClaims
  profile: string
  entityId: string
}

async function requireScopedUser(
  c: Context,
  deps: AppDeps,
): Promise<ScopedUser | Response> {
  const user = await requireUser(c, deps)
  if (user instanceof Response) return user
  const profile = profileFromHeader(c.req.header('x-work4you-profile'))
  if (typeof profile !== 'string') {
    return jsonError(c, 400, profile.error)
  }
  return { user, profile, entityId: composioEntityId(user.sub, profile) }
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
        'X-Work4You-Profile',
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
    const scoped = await requireScopedUser(c, deps)
    if (scoped instanceof Response) return scoped
    const body = (await c.req.json().catch(() => ({}))) as { connected_apps?: unknown }
    const homeSlugs = Array.isArray(body.connected_apps)
      ? sessionToolkitSlugs(body.connected_apps.map((item) => String(item)))
      : undefined
    const session = await ensureSession(
      deps,
      scoped.entityId,
      scoped.user.sub,
      [],
      [],
      homeSlugs,
    )
    return c.json({
      mcp: {
        name: 'work4you_apps',
        url: `${deps.config.publicBaseUrl}/mcp`,
        transport: 'streamableHttp',
        token_env: 'WORK4YOU_APPS_MCP_TOKEN',
        token: session.token,
      },
      user_id: scoped.user.sub,
      entity_id: scoped.entityId,
      connected: session.connected,
    })
  })

  app.get('/v1/apps', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const scoped = await requireScopedUser(c, deps)
    if (scoped instanceof Response) return scoped
    // Directory paint must not create/arm a tool-router session. Native MCP
    // badges read this HOME's mcp.json; Apps badges read this entity's stored
    // slugs. listAccounts is not a per-home install list.
    const connected = new Set(
      (deps.tokens.getByEntityId(scoped.entityId)?.connectedSlugs ?? []).map((slug) =>
        slug.trim().toLowerCase(),
      ),
    )
    const apps = ALLOWLIST.map((app) =>
      mapApp(
        app.slug,
        app.name,
        app.description,
        app.section,
        Boolean(app.popular) || POPULAR_SLUGS.includes(app.slug),
        connected.has(app.slug.trim().toLowerCase()) ? 'ACTIVE' : undefined,
      ),
    )
    return c.json({
      apps,
      sections: [...SECTION_IDS],
      popular: [...POPULAR_SLUGS],
    })
  })

  app.post('/v1/apps/:slug/authorize', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const scoped = await requireScopedUser(c, deps)
    if (scoped instanceof Response) return scoped
    const slug = c.req.param('slug')
    if (!isAllowlisted(slug) || BLOCKED_SESSION_SLUGS.includes(slug)) {
      return jsonError(c, 404, 'unknown_app')
    }
    const session = await ensureSession(deps, scoped.entityId, scoped.user.sub, [slug])
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
    const scoped = await requireScopedUser(c, deps)
    if (scoped instanceof Response) return scoped
    const slug = c.req.param('slug')
    if (!isAllowlisted(slug)) {
      return jsonError(c, 404, 'unknown_app')
    }
    const rawTimeout = Number(c.req.query('timeout_ms') ?? 25_000)
    const timeoutMs = Number.isFinite(rawTimeout)
      ? Math.max(0, Math.min(rawTimeout, 25_000))
      : 25_000
    const connectionId = (c.req.query('connection_id') ?? '').trim()
    if (!connectionId) {
      return c.json({ slug, status: 'disconnected', connected: false })
    }
    const started = Date.now()
    let lastStatus: string | undefined
    for (;;) {
      const account = await deps.composio.getAccount(connectionId)
      lastStatus = account?.status
      const toolkit = (account?.toolkit ?? '').trim().toLowerCase()
      if (account?.status === 'ACTIVE' && toolkit === slug.trim().toLowerCase()) {
        await ensureSession(deps, scoped.entityId, scoped.user.sub)
        deps.tokens.stampApp(scoped.entityId, slug, account.id)
        await ensureSession(deps, scoped.entityId, scoped.user.sub)
        return c.json({ slug, status: 'active', connected: true })
      }
      if (Date.now() - started >= timeoutMs) {
        // Drop authorize-time extraEnable so an abandoned OAuth does not
        // leave this entity's session armed with another home's toolkit.
        if (deps.tokens.getByEntityId(scoped.entityId)) {
          await ensureSession(deps, scoped.entityId, scoped.user.sub)
        }
        return c.json({
          slug,
          status: lastStatus ? statusFromAccount(lastStatus) : 'disconnected',
          connected: false,
        })
      }
      await sleep(Math.min(1500, Math.max(50, timeoutMs)))
    }
  })

  app.post('/v1/apps/:slug/disconnect', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const scoped = await requireScopedUser(c, deps)
    if (scoped instanceof Response) return scoped
    const slug = c.req.param('slug')
    if (!isAllowlisted(slug)) {
      return jsonError(c, 404, 'unknown_app')
    }
    const existing = deps.tokens.getByEntityId(scoped.entityId)
    const accountId = deps.tokens.unstampApp(scoped.entityId, slug)
    if (accountId) {
      await deps.composio.disableAccount(accountId)
    }
    if (existing) {
      await ensureSession(deps, scoped.entityId, scoped.user.sub, [], [slug])
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
