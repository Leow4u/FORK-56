import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import { samePath, seedData, validateBackendOwnership, validateRuntime, verifyPreservedFiles } from '../scripts/ci/desktop-runtime-smoke.mjs'

const temporaryRoots: string[] = []
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {fs.rmSync(root, { recursive: true, force: true })}
})

function installedRuntime() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime smoke '))
  temporaryRoots.push(sandbox)
  const bundle = path.join(sandbox, 'Installed App', 'resources', 'runtime')
  const home = path.join(sandbox, 'data')
  const pythonExecutable = path.join(bundle, 'python', 'bin', 'python')
  fs.mkdirSync(path.join(bundle, 'work4you'), { recursive: true })
  fs.mkdirSync(path.dirname(pythonExecutable), { recursive: true })
  fs.mkdirSync(home)
  fs.writeFileSync(pythonExecutable, 'test interpreter identity')

  const runtime = { layout: 'app-owned', root: path.join(bundle, 'work4you'),
    pythonExecutable, work4youHome: home, commit: 'expected' }

  return { sandbox, bundle, home, runtime, expected: { bundle, home, pythonExecutable, commit: 'expected' } }
}

function directoryAlias(target: string, alias: string) {
  fs.symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
}

test('runtime evidence requires package code, Python, data home and commit to agree', () => {
  const { bundle, home, runtime, expected } = installedRuntime()
  const otherPython = path.join(bundle, 'python', 'other-python')
  fs.writeFileSync(otherPython, 'different interpreter')
  validateRuntime(runtime, expected)

  for (const wrong of [
    { layout: 'legacy' }, { root: home }, { pythonExecutable: path.join(home, 'python') },
    { pythonExecutable: otherPython }, { pythonExecutable: bundle },
    { work4youHome: path.join(home, 'different') }, { commit: 'old' }
  ]) {
    assert.throws(() => validateRuntime({ ...runtime, ...wrong }, expected))
  }
})

test('existing aliases of the install and data directories identify the same runtime', () => {
  const { sandbox, runtime, expected } = installedRuntime()
  const alias = `${sandbox}-alias`
  directoryAlias(sandbox, alias)
  temporaryRoots.push(alias)
  const throughAlias = (file: string) => path.join(alias, path.relative(sandbox, file))

  assert(samePath(throughAlias(runtime.root), runtime.root))
  validateRuntime({ ...runtime, root: throughAlias(runtime.root),
    pythonExecutable: throughAlias(runtime.pythonExecutable), work4youHome: throughAlias(runtime.work4youHome) }, expected)
  validateRuntime(runtime, { ...expected, bundle: throughAlias(expected.bundle),
    home: throughAlias(expected.home), pythonExecutable: throughAlias(expected.pythonExecutable) })
  assert(!samePath(path.join(alias, 'missing'), path.join(sandbox, 'missing')))
  assert(!samePath(undefined, runtime.root))
})

test('canonical containment rejects Python and code symlinks escaping the installed runtime', () => {
  const { bundle, home, runtime, expected } = installedRuntime()
  const outsidePython = path.join(home, 'python')
  fs.writeFileSync(outsidePython, 'external interpreter')
  const outsideLink = path.join(bundle, 'external')
  directoryAlias(home, outsideLink)
  const linkedPython = path.join(outsideLink, 'python')

  assert.throws(() => validateRuntime({ ...runtime, pythonExecutable: linkedPython },
    { ...expected, pythonExecutable: linkedPython }), /Python escaped app runtime/)
  fs.rmdirSync(runtime.root)
  directoryAlias(home, runtime.root)
  assert.throws(() => validateRuntime(runtime, expected), /runtime code escaped app runtime/)
})

test('wrong existing paths retain actual and expected evidence in failures', () => {
  const { home, runtime, expected } = installedRuntime()
  assert.throws(() => validateRuntime({ ...runtime, root: home }, expected), error => {
    assert(error instanceof Error)
    assert(error.message.includes(JSON.stringify(home)))
    assert(error.message.includes(JSON.stringify(runtime.root)))
    assert(error.message.includes('actualCanonical'))

    return true
  })
})

test('ownership requires the Electron main PID rather than a launcher shell PID', () => {
  const { runtime } = installedRuntime()
  const shellPid = 100
  const electronPid = 200
  const command = `${runtime.pythonExecutable} -m work4you_cli.main serve --host 127.0.0.1 --port 0`
  const shellBackend = { pid: 301, parentPid: shellPid, command }
  const backend = { pid: 302, parentPid: electronPid, command }
  const expected = { electronPid, pythonExecutable: runtime.pythonExecutable }
  assert.equal(validateBackendOwnership({ backends: [shellBackend, backend] }, expected), backend)
  assert.throws(() => validateBackendOwnership({ backends: [shellBackend] }, expected), /Electron main process/)
  assert.throws(() => validateBackendOwnership({ backends: [backend] }, { ...expected, electronPid: 0 }))
})

test('ownership accepts canonical Python aliases but rejects another interpreter or CLI', () => {
  const { sandbox, runtime } = installedRuntime()
  const alias = path.join(sandbox, 'python-alias')
  directoryAlias(path.dirname(runtime.pythonExecutable), alias)
  const command = `${path.join(alias, 'python')} -m work4you_cli.main serve`
  const backend = { pid: 301, parentPid: 200, command }
  const expected = { electronPid: 200, pythonExecutable: runtime.pythonExecutable }
  assert.equal(validateBackendOwnership({ backends: [backend] }, expected), backend)
  const otherPython = path.join(sandbox, 'other-python')
  fs.writeFileSync(otherPython, 'external interpreter')

  for (const wrong of [
    { command: `${otherPython} -m work4you_cli.main serve` },
    { command: `${runtime.pythonExecutable} -m unrelated.main serve` },
    { command: `${runtime.pythonExecutable} -m work4you_cli.mainly serve` },
    { pid: 0 }
  ]) {assert.throws(() => validateBackendOwnership({ backends: [{ ...backend, ...wrong }] }, expected))}
})

test('ownership failure diagnostics contain PIDs without recording command arguments or credentials', () => {
  const { runtime } = installedRuntime()
  const privateArgument = 'SECRET-MUST-NOT-APPEAR'

  const ownership = { token: privateArgument, backends: [{ pid: 301, parentPid: 100,
    nonce: privateArgument, command: `${runtime.pythonExecutable} -m work4you_cli.main serve --token ${privateArgument}` }] }

  assert.throws(() => validateBackendOwnership(ownership, { electronPid: 200,
    pythonExecutable: runtime.pythonExecutable }), error => {
    assert(error instanceof Error)
    assert(error.message.includes('"electronPid":200'))
    assert(error.message.includes('"parentPid":100'))
    assert(!error.message.includes(privateArgument))
    assert(!error.message.includes('--token'))

    return true
  })
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
