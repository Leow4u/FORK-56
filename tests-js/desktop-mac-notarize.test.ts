/**
 * Invariant: macOS notarization stays on the fork's afterSign hook.
 *
 * electron-builder 26 auto-runs `@electron/notarize` whenever APPLE_API_KEY
 * is set, unless `mac.notarize` is explicitly false. That built-in path
 * treats APPLE_API_KEY as a .p8 *file path* and fails with notarytool
 * "Usage: notarytool <subcommand>" when the secret is inline PEM
 * (Release Desktop run 35248432787).
 *
 * The fork already writes that key in `scripts/notarize.mjs` (afterSign)
 * and `scripts/notarize-artifact.mjs` (DMG). These two fields must stay
 * paired so CI does not invent a third notary path.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { test } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '..')
const DESKTOP_PKG = path.join(REPO_ROOT, 'apps', 'desktop', 'package.json')

function loadDesktopBuild(): {
  afterSign?: string
  mac?: { notarize?: boolean }
} {
  const pkg = JSON.parse(fs.readFileSync(DESKTOP_PKG, 'utf8')) as {
    build?: { afterSign?: string; mac?: { notarize?: boolean } }
  }
  assert.ok(pkg.build && typeof pkg.build === 'object', 'apps/desktop package.json must have a build field')
  return pkg.build
}

test('mac notarize stays on afterSign, not electron-builder @electron/notarize', () => {
  const build = loadDesktopBuild()
  assert.equal(
    build.afterSign,
    'scripts/notarize.mjs',
    'afterSign must stay the fork notarize hook that accepts an inline APPLE_API_KEY'
  )
  assert.equal(
    build.mac?.notarize,
    false,
    'mac.notarize must be false so electron-builder 26 does not pass inline APPLE_API_KEY to @electron/notarize'
  )
})
