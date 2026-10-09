import path from 'node:path'

import { buildDesktopBackendEnv, work4youManagedNodePathEntries } from './backend-env'
import { runtimeManifestFiles } from './runtime-manifest.mjs'

/**
 * Packaged Windows Setup and macOS DMG can ship a CI-built Python runtime in
 * extraResources (`resources/runtime`). The shell and runtime are one release.
 * Packaged launches use that tree directly, with a separate writable data HOME.
 *
 * Pure helpers (no Electron imports) so node:test can cover the gate without
 * booting the app.
 */

export const BUNDLED_RUNTIME_DIRNAME = 'runtime'
export const BUNDLED_RUNTIME_MANIFEST = 'manifest.json'
export const BUNDLED_RUNTIME_SCHEMA_VERSION = 1

export interface BundledRuntimeManifest {
  schemaVersion?: unknown
  present?: unknown
  commit?: unknown
  branch?: unknown
  arch?: unknown
  layout?: unknown
  pythonExecutable?: unknown
  capabilities?: unknown
  interfaces?: unknown
}

export interface AppOwnedRuntime {
  bundleDir: string
  root: string
  pythonExecutable: string
  commit: string | null
}

/** Resolve only the new, relocatable layout. A broken shipped bundle must not
 * silently switch the app to an unrelated CLI checkout or bootstrap it online. */
export function resolveAppOwnedRuntime({
  bundleDir,
  manifest,
  isPackaged,
  fileExists,
  platform = process.platform
}: {
  bundleDir: string | null
  manifest: BundledRuntimeManifest | null
  isPackaged: boolean
  fileExists: (filename: string) => boolean
  platform?: NodeJS.Platform
}): AppOwnedRuntime | null {
  if (!isPackaged || (platform !== 'win32' && platform !== 'darwin')) return null

  const paths = platform === 'win32' ? path.win32 : path.posix
  const relativePython = typeof manifest?.pythonExecutable === 'string' ? manifest.pythonExecutable : ''
  const fail = () => {
    throw new Error(
      'The installed Work4You runtime is incomplete. Reinstall Work4You from the downloads page. Your conversations and settings remain in their existing data folder.'
    )
  }

  if (
    !bundleDir ||
    manifest?.layout !== 'app-owned' ||
    !isPresentBundledRuntime(manifest) ||
    !relativePython ||
    paths.isAbsolute(relativePython) ||
    relativePython.split(/[\\/]/).some(part => part === '..') ||
    /^[a-z]:/i.test(relativePython)
  )
    return fail()

  const root = paths.join(bundleDir, 'work4you')
  const pythonExecutable = paths.join(bundleDir, relativePython)

  const files = runtimeManifestFiles(manifest)
  if (!files || files.some(file => !fileExists(paths.join(bundleDir, file)))) return fail()

  return {
    bundleDir,
    root,
    pythonExecutable,
    commit: typeof manifest.commit === 'string' ? manifest.commit : null
  }
}

export function appOwnedRuntimeBackend({
  runtime,
  work4youHome,
  appExecutable,
  args,
  currentEnv = process.env,
  platform = process.platform
}: {
  runtime: AppOwnedRuntime
  work4youHome: string
  appExecutable: string
  args: string[]
  currentEnv?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
}) {
  const paths = platform === 'win32' ? path.win32 : path.posix
  const delimiter = platform === 'win32' ? ';' : ':'
  const inherited = buildDesktopBackendEnv({ work4youHome, currentEnv, platform })
  const pathKey = Object.keys(inherited).find(key => key.toUpperCase() === 'PATH') || 'PATH'

  return {
    kind: 'python',
    runtimeLayout: 'app-owned',
    label: `Bundled Work4You at ${runtime.root}`,
    command: runtime.pythonExecutable,
    args: ['-m', 'work4you_cli.main', ...args],
    root: runtime.root,
    bootstrap: false,
    shell: false,
    env: {
      ...inherited,
      WORK4YOU_HOME: work4youHome,
      WORK4YOU_BUNDLED_RUNTIME: runtime.bundleDir,
      WORK4YOU_DESKTOP_APP_EXECUTABLE: appExecutable,
      // The shipped interpreter owns its packages. Host Python/venv settings
      // must not change which code a desktop release actually runs.
      PYTHONPATH: runtime.root,
      PYTHONHOME: '',
      VIRTUAL_ENV: '',
      PYTHONNOUSERSITE: '1',
      PYTHONDONTWRITEBYTECODE: '1',
      [pathKey]: [
        ...work4youManagedNodePathEntries(runtime.bundleDir, { platform }),
        ...(platform === 'win32'
          ? ['cmd', 'bin', 'usr/bin'].map(dir => paths.join(runtime.bundleDir, 'git', dir))
          : []),
        paths.join(runtime.bundleDir, 'bin'),
        paths.dirname(runtime.pythonExecutable),
        inherited[pathKey]
      ].join(delimiter)
    }
  }
}

export function bundledRuntimeDir(resourcesPath: string | null | undefined): string | null {
  if (!resourcesPath || typeof resourcesPath !== 'string') {
    return null
  }

  return `${resourcesPath.replace(/[/\\]+$/, '')}/${BUNDLED_RUNTIME_DIRNAME}`.replace(/\\/g, '/')
}

export function parseBundledRuntimeManifest(payload: unknown): BundledRuntimeManifest | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const row = payload as BundledRuntimeManifest

  if (row.schemaVersion !== BUNDLED_RUNTIME_SCHEMA_VERSION) {
    return null
  }

  return row
}

export function isPresentBundledRuntime(manifest: BundledRuntimeManifest | null | undefined): boolean {
  return Boolean(manifest) && manifest?.present === true
}

/** Source installs may provide Git separately; packaged Windows ships it. */
export function gitBashShouldBlockBoot(): boolean {
  return false
}
