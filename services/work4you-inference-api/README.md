# Work4You Inference API

OpenAI-compatible gateway at **`https://inference-api.work4you.ai`** (Fly app
`work4you-inference-api`). Same role as Hermes’ `inference-api.nousresearch.com`.

## What it does

1. Verifies Portal OAuth **invoke JWT** (`scope` must include `inference:invoke`) via JWKS at `portal.work4you.ai`.
2. Calls NAS `POST /api/internal/billing/authorize` (usable credits).
3. Forwards to **OpenRouter** with the **platform** `OPENROUTER_API_KEY` (never shown to users).
4. Debits NAS `POST /api/internal/billing/debit` from usage/cost.

Surfaces: `/v1/models`, `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/messages` (Anthropic-shaped → chat).

Static Portal `sk-work4you-…` keys are resolved via NAS
`/api/internal/api-keys/resolve` (same billing secret). Agent/Desktop keep using
OAuth invoke JWTs after device login.

**Plan gates (Hermes-style):** Free plan may only invoke free/`$0` models
(`paid_plan_required` otherwise). Plus/Super/Ultra unlock the full catalog.

**Rate limits (per org, rolling 60s):** Free 50 RPM / 500K TPM · Plus 400 / 4M ·
Super 800 / 8M · Ultra 1600 / 16M.

## Env (Fly secrets)

| Secret | Purpose |
|--------|---------|
| `OPENROUTER_API_KEY` | Platform OpenRouter key (management / org key) |
| `INFERENCE_BILLING_SECRET` | Same value as Vercel/NAS |
| `PORTAL_ISSUER` | default `https://portal.work4you.ai` |
| `PORTAL_BILLING_BASE_URL` | default `https://portal.work4you.ai` |

## Deploy

```bash
cd services/work4you-inference-api
fly deploy -a work4you-inference-api
fly secrets set -a work4you-inference-api \
  OPENROUTER_API_KEY=sk-or-v1-… \
  INFERENCE_BILLING_SECRET=…
```

## DNS

Point **`inference-api.work4you.ai`** → Fly:

```bash
fly certs add inference-api.work4you.ai -a work4you-inference-api
```

Then CNAME (or A/AAAA from `fly ips`) at your DNS provider to `work4you-inference-api.fly.dev`.

## Local

```bash
cp .env.example .env   # fill secrets
npm install
npm run dev
```
