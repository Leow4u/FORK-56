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

function pickAccount(
  accounts: Awaited<ReturnType<ComposioPort['listAccounts']>>,
  slug: string,
) {
  const requested = slug.trim().toLowerCase()
  const matches = accounts.filter((a) => a.toolkit.trim().toLowerCase() === requested)
  return matches.find((a) => a.status === 'ACTIVE') ?? matches[0]
}

/** Default OAuth landing. Composio keeps these query params and appends status + connected_account_id. */
function connectCallbackUrl(
  publicBaseUrl: string,
  entityId: string,
  slug: string,
  sessionId?: string,
): string {
  const url = new URL(`${publicBaseUrl.replace(/\/$/, '')}/connected`)
  url.searchParams.set('entity_id', entityId)
  url.searchParams.set('slug', slug)
  const sid = (sessionId ?? '').trim()
  if (sid) url.searchParams.set('session_id', sid)
  return url.toString()
}

async function listedAccountsForConnect(
  deps: AppDeps,
  scoped: ScopedUser,
): Promise<Awaited<ReturnType<ComposioPort['listAccounts']>>> {
  // #175 listed Portal `sub`. #251 listed `sub::{profile}`. OAuth often
  // tags the minted ca_ with `sub` (no ::profile), so wait must query both.
  // Other profile entity ids (sub::default vs sub::leona) are not listed —
  // directory and wait-without-id stay on this HOME's stored slugs.
  const userIds = [scoped.entityId]
  if (scoped.user.sub && scoped.user.sub !== scoped.entityId) {
    userIds.push(scoped.user.sub)
  }
  const byId = new Map<string, Awaited<ReturnType<ComposioPort['listAccounts']>>[number]>()
  for (const userId of userIds) {
    const rows = await deps.composio.listAccounts(userId)
    for (const row of rows) {
      if (!row.id) continue
      const prev = byId.get(row.id)
      if (!prev || (row.status === 'ACTIVE' && prev.status !== 'ACTIVE')) {
        byId.set(row.id, row)
      }
    }
  }
  return [...byId.values()]
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

async function thisHomeSessionId(
  deps: AppDeps,
  entityId: string,
  requestedSessionId: string,
): Promise<string> {
  // This HOME's token wins. A query session_id is only used when this
  // machine has no record, and only if Composio says user_id === entityId.
  const record = deps.tokens.getByEntityId(entityId)
  if (record?.sessionId) return record.sessionId
  const requested = requestedSessionId.trim()
  if (!requested) return ''
  const session = await deps.composio.getSession(requested)
  if (session?.userId === entityId) return requested
  return ''
}

async function stampThisHome(
  deps: AppDeps,
  entityId: string,
  sub: string,
  slug: string,
  accountId: string,
  sessionId?: string,
): Promise<void> {
  if (!deps.tokens.getByEntityId(entityId) && sessionId) {
    const session = await deps.composio.getSession(sessionId)
    if (session?.userId === entityId) {
      deps.tokens.issue(entityId, session.sessionId, session.mcpUrl, sub)
    }
  }
  await ensureSession(deps, entityId, sub)
  deps.tokens.stampApp(entityId, slug, accountId)
  await ensureSession(deps, entityId, sub)
  const record = deps.tokens.getByEntityId(entityId)
  if (record?.sessionId) {
    try {
      await deps.composio.pinSessionAccount(record.sessionId, slug, accountId)
    } catch (err) {
      console.error('[work4you-connectors-api] pin session account failed', err)
    }
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

function portalSubFromEntityId(entityId: string): string {
  const idx = entityId.lastIndexOf('::')
  return idx === -1 ? entityId : entityId.slice(0, idx)
}

async function stampFromConnectedQuery(
  deps: AppDeps,
  entityId: string,
  slug: string,
  accountId: string,
  requestedSessionId: string,
): Promise<void> {
  if (!isAllowlisted(slug) || BLOCKED_SESSION_SLUGS.includes(slug)) return
  const requested = slug.trim().toLowerCase()
  const account = await deps.composio.getAccount(accountId)
  const toolkit = (account?.toolkit ?? '').trim().toLowerCase()
  if (toolkit && toolkit !== requested) return
  if (account?.status === 'EXPIRED') return
  // Composio's callback status=success is the OAuth completion signal.
  // getAccount(callback ca_) can still be INITIATED for a beat (or this
  // machine has no TokenStore after a Fly replace). Pin THIS HOME's
  // session anyway — wait's /link id stays INITIATED until we do.
  const pinId = (account?.id || accountId).trim()
  if (!pinId) return
  const record = deps.tokens.getByEntityId(entityId)
  let sessionId = record?.sessionId ?? ''
  const requestedSid = requestedSessionId.trim()
  if (!sessionId && requestedSid) {
    const session = await deps.composio.getSession(requestedSid)
    if (session?.userId === entityId) sessionId = requestedSid
  }
  if (!sessionId) return
  const session = await deps.composio.getSession(sessionId)
  if (session?.userId !== entityId) return
  const sub = record?.sub || portalSubFromEntityId(entityId)
  if (!sub) return
  try {
    await deps.composio.pinSessionAccount(sessionId, slug, pinId)
  } catch (err) {
    console.error('[work4you-connectors-api] /connected pin session account failed', err)
  }
  if (!deps.tokens.getByEntityId(entityId)) {
    deps.tokens.issue(entityId, session.sessionId, session.mcpUrl, sub)
  }
  if (account?.status === 'ACTIVE') {
    await stampThisHome(deps, entityId, sub, slug, pinId, sessionId)
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

const CONNECTED_HTML = `<!doctype html>
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
</html>`

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

  app.get('/connected', async (c) => {
    const status = (c.req.query('status') ?? '').trim().toLowerCase()
    const accountId = (c.req.query('connected_account_id') ?? '').trim()
    const entityId = (c.req.query('entity_id') ?? '').trim()
    const slug = (c.req.query('slug') ?? '').trim()
    const sessionId = (c.req.query('session_id') ?? '').trim()
    // Identity must come from authorize's callback_url. A bare
    // /connected?connected_account_id= must not stamp another HOME.
    if (status === 'success' && accountId && entityId && slug) {
      try {
        await stampFromConnectedQuery(deps, entityId, slug, accountId, sessionId)
      } catch (err) {
        console.error('[work4you-connectors-api] /connected stamp failed', err)
      }
    }
    return c.html(CONNECTED_HTML)
  })

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
      session_id: session.sessionId,
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
    const callbackUrl =
      (typeof body.callback_url === 'string' && body.callback_url.trim()) ||
      connectCallbackUrl(
        deps.config.publicBaseUrl,
        scoped.entityId,
        slug,
        session.sessionId,
      )
    const link = await deps.composio.authorize(session.sessionId, slug, callbackUrl)
    return c.json({
      slug,
      redirect_url: link.redirectUrl,
      connection_id: link.connectedAccountId,
      session_id: session.sessionId,
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
    const requested = slug.trim().toLowerCase()
    const stampedId = deps.tokens.getByEntityId(scoped.entityId)?.accountIds[requested]
    if (stampedId) {
      const record = deps.tokens.getByEntityId(scoped.entityId)
      return c.json({
        slug,
        status: 'active',
        connected: true,
        ...(record?.token ? { token: record.token, session_id: record.sessionId } : {}),
      })
    }
    const started = Date.now()
    let lastStatus: string | undefined
    for (;;) {
      // Official detector (docs.composio.dev/docs/authentication/manually-authenticating):
      // session.toolkits() → connected_account.status === ACTIVE. Isolated to
      // THIS HOME's session (token session_id, or query session_id whose
      // user_id === this entity). Never another profile's session.
      const sessionId = await thisHomeSessionId(
        deps,
        scoped.entityId,
        c.req.query('session_id') ?? '',
      )
      if (sessionId) {
        const toolkits = await deps.composio.listSessionToolkits(sessionId, slug)
        const listedToolkit = pickAccount(toolkits, slug)
        if (listedToolkit?.status === 'ACTIVE') {
          await stampThisHome(
            deps,
            scoped.entityId,
            scoped.user.sub,
            slug,
            listedToolkit.id,
            sessionId,
          )
          const record = deps.tokens.getByEntityId(scoped.entityId)
          return c.json({
            slug,
            status: 'active',
            connected: true,
            ...(record?.token ? { token: record.token, session_id: record.sessionId } : {}),
          })
        }
      }
      // Official wait_for_connection: retrieve(/link connected_account_id).
      const account = await deps.composio.getAccount(connectionId)
      lastStatus = account?.status
      const toolkit = (account?.toolkit ?? '').trim().toLowerCase()
      if (account?.status === 'ACTIVE' && (!toolkit || toolkit === requested)) {
        await stampThisHome(deps, scoped.entityId, scoped.user.sub, slug, account.id)
        const record = deps.tokens.getByEntityId(scoped.entityId)
        return c.json({
          slug,
          status: 'active',
          connected: true,
          ...(record?.token ? { token: record.token, session_id: record.sessionId } : {}),
        })
      }
      // Original Connect listed this entity (and Portal sub). Other profile
      // entity ids are not listed — directory and wait-without-id stay on
      // this HOME's stored slugs.
      const accounts = await listedAccountsForConnect(deps, scoped)
      const listed = pickAccount(accounts, slug)
      if (listed?.status === 'ACTIVE') {
        await stampThisHome(deps, scoped.entityId, scoped.user.sub, slug, listed.id)
        const record = deps.tokens.getByEntityId(scoped.entityId)
        return c.json({
          slug,
          status: 'active',
          connected: true,
          ...(record?.token ? { token: record.token, session_id: record.sessionId } : {}),
        })
      }
      lastStatus = account?.status ?? listed?.status
      if (Date.now() - started >= timeoutMs) {
        // A slice timeout is "still pending", not abandon. Session cleanup
        // stays on stamp / disconnect / bootstrap from this HOME's
        // connected_apps.
        return c.json({
          slug,
          status: lastStatus ? statusFromAccount(lastStatus) : 'initiated',
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
