# Work4You Portal

Account surfaces for Work4You (`portal.work4you.ai`).

Auth: **Privy** (browser) — App `work4you-portal`. Only the public App ID is used in the frontend; never commit the App Secret.

After login the app opens the **authenticated org shell** at `/orgs/:orgId`
(same route shape the CLI expects for billing and Cloud). Org id is provisional
from the Privy user until `work4you-account-service` supplies real orgs.

## Local

```bash
cd sites/work4you-portal
cp .env.example .env   # optional; default App ID is baked in
npm install
npm run dev
```

Open http://127.0.0.1:5174/login → after auth → `/orgs/…`

Allowed origins in Privy Dashboard must include `http://localhost:5174` and `https://portal.work4you.ai`.

## Deploy

Static Vite build → Vercel project with root `sites/work4you-portal`, domain `portal.work4you.ai`.
Optional env: `VITE_PRIVY_APP_ID` (defaults to the Work4You portal App ID).
