import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

import {
  bundledDeployArgs,
  bundledPosixDeployArgs,
  bundledRuntimeDir,
  gitBashShouldBlockBoot,
  isPresentBundledRuntime,
  parseBundledRuntimeManifest,
  shouldDeployBundledRuntime
} from './bundled-runtime'

describe('bundled runtime gate', () => {
  test('parseBundledRuntimeManifest requires schema 1', () => {
    assert.equal(parseBundledRuntimeManifest(null), null)
    assert.equal(parseBundledRuntimeManifest({ present: true }), null)
    assert.deepEqual(parseBundledRuntimeManifest({ schemaVersion: 1, present: false }), {
      schemaVersion: 1,
      present: false
    })
  })

  test('isPresentBundledRuntime is only true for present:true', () => {
    assert.equal(isPresentBundledRuntime(parseBundledRuntimeManifest({ schemaVersion: 1, present: false })), false)
    assert.equal(isPresentBundledRuntime(parseBundledRuntimeManifest({ schemaVersion: 1, present: true })), true)
  })

  test('shouldDeployBundledRuntime is packaged Windows or macOS + present payload', () => {
    const present = parseBundledRuntimeManifest({ schemaVersion: 1, present: true })
    const stub = parseBundledRuntimeManifest({ schemaVersion: 1, present: false })

    assert.equal(shouldDeployBundledRuntime({ isPackaged: true, isWindows: true, manifest: present }), true)
    assert.equal(shouldDeployBundledRuntime({ isPackaged: true, isWindows: false, isMac: true, manifest: present }), true)
    assert.equal(shouldDeployBundledRuntime({ isPackaged: true, isWindows: true, manifest: stub }), false)
    assert.equal(shouldDeployBundledRuntime({ isPackaged: false, isWindows: true, manifest: present }), false)
    assert.equal(shouldDeployBundledRuntime({ isPackaged: true, isWindows: false, manifest: present }), false)
    assert.equal(shouldDeployBundledRuntime({ isPackaged: true, isWindows: false, isMac: true, manifest: stub }), false)
  })

  test('gitBashShouldBlockBoot is always false', () => {
    assert.equal(gitBashShouldBlockBoot(), false)
  })

  test('bundledRuntimeDir joins resources/runtime', () => {
    assert.equal(bundledRuntimeDir('C:/Work4You/resources'), 'C:/Work4You/resources/runtime')
    assert.equal(bundledRuntimeDir(null), null)
  })

  test('bundledDeployArgs passes bundle and home, plus optional stamp', () => {
    const args = bundledDeployArgs({
      bundleDir: 'C:\\Work4You\\resources\\runtime',
      work4youHome: 'C:\\Users\\Ada\\AppData\\Local\\work4you',
      installStampPath: 'C:\\Work4You\\resources\\install-stamp.json'
    })

    assert.ok(args.includes('-File'))
    assert.ok(args.includes('-BundleDir'))
    assert.ok(args.includes('C:\\Work4You\\resources\\runtime'))
    assert.ok(args.includes('-Work4YouHome'))
    assert.ok(args.includes('-InstallStampPath'))
    assert.ok(args.includes('C:\\Work4You\\resources\\install-stamp.json'))
  })

  test('bundledPosixDeployArgs runs the sh deploy script', () => {
    const args = bundledPosixDeployArgs({
      bundleDir: '/Applications/Work4You.app/Contents/Resources/runtime',
      work4youHome: '/Users/ada/.work4you',
      installStampPath: '/Applications/Work4You.app/Contents/Resources/install-stamp.json'
    })

    assert.ok(args[0].endsWith('/deploy-desktop-runtime.sh'))
    assert.ok(args.includes('--bundle-dir'))
    assert.ok(args.includes('/Users/ada/.work4you'))
    assert.ok(args.includes('--install-stamp'))
  })
})
