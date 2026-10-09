# Work4You Firecrawl gateway

Firecrawl-compatible gateway at **`https://firecrawl-gateway.work4you.ai`** (Fly
app `work4you-firecrawl-gateway`). Same role as `work4you-inference-api`, for
web search and extract.

The agent already points here when Web Search is Work4You Subscription
(`tools.managed_tool_gateway.build_vendor_gateway_url("firecrawl")`).

## What it does

1. Verifies the Portal OAuth token the Firecrawl SDK sends as `api_key`
   (`scope` must include `tool:invoke` or `inference:invoke`) via JWKS at
   `portal.work4you.ai`.
2. Calls NAS `POST /api/internal/billing/authorize` (usable credits).
3. Forwards **only** `POST /v1|/v2/search` and `POST /v1|/v2/scrape` to
   Firecrawl with the **platform** `FIRECRAWL_API_KEY` (never shown to users).
4. Optionally debits NAS when `FIRECRAWL_USD_PER_CREDIT` is set and Firecrawl
   returns `creditsUsed`.

Surfaces: `/healthz`, `/health/liveliness`, `/v1/search`, `/v1/scrape`,
`/v2/search`, `/v2/scrape`.

Team, crawl, agent, and billing Firecrawl routes are not proxied.

Static Portal `sk-work4you-…` keys resolve via NAS
`/api/internal/api-keys/resolve` (same billing secret as inference-api).

## Env (Fly secrets)

| Secret | Purpose |
|--------|---------|
| `FIRECRAWL_API_KEY` | Platform Firecrawl key (never shipped to clients) |
| `INFERENCE_BILLING_SECRET` | Same value as inference-api / NAS |
| `PORTAL_ISSUER` | default `https://portal.work4you.ai` |
| `PORTAL_BILLING_BASE_URL` | default `https://portal.work4you.ai` |
| `FIRECRAWL_API_URL` | default `https://api.firecrawl.dev` |
| `FIRECRAWL_USD_PER_CREDIT` | optional; omit or `0` to authorize without debiting a made-up price |

## Deploy

```bash
cd services/work4you-firecrawl-gateway
fly deploy -a work4you-firecrawl-gateway
fly secrets set -a work4you-firecrawl-gateway \
  FIRECRAWL_API_KEY=fc-… \
  INFERENCE_BILLING_SECRET=…
```

Do not put `FIRECRAWL_API_KEY` in the desktop app, dashboard, git, or a
user `~/.work4you/.env`.

## DNS

Point **`firecrawl-gateway.work4you.ai`** → Fly:

```bash
fly certs add firecrawl-gateway.work4you.ai -a work4you-firecrawl-gateway
```

Then CNAME (or A/AAAA from `fly ips`) at your DNS provider to
`work4you-firecrawl-gateway.fly.dev`.

## Local

```bash
cp .env.example .env   # fill secrets
npm install
npm test
npm run typecheck
npm run dev
```
