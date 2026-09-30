# Work4You Home (`https://work4you.ai`)

Clean marketing home for Work4You.

- **Visual:** Work4You (paper / ink / Plus Jakarta / JetBrains Mono)
- **CTAs:** Hermes-faithful — only **Docs**, **Download desktop**, **Install via terminal**
- **Download button:** the only button with its own color and hard shadow (sálvia label),
  in the nav and the hero; **Fazer login** stays a text link
- **Source:** Vite + React (not a bloated Next static export)
- Independent of the agent runtime (`website/` docs stay at `/docs/`)

## Local

```bash
cd sites/work4you-home
npm install
npm run dev
```

Open http://127.0.0.1:5173/

## Hero and task order

- **Fig. 01 (hero):** the "Chatbots conversam. O Work4You trabalha." demo. Its scripts
  live in `src/lib/race-scripts.ts` (fictional data) and the timeline in
  `src/lib/race-timeline.ts`.
- **Fig. 02:** the task order built in the browser by `src/lib/task-compiler.ts`
  (simple rules, no AI, no network).
- Behavior tests: `tests-js/work4you-home-demos.test.ts` (run
  `npm run check --workspace tests-js` from the repo root).

## Build / GCP

```bash
npm run build
# upload dist/ to GCS + CDN / Load Balancer
```

## Scope

Pages like Preços / Plataforma / Portal are **out of this home** for now.
Rebuild them one by one and wire to the fork later — do not reintroduce
duplicate login/portal CTAs on the landing.

`/contact/` is a coming-soon placeholder (form later). Keep the Nav CTAs as
they are; the footer is what points at Contact.
