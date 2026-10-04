import { Hono, type Context } from 'hono'

import type { RateLimiter } from './rate-limit.js'
import type { SetupResponse, TelegramSetup } from './setup.js'

export interface AppDeps {
  setup: TelegramSetup
  /** Pairings one client IP may start per window. */
  createLimiter: RateLimiter
}

/** Fly's proxy sets Fly-Client-IP itself, over anything a client sends. */
function clientIp(c: Context): string {
  return (
    c.req.header('fly-client-ip')?.trim() ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    'direct'
  )
}

// Pairing responses carry the poll token or the bot token: never cached.
function send(c: Context, res: SetupResponse) {
  c.header('Cache-Control', 'no-store')
  return c.json(res.body, res.status)
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get('/', (c) => c.json({ service: 'work4you-telegram-setup', status: 'ok' }))
  app.get('/healthz', (c) => c.json(deps.setup.health()))

  app.post('/v1/telegram/pairings', async (c) => {
    if (!deps.createLimiter.take(clientIp(c))) {
      c.header('Retry-After', '60')
      return c.json({ error: 'rate_limited' }, 429)
    }
    const body: unknown = await c.req.json().catch(() => null)
    const botName =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).bot_name
        : undefined
    return send(c, await deps.setup.createPairing(botName))
  })

  app.get('/v1/telegram/pairings/:id', async (c) =>
    send(c, await deps.setup.pollPairing(c.req.param('id'), c.req.header('authorization'))),
  )

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError((err, c) => {
    console.error('[work4you-telegram-setup] request failed', err)
    return c.json({ error: 'internal_error' }, 500)
  })
  return app
}
