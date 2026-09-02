import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = resolve(root, 'build/composio-logo-native/composio-logo-native.mjs')
const electronBin = createRequire(import.meta.url)('electron')

mkdirSync(dirname(outfile), { recursive: true })

await build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: [resolve(root, 'electron/composio-logo-native.mjs')],
  external: ['electron'],
  format: 'esm',
  outfile,
  platform: 'node'
})

const child = spawn(electronBin, [outfile], {
  cwd: root,
  env: process.env,
  stdio: 'inherit'
})

child.on('exit', code => {
  process.exit(code ?? 1)
})
