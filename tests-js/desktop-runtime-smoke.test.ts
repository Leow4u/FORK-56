import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import { seedData, validateRuntime, verifyPreservedFiles } from '../scripts/ci/desktop-runtime-smoke.mjs'

test('runtime evidence requires package code, Python, data home and commit to agree', () => {
  const bundle = path.resolve('sandbox/app/resources/runtime')
  const home = path.resolve('sandbox/data')

  const runtime = { layout: 'app-owned', root: path.join(bundle, 'work4you'),
    pythonExecutable: path.join(bundle, 'python', 'python'), work4youHome: home, commit: 'expected' }

  const expected = { bundle, home, commit: 'expected' }
  validateRuntime(runtime, expected)

  for (const wrong of [
    { layout: 'legacy' }, { root: home }, { pythonExecutable: path.join(home, 'python') },
    { work4youHome: path.join(home, 'different') }, { commit: 'old' }
  ]) {
    assert.throws(() => validateRuntime({ ...runtime, ...wrong }, expected))
  }
})

test('vendor CUA signature is preserved without skipping signing of the app or Python', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../apps/desktop/package.json', import.meta.url), 'utf8'))
  const filters: RegExp[] = manifest.build.mac.signIgnore.map((pattern: string) => new RegExp(pattern))
  const ignored = (file: string) => filters.some(pattern => pattern.test(file))
  const app = '/Applications/Work4You.app'
  const runtime = `${app}/Contents/Resources/runtime`
  const cua = `${runtime}/computer-use/cua-driver-rs-0.34.0-darwin-universal/CuaDriver.app`

  assert(ignored(cua))
  assert(ignored(`${cua}/Contents/MacOS/cua-driver`))
  assert(!ignored(app))
  assert(!ignored(`${runtime}/python/bin/python3`))
  assert(!ignored(`${runtime}/browsers/chromium/Chromium.app`))
  assert(!ignored(`${runtime}/computer-use/CuaDriver.app-unrelated/Contents/MacOS/other`))
})

test('preservation detects missing or overwritten data rather than existence alone', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-smoke-unit-'))

  try {
    seedData(home)
    verifyPreservedFiles(home)
    fs.writeFileSync(path.join(home, 'memories', 'MEMORY.md'), 'overwritten')
    assert.throws(() => verifyPreservedFiles(home), /MEMORY.md changed/)
    seedData(home)
    fs.rmSync(path.join(home, '.env'))
    assert.throws(() => verifyPreservedFiles(home))
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})
