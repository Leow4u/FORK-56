/**
 * Work4You openai-audio-gateway — Hermes-equivalent OpenAI audio passthrough.
 *
 * Client → Bearer (Portal token) → authorize NAS → OpenAI (platform key)
 * → optional debit NAS. OpenAI never appears in client-facing auth.
 */
import { serve } from '@hono/node-server'

import { verifyInvokeBearer } from './auth.js'
import { authorizeOrg, debitOrg } from './billing.js'
import { config } from './config.js'
import { createOpenAIFetch } from './openai.js'
import { createApp } from './app.js'

const app = createApp({
  config: {
    get hasOpenAIKey() {
      return config.hasOpenAIKey()
    },
    get hasBillingSecret() {
      return config.hasBillingSecret()
    },
    get usdPerRequest() {
      return config.usdPerRequest()
    },
  },
  verifyBearer: verifyInvokeBearer,
  authorizeOrg,
  debitOrg,
  openaiFetch: (path, init) =>
    createOpenAIFetch({
      apiUrl: config.openaiApiUrl,
      apiKey: config.hasOpenAIKey() ? config.openaiApiKey : '',
      timeoutMs: config.timeoutMs(),
    })(path, init),
})

const port = config.port
console.log(`[work4you-openai-audio-gateway] listening on :${port}`)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
