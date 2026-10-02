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

// One Work4You profile = one Composio identity. The Portal `sub` alone is the
// DEFAULT profile — unchanged for every client that sends no profile and for
// every token already persisted — and any other profile gets its own user_id,
// `<sub>::<profile>`, so its connected accounts, Composio session and MCP
// token are disjoint from the other profiles of the same Portal account.
// Profile names follow the desktop's own charset; anything else is rejected
// before it can reach Composio as an identity.
const PROFILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function identityKey(sub: string, profile: string | null | undefined): string | null {
  const raw = typeof profile === 'string' ? profile.trim() : ''
  if (!raw || raw.toLowerCase() === 'default') return sub
  if (!PROFILE_RE.test(raw)) return null
  return `${sub}::${raw}`
}

async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => null)
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
}

function requestedProfile(c: Context, body: Record<string, unknown>): string | null {
  const fromQuery = c.req.query('profile')
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()
  const fromBody = body.profile
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim()
  return null
}

type IdentityScope = { identity: string; profile: string | null }

/** The Composio identity this request acts as (query `profile` first, then the
 *  JSON body), or a 400 when the profile name is malformed. `profile` is null
 *  whenever the identity is the bare sub (no profile, or `default`). */
function resolveIdentity(c: Context, sub: string, body: Record<string, unknown> = {}): IdentityScope | Response {
  const profile = requestedProfile(c, body)
  const identity = identityKey(sub, profile)
  if (identity === null) return jsonError(c, 400, 'invalid_profile')
  return { identity, profile: identity === sub ? null : profile }
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

function connectedToolkitSlugs(
  accounts: Awaited<ReturnType<ComposioPort['listAccounts']>>,
  extra: readonly string[] = [],
): string[] {
  const active = accounts
    .filter((a) => a.status === 'ACTIVE')
    .map((a) => a.toolkit)
  return sessionToolkitSlugs([...active, ...extra])
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
  userId: string,
  extraEnable: readonly string[] = [],
  exclude: readonly string[] = [],
) {
  const accounts = await deps.composio.listAccounts(userId)
  const excluded = new Set(exclude.map((slug) => slug.trim().toLowerCase()).filter(Boolean))
  const filtered = excluded.size
    ? accounts.filter((a) => !excluded.has(a.toolkit.trim().toLowerCase()))
    : accounts
  const enable = connectedToolkitSlugs(filtered, extraEnable)
  const connected = connectedToolkitSlugs(filtered)
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
        connected,
      }
    }
    deps.tokens.revokeBySub(userId)
  }
  const created = await deps.composio.createSession(userId, authConfigs, enable)
  const record = deps.tokens.issue(userId, created.sessionId, created.mcpUrl)
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
    const scope = resolveIdentity(c, user.sub, await readJsonBody(c))
    if (scope instanceof Response) return scope
    const session = await ensureSession(deps, scope.identity)
    return c.json({
      mcp: {
        name: 'work4you_apps',
        url: `${deps.config.publicBaseUrl}/mcp`,
        transport: 'streamableHttp',
        token_env: 'WORK4YOU_APPS_MCP_TOKEN',
        token: session.token,
      },
      user_id: scope.identity,
      profile: scope.profile,
      connected: session.connected,
    })
  })

  app.get('/v1/apps', async (c) => {
    const blocked = requireComposio(c, deps)
    if (blocked) return blocked
    const user = await requireUser(c, deps)
    if (user instanceof Response) return user
    const scope = resolveIdentity(c, user.sub)
    if (scope instanceof Response) return scope
    await ensureSession(deps, scope.identity)
    const accounts = await deps.composio.listAccounts(scope.identity)
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
      profile: scope.profile,
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
    const body = await readJsonBody(c)
    const scope = resolveIdentity(c, user.sub, body)
    if (scope instanceof Response) return scope
    const session = await ensureSession(deps, scope.identity, [slug])
    const callbackUrl =
      typeof body.callback_url === 'string' && body.callback_url
        ? body.callback_url
        : `${deps.config.publicBaseUrl}/connected`
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
    const scope = resolveIdentity(c, user.sub)
    if (scope instanceof Response) return scope
    const rawTimeout = Number(c.req.query('timeout_ms') ?? 25_000)
    const timeoutMs = Number.isFinite(rawTimeout)
      ? Math.max(0, Math.min(rawTimeout, 25_000))
      : 25_000
    const started = Date.now()
    for (;;) {
      const accounts = await deps.composio.listAccounts(scope.identity)
      const account = pickAccount(accounts, slug)
      if (account?.status === 'ACTIVE') {
        await ensureSession(deps, scope.identity)
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
    const scope = resolveIdentity(c, user.sub, await readJsonBody(c))
    if (scope instanceof Response) return scope
    const accounts = await deps.composio.listAccounts(scope.identity)
    const account = pickAccount(accounts, slug)
    if (account) {
      await deps.composio.disableAccount(account.id)
    }
    // Exclude the slug even if Composio still reports ACTIVE — disable is
    // not always visible on the very next listAccounts call.
    await ensureSession(deps, scope.identity, [], [slug])
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
