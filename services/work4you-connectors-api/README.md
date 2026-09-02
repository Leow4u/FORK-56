# Work4You Apps connector broker

Fly app **`work4you-connectors-api`** at **`https://connectors-api.work4you.ai`**.

This is the server-side Work4You Apps store. Desktop and the dashboard never
talk to Composio and never see `COMPOSIO_API_KEY`. They:

1. Send the user's **Portal JWT** to this service (`sub` is the isolation key).
2. Install one hidden MCP server named `work4you_apps` that points at
   `https://connectors-api.work4you.ai/mcp` with a per-user opaque token
   (`WORK4YOU_APPS_MCP_TOKEN`).
3. The agent uses the existing MCP client. This process proxies Streamable HTTP
   to the Composio session MCP URL and injects `x-api-key`.

Static Portal `sk-work4you-…` keys are **rejected**. Those identities would mix
people in Composio. Missing / `default` `sub` is also rejected.

## What it does

| Route | Purpose |
|-------|---------|
| `GET /healthz` | Liveness |
| `POST /v1/bootstrap` | Get-or-create Composio session; return MCP URL + opaque token |
| `GET /v1/apps` | Allowlisted apps + connection status for this `sub` |
| `POST /v1/apps/:slug/authorize` | Composio Connect Link for that toolkit |
| `GET /v1/apps/:slug/wait` | Poll until `ACTIVE` (cap 25s) |
| `POST /v1/apps/:slug/disconnect` | Disable the connected account |
| `GET /connected` | OAuth callback landing page ("you can close this window") |
| `ALL /mcp` | Reverse-proxy to the caller's Composio MCP URL |

The allowlist lives in `src/allowlist.ts`. Native MCP catalog entries
(`optional-mcps/`) are merged by the local dashboard, not here. Blocked slugs
(Notion, Linear, Firecrawl, Exa, …) are never enabled on the Composio session.

## Env (Fly secrets)

| Name | Purpose |
|------|---------|
| `COMPOSIO_API_KEY` | Platform Composio key (never shipped to clients) |
| `PORTAL_ISSUER` | default `https://portal.work4you.ai` |
| `PUBLIC_BASE_URL` | default `https://connectors-api.work4you.ai` |
| `COMPOSIO_API_BASE` | default `https://backend.composio.dev` |
| `COMPOSIO_AUTH_<SLUG>` | Optional white-label auth config id (`ac_…`) |

White-label ("Work4You wants access") is configured in the Composio dashboard
plus these `COMPOSIO_AUTH_*` secrets — not in the agent repo.

## Deploy

```bash
cd services/work4you-connectors-api
fly deploy -a work4you-connectors-api
fly secrets set -a work4you-connectors-api COMPOSIO_API_KEY=ak_…
```

## DNS

Point **`connectors-api.work4you.ai`** at this Fly app:

```bash
fly certs add connectors-api.work4you.ai -a work4you-connectors-api
```

Then CNAME (or A/AAAA from `fly ips`) at the DNS provider to
`work4you-connectors-api.fly.dev`.

## Local

```bash
cp .env.example .env   # fill COMPOSIO_API_KEY
npm install
npm test
npm run typecheck
npm run dev
```

Control-plane callers must send `Authorization: Bearer <Portal JWT>`. The MCP
proxy uses `Authorization: Bearer <w4y-c-…>` issued by `/v1/bootstrap`.
