import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

// New Agent defaults to Fresh (bundled skills, no clone, no launch .env
// overlay). Clone from default remains an explicit picker choice. The
// Capabilities staging catalog must not fall back to the default profile.

const source = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')

function loadIsolation() {
  const start = source.indexOf('const FRESH_CLONE_FROM')
  const end = source.indexOf('function CreateAgentDialog(')
  assert.notEqual(start, -1, 'FRESH_CLONE_FROM helper block is missing')
  assert.ok(end > start, 'CreateAgentDialog must follow the isolation helpers')
  const context = {}
  vm.runInNewContext(
    `${source.slice(start, end)}\nglobalThis.__iso = { FRESH_CLONE_FROM, isFreshProfileCreate, capabilityCatalogSource, profilesCreateIsolationParams };\n`,
    context,
    { filename: 'create-isolation.js' }
  )
  return context.__iso
}

function snapshot(value) {
  return JSON.parse(JSON.stringify(value))
}

test('Fresh is the default clone-from; reset restores the same sentinel', () => {
  const iso = loadIsolation()
  assert.equal(iso.FRESH_CLONE_FROM, '__none__')
  assert.match(source, /useState\(FRESH_CLONE_FROM\)/)
  assert.match(source, /setCloneFrom\(FRESH_CLONE_FROM\)/)
})

test('Fresh create does not clone or overlay launch credentials', () => {
  const iso = loadIsolation()
  assert.equal(iso.isFreshProfileCreate('__none__'), true)
  assert.deepEqual(snapshot(iso.profilesCreateIsolationParams('__none__', false)), {
    clone_from: null,
    mirror_credentials: false
  })
  assert.equal(iso.capabilityCatalogSource('__none__'), 'fresh')
  assert.equal(iso.capabilityCatalogSource('__none__', true), 'fresh')
})

test('explicit clone copies the named source without overlaying launch .env', () => {
  const iso = loadIsolation()
  assert.equal(iso.isFreshProfileCreate('default'), false)
  assert.deepEqual(snapshot(iso.profilesCreateIsolationParams('default', false)), {
    clone_from: 'default',
    mirror_credentials: false
  })
  assert.equal(iso.capabilityCatalogSource('default'), 'default')
})

test('remote clone uses the target machine default, still without launch .env overlay', () => {
  const iso = loadIsolation()
  assert.deepEqual(snapshot(iso.profilesCreateIsolationParams('leo', true)), {
    clone_from: 'default',
    mirror_credentials: false
  })
  assert.equal(iso.capabilityCatalogSource('leo', true), 'default')
})
