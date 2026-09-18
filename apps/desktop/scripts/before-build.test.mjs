import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'

import { ensureRuntimeResourceDir } from './before-build.mjs'

test('ensureRuntimeResourceDir writes a stub manifest and copies the deploy script', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-before-build-'))
  try {
    const desktopRoot = path.join(tempRoot, 'desktop')
    const repoRoot = path.join(tempRoot, 'repo')
    fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true })
    fs.writeFileSync(path.join(repoRoot, 'scripts', 'deploy-desktop-runtime.ps1'), 'param()', 'utf8')

    const first = ensureRuntimeResourceDir(desktopRoot, repoRoot)
    assert.equal(first.present, false)
    const manifestPath = path.join(desktopRoot, 'build', 'runtime', 'manifest.json')
    assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), { schemaVersion: 1, present: false })
    assert.equal(
      fs.readFileSync(path.join(desktopRoot, 'build', 'runtime', 'deploy-desktop-runtime.ps1'), 'utf8'),
      'param()'
    )
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('ensureRuntimeResourceDir does not clobber a present CI runtime manifest', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-before-build-'))
  try {
    const desktopRoot = path.join(tempRoot, 'desktop')
    const runtimeDir = path.join(desktopRoot, 'build', 'runtime')
    fs.mkdirSync(runtimeDir, { recursive: true })
    fs.writeFileSync(
      path.join(runtimeDir, 'manifest.json'),
      JSON.stringify({ schemaVersion: 1, present: true, commit: 'abc' }),
      'utf8'
    )
    const repoRoot = path.join(tempRoot, 'repo')
    fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true })
    fs.writeFileSync(path.join(repoRoot, 'scripts', 'deploy-desktop-runtime.ps1'), 'param()', 'utf8')

    const result = ensureRuntimeResourceDir(desktopRoot, repoRoot)
    assert.equal(result.present, true)
    assert.equal(JSON.parse(fs.readFileSync(path.join(runtimeDir, 'manifest.json'), 'utf8')).present, true)
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})
