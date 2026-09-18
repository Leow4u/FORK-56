/**
 * Packaged Windows Setup can ship a CI-built Python runtime in extraResources
 * (`resources/runtime`). First launch must use that tree — not install.ps1's
 * 13-stage GitHub + uv bootstrap — when the manifest says the payload is
 * present.
 *
 * Pure helpers (no Electron imports) so node:test can cover the gate without
 * booting the app.
 */

export const BUNDLED_RUNTIME_DIRNAME = 'runtime'
export const BUNDLED_RUNTIME_MANIFEST = 'manifest.json'
export const BUNDLED_RUNTIME_DEPLOY_SCRIPT = 'deploy-desktop-runtime.ps1'
export const BUNDLED_RUNTIME_SCHEMA_VERSION = 1

export interface BundledRuntimeManifest {
  schemaVersion?: unknown
  present?: unknown
  commit?: unknown
  branch?: unknown
  arch?: unknown
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

/**
 * Packaged Windows builds with a present runtime must deploy that payload
 * instead of opening the 13-stage first-launch overlay.
 */
export function shouldDeployBundledRuntime(opts: {
  isPackaged: boolean
  isWindows: boolean
  manifest: BundledRuntimeManifest | null | undefined
}): boolean {
  return Boolean(opts.isPackaged) && Boolean(opts.isWindows) && isPresentBundledRuntime(opts.manifest)
}

/** Git Bash must not block first open. Terminal degrades until bash exists. */
export function gitBashShouldBlockBoot(): boolean {
  return false
}

export function bundledDeployArgs(opts: {
  bundleDir: string
  work4youHome: string
  installStampPath?: string | null
}): string[] {
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', opts.bundleDir.replace(/\//g, '\\') + '\\' + BUNDLED_RUNTIME_DEPLOY_SCRIPT.replace(/\//g, '\\'), '-BundleDir', opts.bundleDir, '-Work4YouHome', opts.work4youHome]

  if (opts.installStampPath) {
    args.push('-InstallStampPath', opts.installStampPath)
  }

  return args
}
