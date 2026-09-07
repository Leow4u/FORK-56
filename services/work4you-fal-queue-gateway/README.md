# Work4You FAL queue gateway

FAL-queue-compatible gateway at **`https://fal-queue-gateway.work4you.ai`** (Fly
app `work4you-fal-queue-gateway`). Same role as `work4you-firecrawl-gateway` /
`work4you-inference-api`, for image generation.

The agent already points here when Image Generation is Work4You Subscription
(`tools.managed_tool_gateway.build_vendor_gateway_url("fal-queue")`).

## What it does

1. Verifies the Portal OAuth token `fal_client` sends as
   `Authorization: Key <token>` (Bearer is also accepted). `scope` must include
   `tool:invoke` or `inference:invoke` via JWKS at `portal.work4you.ai`.
2. On **submit** (`POST /{app}`) calls NAS `POST /api/internal/billing/authorize`
   (usable credits) and consumes the org RPM window.
3. Forwards only the image apps in `src/paths.ts` to `https://queue.fal.run`
   with the **platform** `FAL_KEY` (never shown to users).
4. Rewrites `queue.fal.run` URLs in the JSON (`response_url`, `status_url`,
   `cancel_url`) onto this gateway origin so status polls stay on the
   subscription host. CDN image URLs (`fal.media`) are left alone.
5. Status / result / cancel GETs and PUTs require the Portal token but do
   **not** hit NAS or RPM (fal_client polls every ~0.5s).
6. Optionally debits NAS when `FAL_USD_PER_REQUEST` is set and a result GET
   succeeds. Idempotency key is the FAL request id.

Video FAL apps (`fal-ai/veo3.1`, …) and `fal_webhook` query params are 404.

Static Portal `sk-work4you-…` keys resolve via NAS
`/api/internal/api-keys/resolve` (same billing secret as inference-api).

## Env (Fly secrets)

| Secret | Purpose |
|--------|---------|
| `FAL_KEY` | Platform FAL key (never shipped to clients) |
| `INFERENCE_BILLING_SECRET` | Same value as inference-api / NAS / firecrawl-gateway |
| `PORTAL_ISSUER` | default `https://portal.work4you.ai` |
| `PORTAL_BILLING_BASE_URL` | default `https://portal.work4you.ai` |
| `FAL_QUEUE_URL` | default `https://queue.fal.run` |
| `FAL_USD_PER_REQUEST` | optional; omit or `0` to authorize without debiting a made-up price |

## Deploy

```bash
cd services/work4you-fal-queue-gateway
fly deploy -a work4you-fal-queue-gateway
fly secrets set -a work4you-fal-queue-gateway \
  FAL_KEY=… \
  INFERENCE_BILLING_SECRET=…
```

Do not put `FAL_KEY` in the desktop app, dashboard, git, or a
user `~/.work4you/.env`.

## DNS

Point **`fal-queue-gateway.work4you.ai`** → Fly:

```bash
fly certs add fal-queue-gateway.work4you.ai -a work4you-fal-queue-gateway
```

Then CNAME (or A/AAAA from `fly ips`) at your DNS provider to
`work4you-fal-queue-gateway.fly.dev`.

## Local

```bash
cp .env.example .env   # fill secrets
npm install
npm test
npm run typecheck
npm run dev
```
