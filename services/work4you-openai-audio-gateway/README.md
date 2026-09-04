# Work4You OpenAI audio gateway

OpenAI-audio-compatible gateway at **`https://openai-audio-gateway.work4you.ai`**
(Fly app `work4you-openai-audio-gateway`). Same role as
`work4you-firecrawl-gateway` / `work4you-fal-queue-gateway` /
`work4you-inference-api`, for speech-to-text and text-to-speech.

The agent already points here when Speech-to-Text or Text-to-Speech is
Work4You Subscription (`tools.managed_tool_gateway.build_vendor_gateway_url("openai-audio")`).

This is **not** the chat inference path. Chat models go through
`inference-api.work4you.ai` (OpenRouter). This host only proxies OpenAI
`/v1/audio/*`.

## What it does

1. Verifies the Portal OAuth token the OpenAI SDK sends as `api_key`
   (`scope` must include `tool:invoke` or `inference:invoke`) via JWKS at
   `portal.work4you.ai`.
2. Calls NAS `POST /api/internal/billing/authorize` (usable credits).
3. Forwards **only** `POST /v1/audio/transcriptions`,
   `POST /v1/audio/translations`, and `POST /v1/audio/speech` to
   `https://api.openai.com` with the **platform** `OPENAI_API_KEY` (never
   shown to users). Multipart bodies (Whisper file uploads) are passed through
   unchanged.
4. Optionally debits NAS when `OPENAI_AUDIO_USD_PER_REQUEST` is set and the
   upstream call succeeds.

Chat completions, images, files, and realtime are 404.

Static Portal `sk-work4you-…` keys resolve via NAS
`/api/internal/api-keys/resolve` (same billing secret as inference-api).

## Env (Fly secrets)

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | Platform OpenAI key (never shipped to clients). Create at https://platform.openai.com/api-keys |
| `INFERENCE_BILLING_SECRET` | Same value as inference-api / NAS / firecrawl-gateway |
| `PORTAL_ISSUER` | default `https://portal.work4you.ai` |
| `PORTAL_BILLING_BASE_URL` | default `https://portal.work4you.ai` |
| `OPENAI_API_URL` | default `https://api.openai.com` |
| `OPENAI_AUDIO_USD_PER_REQUEST` | optional; omit or `0` to authorize without debiting a made-up price |

## Deploy

```bash
cd services/work4you-openai-audio-gateway
fly deploy -a work4you-openai-audio-gateway
fly secrets set -a work4you-openai-audio-gateway \
  OPENAI_API_KEY=sk-… \
  INFERENCE_BILLING_SECRET=…
```

Do not put `OPENAI_API_KEY` in the desktop app, dashboard, git, or a
user `~/.work4you/.env`.

## DNS

Point **`openai-audio-gateway.work4you.ai`** → Fly:

```bash
fly certs add openai-audio-gateway.work4you.ai -a work4you-openai-audio-gateway
```

Then CNAME (or A/AAAA from `fly ips`) at your DNS provider to
`work4you-openai-audio-gateway.fly.dev`.

## Local

```bash
cp .env.example .env   # fill secrets
npm install
npm test
npm run typecheck
npm run dev
```
