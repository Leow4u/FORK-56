# Work4You Cloud runtime (golden image)

Full Work4You Docker image deployed as Fly app `work4you-cloud-runtime`.

Per-tenant Cloud VMs (`w4y-agent-*`) are created by the Portal NAS
(`work4you-account-service`) via the Fly Machines API and pull this image
(`WORK4YOU_AGENT_IMAGE`).

This is **not** the legacy Wayne / `provisioner-w4y` stack.

## What runs

- **Build:** repo-root `Dockerfile` (full Work4You agent)
- **Fly process:** `work4you dashboard --host 0.0.0.0 --port 8080 --no-open`
- **PID 1:** Fly platform → `docker/entrypoint-dispatch.sh` (non-PID-1 fallback, no s6)
- **Stub:** `Dockerfile` + `server.py` in this directory are the old bootstrap only — not used after full-image deploy

## Deploy (recommended — GitHub Actions)

Does **not** require your PC to stay on. The Fly remote builder does the work;
GitHub Actions only orchestrates and streams logs.

**One-time setup:**

1. Create a deploy token:
   ```bash
   fly tokens create deploy -a work4you-cloud-runtime -x 999999h
   ```
2. GitHub → **Leow4u/FORK-56** → Settings → Secrets and variables → Actions
3. New repository secret: `FLY_API_TOKEN` = token from step 1

**Run deploy:**

1. https://github.com/Leow4u/FORK-56/actions/workflows/fly-cloud-runtime.yml
2. **Run workflow** → branch `main` → Run
3. Wait ~30–90 min (watch in the browser; PC can sleep)
4. Job summary prints the `deployment-01…` tag for NAS stage 3

Also triggers automatically on pushes to `main` that touch `Dockerfile`,
`fly.cloud-runtime.toml`, or root lockfiles.

## Deploy (operator — local machine)

Requires Fly org token with deploy access to `work4you-cloud-runtime`.

**Windows (recommended):** deploy from the **repo root** so Docker receives the
full build context. Subdirectory `build-context = "../.."` can drop files on
Windows flyctl.

```powershell
cd C:\DEV\FORK-56
fly auth login   # or: $env:FLY_API_TOKEN = "…"
# Requires Docker Desktop running. Build locally, push to Fly registry.
fly deploy -c fly.cloud-runtime.toml -a work4you-cloud-runtime --local-only
```

`fly.cloud-runtime.toml` sets `PLAYWRIGHT_BROWSERS_SOURCE=copy` so the build
copies browsers from Microsoft's Playwright image instead of downloading from
`cdn.playwright.dev` (which hangs on Fly remote builders).

**Linux / macOS / WSL** (either path works):

```bash
# From repo root (preferred):
fly deploy -c fly.cloud-runtime.toml -a work4you-cloud-runtime --remote-only

# Or from this directory:
cd services/work4you-cloud-agent
fly deploy -a work4you-cloud-runtime --remote-only
```

On success, Fly prints a registry tag like:

`registry.fly.io/work4you-cloud-runtime:deployment-01XXXXXXXX`

Save that tag for **stage 3** (NAS pin or Vercel `WORK4YOU_AGENT_IMAGE`).

## Rollout order (do not skip)

1. **Golden image** — ✅ Release v2 `deployment-01M0QG8FXP8V4J48RPR92KPQ2B` em `work4you-cloud-runtime`
2. **NAS provision** — merge/deploy `work4you-account-service` com OAuth env + `init.cmd` dashboard (ver `docs/cloud-rollout/nas-etapa-2.md`)
3. **Image pin** — `fly-machines.ts` default ou Vercel `WORK4YOU_AGENT_IMAGE` (mesma tag)
4. **New customer instance** — delete old stub VMs, create fresh

Deploying the full image **before** stage 2 will break new instances: the dashboard
requires `WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID` on non-loopback bind.

## Local validation (optional, before fly deploy)

```bash
docker build -t work4you-cloud-test -f Dockerfile .
docker run --rm -p 8080:8080 \
  -e WORK4YOU_HOME=/opt/data \
  -e WORK4YOU_DASHBOARD_HOST=0.0.0.0 \
  -e WORK4YOU_DASHBOARD_PORT=8080 \
  -e WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID=agent:test-instance \
  -e WORK4YOU_DASHBOARD_PUBLIC_URL=http://localhost:8080 \
  -e WORK4YOU_DASHBOARD_PORTAL_URL=https://portal.work4you.ai \
  work4you-cloud-test dashboard --host 0.0.0.0 --port 8080 --no-open
```
