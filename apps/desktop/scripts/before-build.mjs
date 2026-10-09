/** Validate the runtime before packaging; release packages cannot bootstrap it. */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runtimeManifestFiles } from '../electron/runtime-manifest.mjs'

const DESKTOP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function ensureRuntimeResourceDir(desktopRoot = DESKTOP_ROOT) {
  const runtimeDir = join(desktopRoot, 'build', 'runtime')
  const error = () =>
    new Error(
      'Build the desktop runtime before packaging (scripts/build-desktop-runtime.ps1 or .sh). A complete app-owned runtime is required.'
    )
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(runtimeDir, 'manifest.json'), 'utf8'))
  } catch {
    throw error()
  }
  const files = runtimeManifestFiles(manifest)
  if (!files) throw error()
  try {
    if (files.some(file => !statSync(join(runtimeDir, file)).isFile())) throw error()
  } catch {
    throw error()
  }
  return { runtimeDir, present: true }
}

export default async function beforeBuild(context) {
  if (context?.platform?.nodeName === 'linux') {
    // Linux source/CLI builds retain their independent runtime resolution.
    const runtimeDir = join(DESKTOP_ROOT, 'build', 'runtime')
    mkdirSync(runtimeDir, { recursive: true })
    const manifest = join(runtimeDir, 'manifest.json')
    if (!existsSync(manifest)) writeFileSync(manifest, JSON.stringify({ schemaVersion: 1, present: false }) + '\n')
  } else {
    ensureRuntimeResourceDir()
  }
  // JavaScript is bundled; native modules are staged separately by beforePack.
  return false
}
