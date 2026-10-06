import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

// New Agent / Edit Profile provider + model picker: the Portal row label, the
// dropdowns-vs-free-text default, and Free-plan locked models.

const source = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')

function loadPickerHelpers() {
  const start = source.indexOf('const MODEL_OPTIONS_PARAMS')
  const end = source.indexOf('function useModelOptions(')
  assert.notEqual(start, -1, 'MODEL_OPTIONS_PARAMS is missing')
  assert.ok(end > start, 'useModelOptions must follow the picker helpers')
  const context = {}
  vm.runInNewContext(
    `${source.slice(start, end)}\nglobalThis.__picker = { MODEL_PICKER_INHERIT, providerOptionLabel, lockedModelIds, modelForProvider, modelPickerUsesFreeText };\n`,
    context,
    { filename: 'model-picker.js' }
  )
  return context.__picker
}

test('the Portal row reads "Work4You"; other providers keep name and slug', () => {
  const { providerOptionLabel } = loadPickerHelpers()
  assert.equal(providerOptionLabel({ slug: 'work4you', name: 'Work4You Portal' }), 'Work4You')
  assert.equal(providerOptionLabel({ slug: 'openrouter', name: 'OpenRouter' }), 'OpenRouter (openrouter)')
  assert.equal(providerOptionLabel({ slug: 'custom:local' }), 'custom:local')
})

test('the free-text default follows the loaded inventory, not the first render', () => {
  const { MODEL_PICKER_INHERIT, modelPickerUsesFreeText } = loadPickerHelpers()
  const loaded = [{ slug: 'work4you' }, { slug: 'openrouter' }]

  // The same picker before and after model.options lands: the pinned provider
  // only looks unknown while the list is empty, and the default must follow
  // the list once it arrives instead of staying in free text.
  assert.equal(modelPickerUsesFreeText(null, 'work4you', []), true)
  assert.equal(modelPickerUsesFreeText(null, 'work4you', loaded), false)

  // A provider the inventory does not list is typed by hand.
  assert.equal(modelPickerUsesFreeText(null, 'acme', loaded), true)

  // Inherit and an empty provider are dropdown states.
  assert.equal(modelPickerUsesFreeText(null, '', loaded), false)
  assert.equal(modelPickerUsesFreeText(null, MODEL_PICKER_INHERIT, loaded), false)

  // An explicit choice (Enter manually / Back to dropdowns) wins either way.
  assert.equal(modelPickerUsesFreeText(true, 'work4you', loaded), true)
  assert.equal(modelPickerUsesFreeText(false, 'acme', loaded), false)
})

test('the picker lands on a model the account can use', () => {
  const { lockedModelIds, modelForProvider } = loadPickerHelpers()
  const portal = {
    slug: 'work4you',
    models: ['acme/pro-a', 'acme/house', 'acme/pro-b'],
    unavailable_models: ['acme/pro-a', 'acme/pro-b']
  }

  // A listed, usable current model is kept.
  assert.equal(modelForProvider(portal, 'acme/house'), 'acme/house')
  // A locked or unlisted current model falls to the first usable one,
  // skipping locked rows even when they come first.
  assert.equal(modelForProvider(portal, 'acme/pro-b'), 'acme/house')
  assert.equal(modelForProvider(portal, 'other/model'), 'acme/house')
  assert.equal(modelForProvider(portal, ''), 'acme/house')

  // Object-shaped rows and providers without a plan gate.
  assert.equal(modelForProvider({ models: [{ id: 'x/a' }, { name: 'x/b' }] }, ''), 'x/a')
  assert.equal(modelForProvider({ models: ['x/a'], unavailable_models: ['x/a'] }, ''), '')
  assert.equal(modelForProvider(null, 'x/a'), '')
  assert.equal(lockedModelIds(null).size, 0)
  assert.deepEqual([...lockedModelIds(portal)].sort(), ['acme/pro-a', 'acme/pro-b'])
})
