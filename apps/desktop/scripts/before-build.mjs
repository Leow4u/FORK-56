/**
 * Desktop bundles ship precompiled renderer assets. Returning false here tells
 * electron-builder to skip the node_modules collector/install step, which
 * avoids workspace dependency graph explosions and keeps packaging
 * deterministic across environments.
 *
 * Windows Setup and macOS DMG also ship a CI-built Python runtime in
 * extraResources (`build/runtime` → `resources/runtime`). Release CI writes a
 * present:true manifest there before pack. Local packs without a CI runtime
 * get a stub so electron-builder's extraResources `from` always exists;
 * NSIS/Electron treat present:false as a no-op and keep the 13-stage fallback.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REAL_DESKTOP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(REAL_DESKTOP_ROOT, '..', '..')

export function ensureRuntimeResourceDir(desktopRoot = REAL_DESKTOP_ROOT, repoRoot = REPO_ROOT) {
  const runtimeDir = join(desktopRoot, 'build', 'runtime')
  mkdirSync(runtimeDir, { recursive: true })

  const manifestPath = join(runtimeDir, 'manifest.json')
  let present = false
  if (existsSync(manifestPath)) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
      present = parsed && parsed.present === true
    } catch {
      present = false
    }
  }
  if (!present) {
    writeFileSync(manifestPath, `${JSON.stringify({ schemaVersion: 1, present: false }, null, 2)}\n`, 'utf8')
  }

  for (const name of ['deploy-desktop-runtime.ps1', 'deploy-desktop-runtime.sh']) {
    const deploySrc = join(repoRoot, 'scripts', name)
    const deployDest = join(runtimeDir, name)
    if (existsSync(deploySrc)) {
      copyFileSync(deploySrc, deployDest)
    }
  }

  return { runtimeDir, present }
}

export default async function beforeBuild() {
  ensureRuntimeResourceDir()
  return false
}
