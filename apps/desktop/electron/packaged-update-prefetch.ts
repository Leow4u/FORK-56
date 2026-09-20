import path from 'node:path'

import type { PackagedApplyKind } from './packaged-installer-update'

/**
 * Background Stage A for packaged updates.
 *
 * Check finds an update → download (and chrome unpack) while the app stays
 * usable. Stage B is the user's click: chrome restarts to overlay files;
 * installer still launches Setup.exe. Never quit or spawn NSIS from here.
 */

export const PACKAGED_UPDATE_SCRATCH_NAME = 'work4you-desktop-update'
export const PACKAGED_CHROME_EXTRACTED_NAME = 'chrome-extracted'

export interface PackagedPrefetchFields {
  prefetchPercent?: number | null
  prefetchReady?: boolean
  prefetchError?: string | null
}

export interface PackagedPrefetchJobSnapshot {
  releaseTag: string
  kind: string
  percent: number | null
  ready: boolean
  error: string | null
}

export function packagedUpdateScratchDir(tmpDir: string): string {
  return path.join(tmpDir, PACKAGED_UPDATE_SCRATCH_NAME)
}

export function packagedChromeExtractedDir(scratchDir: string): string {
  return path.join(scratchDir, PACKAGED_CHROME_EXTRACTED_NAME)
}

export function packagedPrefetchJobKey(plan: { kind: string; releaseTag: string }): string {
  return `${plan.kind}:${plan.releaseTag}`
}

export function shouldStartPackagedPrefetch(status: {
  supported?: boolean
  updateAvailable?: boolean
  channel?: string
  error?: string
}): boolean {
  return Boolean(
    status.supported !== false &&
    status.updateAvailable &&
    !status.error &&
    (status.channel === 'chrome' || status.channel === 'installer')
  )
}

export function isPrefetchAssetReusable(opts: {
  exists: boolean
  size: number | null
  expectedSize: number | null
}): boolean {
  if (!opts.exists) {
    return false
  }

  if (opts.size == null || !Number.isFinite(opts.size) || opts.size <= 0) {
    return false
  }

  if (opts.expectedSize == null || !Number.isFinite(opts.expectedSize) || opts.expectedSize <= 0) {
    return true
  }

  return opts.size === opts.expectedSize
}

export function isChromeExtractReusable(opts: { exeExists: boolean }): boolean {
  return Boolean(opts.exeExists)
}

export function isPackagedPrefetchReady(opts: {
  kind: PackagedApplyKind
  assetExists: boolean
  assetSize: number | null
  expectedSize: number | null
  chromeExeExists?: boolean
}): boolean {
  if (
    !isPrefetchAssetReusable({
      exists: opts.assetExists,
      size: opts.assetSize,
      expectedSize: opts.expectedSize
    })
  ) {
    return false
  }

  if (opts.kind === 'chrome') {
    return isChromeExtractReusable({ exeExists: Boolean(opts.chromeExeExists) })
  }

  return true
}

/**
 * Chip / overlay percent for Stage A only.
 *
 * Chrome: download fills 1–70, unpack 70–99, ready is 100.
 * Installer: download fills 1–99, ready is 100. Setup.exe is never auto-run.
 */
export function packagedPrefetchPercent(opts: {
  kind: PackagedApplyKind
  phase: 'download' | 'unpack'
  received?: number
  total?: number | null
  unpackDone?: number
  unpackTotal?: number
}): number | null {
  if (opts.phase === 'download') {
    const received = opts.received ?? 0
    const total = opts.total
    const cap = opts.kind === 'chrome' ? 70 : 99

    if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
      return received > 0 ? 1 : 0
    }

    if (!Number.isFinite(received) || received < 0) {
      return 0
    }

    return Math.max(1, Math.min(cap, Math.round((received / total) * cap)))
  }

  const done = opts.unpackDone ?? 0
  const total = opts.unpackTotal ?? 0

  if (total <= 0) {
    return 70
  }

  return Math.max(70, Math.min(99, 70 + Math.round((done / total) * 29)))
}

export function attachPrefetchFields<T extends { releaseTag?: string; channel?: string }>(
  status: T,
  job: PackagedPrefetchJobSnapshot | null
): T & PackagedPrefetchFields {
  if (!job || job.releaseTag !== status.releaseTag || job.kind !== status.channel) {
    return status
  }

  return {
    ...status,
    prefetchPercent: job.ready ? 100 : job.percent,
    prefetchReady: job.ready,
    prefetchError: job.error || undefined
  }
}
