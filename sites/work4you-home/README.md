# Work4You Home (`https://work4you.ai`)

Clean marketing home for Work4You.

- **Visual:** Work4You (paper / ink / Plus Jakarta / JetBrains Mono)
- **CTAs:** Hermes-faithful — only **Docs**, **Download desktop**, **Install via terminal**
- **Source:** Vite + React (not a bloated Next static export)
- Independent of the agent runtime (`website/` docs stay at `/docs/`)

## Local

```bash
cd sites/work4you-home
npm install
npm run dev
```

Open http://127.0.0.1:5173/

## Build

```bash
npm run build
```

Output is `dist/`.

## Scope

Pages like Preços / Plataforma / Portal are **out of this home** for now.
Rebuild them one by one and wire to the fork later — do not reintroduce
duplicate login/portal CTAs on the landing.
