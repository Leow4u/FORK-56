import path from 'node:path'

/**
 * Static ESM entry for `@tabler/icons-react`.
 *
 * The package's default `dist/esm/tabler-icons-react.mjs` re-exports every
 * icon as `./icons/IconX.mjs` and also `import *`s `./icons/index.mjs`.
 * Vite 8 / Rolldown on Windows then attributes those `./icons/…` specifiers
 * to `icons/index.mjs`, so they resolve to `icons/icons/IconX.mjs` and the
 * desktop `npm run pack` dies with thousands of UNRESOLVED_IMPORT errors
 * (first hit: IconNumber123.mjs).
 *
 * `icons/index.mjs` exports the same icons as `./IconX.mjs` (same folder).
 */
export function tablerIconsReactStaticEntry(packageJsonPath: string): string {
  return path.join(path.dirname(packageJsonPath), 'dist', 'esm', 'icons', 'index.mjs')
}
