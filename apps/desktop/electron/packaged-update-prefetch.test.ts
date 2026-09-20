/**
 * Tests for electron/packaged-update-prefetch.ts — Stage A dest/ready/percent
 * policy without booting Electron.
 *
 * Run with: npx vitest run --project electron electron/packaged-update-prefetch.test.ts
 */

import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import {
  attachPrefetchFields,
  isChromeExtractReusable,
  isPackagedPrefetchReady,
  isPrefetchAssetReusable,
  PACKAGED_CHROME_EXTRACTED_NAME,
  PACKAGED_UPDATE_SCRATCH_NAME,
  packagedChromeExtractedDir,
  packagedPrefetchJobKey,
  packagedPrefetchPercent,
  packagedUpdateScratchDir,
  shouldStartPackagedPrefetch
} from './packaged-update-prefetch'

test('packaged scratch paths stay under the shared update temp dir', () => {
  const scratch = packagedUpdateScratchDir(os.tmpdir())
  assert.equal(path.basename(scratch), PACKAGED_UPDATE_SCRATCH_NAME)
  assert.equal(path.basename(packagedChromeExtractedDir(scratch)), PACKAGED_CHROME_EXTRACTED_NAME)
})

test('prefetch starts only for a supported packaged update', () => {
  assert.equal(shouldStartPackagedPrefetch({ supported: true, updateAvailable: true, channel: 'chrome' }), true)
  assert.equal(shouldStartPackagedPrefetch({ supported: true, updateAvailable: true, channel: 'installer' }), true)
  assert.equal(shouldStartPackagedPrefetch({ supported: true, updateAvailable: true, channel: 'git' }), false)
  assert.equal(shouldStartPackagedPrefetch({ supported: true, updateAvailable: false, channel: 'chrome' }), false)
  assert.equal(
    shouldStartPackagedPrefetch({ supported: true, updateAvailable: true, channel: 'chrome', error: 'fetch-failed' }),
    false
  )
  assert.equal(shouldStartPackagedPrefetch({ supported: false, updateAvailable: true, channel: 'chrome' }), false)
})

test('prefetch job key pins both channel and release tag', () => {
  assert.equal(packagedPrefetchJobKey({ kind: 'chrome', releaseTag: 'desktop-v0.0.98' }), 'chrome:desktop-v0.0.98')
  assert.notEqual(
    packagedPrefetchJobKey({ kind: 'chrome', releaseTag: 'desktop-v0.0.98' }),
    packagedPrefetchJobKey({ kind: 'installer', releaseTag: 'desktop-v0.0.98' })
  )
})

test('reusable asset requires a real file; size must match when known', () => {
  assert.equal(isPrefetchAssetReusable({ exists: false, size: 12, expectedSize: 12 }), false)
  assert.equal(isPrefetchAssetReusable({ exists: true, size: 0, expectedSize: 12 }), false)
  assert.equal(isPrefetchAssetReusable({ exists: true, size: 12, expectedSize: 12 }), true)
  assert.equal(isPrefetchAssetReusable({ exists: true, size: 11, expectedSize: 12 }), false)
  assert.equal(isPrefetchAssetReusable({ exists: true, size: 80, expectedSize: null }), true)
})

test('chrome prefetch is ready only after the unpacked exe exists', () => {
  assert.equal(isChromeExtractReusable({ exeExists: false }), false)
  assert.equal(isChromeExtractReusable({ exeExists: true }), true)
  assert.equal(
    isPackagedPrefetchReady({
      kind: 'chrome',
      assetExists: true,
      assetSize: 10,
      expectedSize: 10,
      chromeExeExists: false
    }),
    false
  )
  assert.equal(
    isPackagedPrefetchReady({
      kind: 'chrome',
      assetExists: true,
      assetSize: 10,
      expectedSize: 10,
      chromeExeExists: true
    }),
    true
  )
  assert.equal(
    isPackagedPrefetchReady({
      kind: 'installer',
      assetExists: true,
      assetSize: 10,
      expectedSize: 10
    }),
    true
  )
})

test('prefetch percent leaves headroom until Stage A is actually ready', () => {
  assert.equal(packagedPrefetchPercent({ kind: 'installer', phase: 'download', received: 50, total: 100 }), 50)
  assert.equal(packagedPrefetchPercent({ kind: 'installer', phase: 'download', received: 100, total: 100 }), 99)
  assert.equal(packagedPrefetchPercent({ kind: 'chrome', phase: 'download', received: 100, total: 100 }), 70)
  assert.equal(packagedPrefetchPercent({ kind: 'chrome', phase: 'unpack', unpackDone: 0, unpackTotal: 10 }), 70)
  assert.equal(packagedPrefetchPercent({ kind: 'chrome', phase: 'unpack', unpackDone: 10, unpackTotal: 10 }), 99)
  assert.equal(packagedPrefetchPercent({ kind: 'chrome', phase: 'download', received: 10, total: null }), 1)
})

test('attachPrefetchFields only merges a job for the same tag and channel', () => {
  const status = { releaseTag: 'desktop-v0.0.98', channel: 'chrome' as const, updateAvailable: true }
  assert.deepEqual(
    attachPrefetchFields(status, {
      releaseTag: 'desktop-v0.0.98',
      kind: 'chrome',
      percent: 42,
      ready: false,
      error: null
    }),
    { ...status, prefetchPercent: 42, prefetchReady: false, prefetchError: undefined }
  )
  assert.deepEqual(
    attachPrefetchFields(status, {
      releaseTag: 'desktop-v0.0.98',
      kind: 'chrome',
      percent: 99,
      ready: true,
      error: null
    }).prefetchPercent,
    100
  )
  assert.equal(
    attachPrefetchFields(status, {
      releaseTag: 'desktop-v0.0.97',
      kind: 'chrome',
      percent: 42,
      ready: false,
      error: null
    }).prefetchPercent,
    undefined
  )
  assert.equal(
    attachPrefetchFields(status, {
      releaseTag: 'desktop-v0.0.98',
      kind: 'installer',
      percent: 42,
      ready: false,
      error: null
    }).prefetchPercent,
    undefined
  )
})
