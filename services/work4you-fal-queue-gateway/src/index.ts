/**
 * Work4You fal-queue-gateway — Hermes-equivalent FAL queue passthrough.
 *
 * Client → Key/Bearer (Portal token) → authorize NAS on submit →
 * FAL queue (platform key) → optional debit NAS on result.
 * FAL never appears in client-facing auth.
 */
import { serve } from '@hono/node-server'

import { verifyInvokeBearer } from './auth.js'
import { authorizeOrg, debitOrg } from './billing.js'
import { config } from './config.js'
import { createFalFetch } from './fal.js'
import { createApp } from './app.js'

const app = createApp({
  config: {
    get hasFalKey() {
      return config.hasFalKey()
    },
    get hasBillingSecret() {
      return config.hasBillingSecret()
    },
    get usdPerRequest() {
      return config.usdPerRequest()
    },
    get falQueueUrl() {
      return config.falQueueUrl
    },
  },
  verifyBearer: verifyInvokeBearer,
  authorizeOrg,
  debitOrg,
  falFetch: ((path, init) =>
    createFalFetch({
      queueUrl: config.falQueueUrl,
      apiKey: config.hasFalKey() ? config.falKey : '',
      timeoutMs: config.timeoutMs(),
    })(path, init)),
})

const port = config.port
console.log(`[work4you-fal-queue-gateway] listening on :${port}`)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
