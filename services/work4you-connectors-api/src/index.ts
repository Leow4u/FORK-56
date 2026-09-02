/**
 * Work4You Apps connector broker.
 *
 * Portal JWT (sub) → Composio tool-router session → Streamable HTTP MCP proxy.
 * The platform COMPOSIO_API_KEY never leaves this process.
 */
import { serve } from '@hono/node-server'

import { createApp } from './app.js'
import { verifyPortalBearer } from './auth.js'
import { config } from './config.js'
import { createComposioClient } from './composio.js'
import { TokenStore } from './tokens.js'

const tokens = new TokenStore()
const composio = createComposioClient({
  apiBase: config.composioApiBase,
  apiKey: config.hasComposioKey() ? config.composioApiKey : '',
  callbackUrl: `${config.publicBaseUrl}/connected`,
})

const app = createApp({
  config: {
    publicBaseUrl: config.publicBaseUrl,
    get composioApiKey() {
      return config.hasComposioKey() ? config.composioApiKey : ''
    },
    get hasComposioKey() {
      return config.hasComposioKey()
    },
    authConfigId: (slug) => config.authConfigId(slug),
  },
  composio,
  tokens,
  verifyBearer: verifyPortalBearer,
})

const port = config.port
console.log(`[work4you-connectors-api] listening on :${port}`)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
