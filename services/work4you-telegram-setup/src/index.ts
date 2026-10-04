/**
 * Work4You Telegram setup service (setup.work4you.ai).
 *
 * The Work4You app asks for a pairing, shows its t.me/newbot link as a QR
 * code, and polls until the person's new bot exists; this process, as the
 * manager bot, reads the bot's token from Telegram and hands it over once.
 */
import { serve } from '@hono/node-server'

import { createApp } from './app.js'
import { config } from './config.js'
import { RateLimiter } from './rate-limit.js'
import { TelegramSetup } from './setup.js'
import { createTelegramClient } from './telegram.js'
import { runUpdateLoop } from './updates.js'

const telegram = config.managerBotToken
  ? createTelegramClient({ token: config.managerBotToken, apiBase: config.telegramApiBase })
  : null
const setup = new TelegramSetup({ telegram })
// A person may restart the QR a few times; 20 in 10 minutes per IP is plenty.
const createLimiter = new RateLimiter(20, 10 * 60_000)
const app = createApp({ setup, createLimiter })

const controller = new AbortController()
if (telegram) {
  void setup.managerStatus()
  void runUpdateLoop({
    telegram,
    onUpdate: (update) => setup.handleUpdate(update),
    signal: controller.signal,
    state: setup.updates,
  })
} else {
  console.warn('[work4you-telegram-setup] TELEGRAM_MANAGER_BOT_TOKEN is not set: new pairings answer 503')
}

const sweeper = setInterval(() => {
  setup.sweep()
  createLimiter.sweep()
  // Keeps /healthz current, e.g. after Bot Management Mode is turned on. Cached, so cheap.
  void setup.managerStatus()
}, 30_000)
sweeper.unref()

const port = config.port
console.log(`[work4you-telegram-setup] listening on :${port}`)
const server = serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })

function shutdown() {
  controller.abort()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3_000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
