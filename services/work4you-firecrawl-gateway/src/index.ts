/**
 * Work4You firecrawl-gateway — Hermes-equivalent Firecrawl passthrough.
 *
 * Client → Bearer (Portal token) → authorize NAS → Firecrawl (platform key)
 * → optional debit NAS. Firecrawl never appears in client-facing auth.
 */
import { serve } from '@hono/node-server'

import { verifyInvokeBearer } from './auth.js'
import { authorizeOrg, debitOrg } from './billing.js'
import { config } from './config.js'
import { createFirecrawlFetch } from './firecrawl.js'
import { createApp } from './app.js'

const app = createApp({
  config: {
    get hasFirecrawlKey() {
      return config.hasFirecrawlKey()
    },
    get hasBillingSecret() {
      return config.hasBillingSecret()
    },
    get usdPerCredit() {
      return config.usdPerCredit()
    },
  },
  verifyBearer: verifyInvokeBearer,
  authorizeOrg,
  debitOrg,
  firecrawlFetch: ((path, init) =>
    createFirecrawlFetch({
      apiUrl: config.firecrawlApiUrl,
      apiKey: config.hasFirecrawlKey() ? config.firecrawlApiKey : '',
      timeoutMs: config.timeoutMs(),
    })(path, init)),
})

const port = config.port
console.log(`[work4you-firecrawl-gateway] listening on :${port}`)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
