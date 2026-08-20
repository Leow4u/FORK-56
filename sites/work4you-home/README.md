# Work4You Home (`https://work4you.ai`)

Marketing home for Work4You. **Independent** of the agent monorepo runtime —
this folder does not change CLI, Desktop, gateway, or docs (`website/`).

Docs stay at `https://work4you.ai/docs/` (Docusaurus in `/website`).
This site is the root vitrine: brand, product story, download / install.

## Local

```bash
cd sites/work4you-home
npm install
npm run dev
```

Build static assets for GCP:

```bash
npm run build
# output → dist/
```

## Google Cloud (target hosting)

Recommended first path (static):

1. Create a GCS bucket (e.g. `work4you-ai-home`) with website config
2. Upload `dist/` (`gsutil -m rsync -r -d dist gs://work4you-ai-home`)
3. Put **Cloud CDN + HTTPS Load Balancer** in front (managed cert for `work4you.ai` / `www`)
4. At Hostinger DNS, point `A` / `CNAME` to the load balancer

Alternative: **Firebase Hosting** in the same GCP project (`firebase deploy`).

DNS and GCP project access are required only at publish time — not to develop this site.

## Scope notes

- No Portal/Stripe/OpenRouter wiring in this package
- Download / Portal links currently point at `https://portal.work4you.ai` placeholders until assets are published on GCS
- Safe to extract later into its own GitHub repo; kept here only so we can iterate on FORK-56 without a second remote yet
