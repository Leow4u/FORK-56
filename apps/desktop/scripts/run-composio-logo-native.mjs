import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outdir = resolve(root, 'build/composio-logo-native')
const outfile = resolve(outdir, 'composio-logo-native.mjs')
const rendererOutfile = resolve(outdir, 'mcp-avatar-native-renderer.js')
const electronBin = createRequire(import.meta.url)('electron')

mkdirSync(outdir, { recursive: true })

await build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: [resolve(root, 'electron/composio-logo-native.mjs')],
  external: ['electron'],
  format: 'esm',
  outfile,
  platform: 'node'
})

await build({
  absWorkingDir: root,
  alias: {
    '@': resolve(root, 'src'),
    '@work4you/shared': resolve(root, '../shared/src/index.ts')
  },
  bundle: true,
  entryPoints: [resolve(root, 'electron/mcp-avatar-native-renderer.tsx')],
  format: 'iife',
  jsx: 'automatic',
  outfile: rendererOutfile,
  platform: 'browser'
})

const child = spawn(electronBin, [outfile], {
  cwd: root,
  env: process.env,
  stdio: 'inherit'
})

child.on('exit', code => {
  process.exit(code ?? 1)
})
