# Work4You Home (`https://work4you.ai`)

Marketing site for Work4You — **static HTML export** of the public pages.
Independent of the agent monorepo runtime: this folder does not change CLI,
Desktop, gateway, or docs (`website/`).

Docs stay at `https://work4you.ai/docs/` (Docusaurus in `/website`).
This package is the root vitrine: brand, product story, download / install.

## Contents

- `index.html` — landing
- `precos`, `recursos`, `solucoes`, `plataforma`, `modelos`, `clientes`, `baixar`, …
- `brand/` — official logo + favicon assets
- `media/` — landscapes / hero imagery (Earth branding)
- `_next/static/` — CSS/JS from the Next export

## Local preview

```bash
cd sites/work4you-home
npm install
npm run dev
```

Open http://127.0.0.1:5173/

Or without npm: `npx serve . -l 5173`

## Publish (GCP / static host)

This folder is already the build output — upload as-is:

1. GCS bucket with website config (e.g. `work4you-ai-home`)
2. `gsutil -m rsync -r -d . gs://work4you-ai-home` (exclude `node_modules`, `.git`)
3. Cloud CDN + HTTPS Load Balancer (managed cert for `work4you.ai` / `www`)
4. Hostinger DNS → load balancer

Alternative: Netlify / Cloudflare Pages / Firebase Hosting — point at this directory.

## Notes

- Links to `/login` and `/planos` may 404 in this package alone — point them at
  `portal.work4you.ai` (or the live host) when wiring production.
- Safe to extract later into its own GitHub repo; kept here to iterate on FORK-56
  without a second remote yet.
