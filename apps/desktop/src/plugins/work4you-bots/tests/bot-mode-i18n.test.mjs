import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

// Bot Mode ships its own copy (BOT_MODE_LOCALES: the English source plus
// pt-BR) and registers it through the host's plugin i18n when the host has
// one. Without it — older SDKs, these vm harnesses — every translator falls
// back to the English source verbatim, which the rest of the suite relies on.

const pluginSource = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')

function load({ sdk } = {}) {
  const values = new Map()
  const atom = initial => {
    const slot = { get: () => values.get(slot), set: value => values.set(slot, value) }
    values.set(slot, initial)
    return slot
  }
  const context = {
    atom,
    PALETTE_AREA: 'palette',
    COMPOSER_AREAS: { middleware: 'middleware', atCompletions: 'at-completions' },
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild: () => undefined } },
    host: {
      request: async () => ({}),
      notify: () => undefined,
      state: { profile: { get: () => 'default', listen: () => undefined }, gateway: { listen: () => undefined } }
    },
    ...(sdk ? { sdk } : {})
  }
  const source = pluginSource
    .replace(/^import\s+\*\s+as\s+sdk\s+from '@work4you\/plugin-sdk'\r?\n/m, '')
    .replace(/^import\s+\{[\s\S]*?\}\s+from '@work4you\/plugin-sdk'\r?\n/m, '')
    .replace(/^const \{ McpTab, ToolsetConfigPanel \} = sdk\r?\n/m, '')
    .replace(/^import .* from 'react'\r?\n/m, '')
    .replace(/^import .* from 'react\/jsx-runtime'\r?\n/m, '')
    .replace('export default {', 'globalThis.plugin = {')
    .concat(
      '\nglobalThis.__i18n = { BOT_MODE_LOCALES, tr, useBotModeT, groupActivityLabel, scheduleSummary, scheduleLabel };\n'
    )
  vm.runInNewContext(source, context, { filename: 'plugin.js' })
  return context
}

function register(context, i18n) {
  context.plugin.register({
    storage: { get: () => null, set: () => undefined },
    register: () => undefined,
    ...(i18n ? { i18n } : {})
  })
}

/** Minimal stand-in for the host's ctx.i18n: stores the registered bundles
 *  and resolves active locale → the plugin's English → the key itself. */
function fakeI18n(locale) {
  const bundles = {}
  const resolve = (tree, key) =>
    key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), tree)
  const render = (value, args) =>
    typeof value === 'function' ? value(...args) : typeof value === 'string' ? value : null

  return {
    bundles,
    register: registered => {
      Object.assign(bundles, registered)
      return () => undefined
    },
    t: (key, ...args) => render(resolve(bundles[locale], key), args) ?? render(resolve(bundles.en, key), args) ?? key
  }
}

test('without host i18n every translator returns the English source verbatim', () => {
  const context = load()
  register(context)
  const { tr, useBotModeT, groupActivityLabel, scheduleSummary, scheduleLabel } = context.__i18n

  assert.equal(tr('roster.searchBots'), 'Search bots…')
  assert.equal(tr('create.canonicalKickoff'), 'Hey, tell me about yourself!')
  assert.equal(tr('roster.copyTitle', 'Researcher'), 'Researcher (copy)')
  assert.equal(tr('notify.newMessage', 'Scout'), '🤖 New message for Scout')
  // Components get the same English translator on SDKs without usePluginI18n.
  assert.equal(useBotModeT()('groups.send'), 'Send')
  // Helpers keep producing the exact copy they produced before translation.
  assert.equal(groupActivityLabel({ kind: 'queued', member: 'You' }), 'You sent a message')
  assert.equal(
    scheduleSummary({ freq: 'weekdays', time: '9:0', repeatN: '3' }),
    'Runs Monday–Friday at 9:00 AM, 3 time(s) total'
  )
  assert.equal(scheduleLabel('every 120m'), 'Every 2h')
  // An unknown key degrades to the key itself instead of throwing.
  assert.equal(tr('roster.noSuchKey'), 'roster.noSuchKey')
})

test('with host i18n the bundles register and the copy follows the active language (pt-BR)', () => {
  const context = load()
  const i18n = fakeI18n('pt')
  register(context, i18n)
  const { tr, groupActivityLabel, scheduleSummary, scheduleLabel } = context.__i18n

  assert.deepEqual(Object.keys(i18n.bundles).sort(), ['en', 'pt'])
  assert.equal(tr('roster.searchBots'), 'Buscar bots…')
  assert.equal(
    tr('create.canonicalKickoff'),
    'Oi! Apresente-se — quem você é e como pode ajudar.'
  )
  assert.equal(tr('roster.copyTitle', 'Pesquisador'), 'Pesquisador (cópia)')
  assert.equal(tr('groups.botCount', 1), '1 bot')
  assert.equal(tr('groups.botCount', 3), '3 bots')
  assert.equal(groupActivityLabel({ kind: 'queued', member: 'You' }), 'Você enviou uma mensagem')
  assert.equal(scheduleSummary({ freq: 'weekly', time: '21:30', weekday: '6' }), 'Executa todo sábado às 21:30')
  assert.equal(scheduleSummary({ freq: 'weekly', time: '9:0', weekday: '1' }), 'Executa toda segunda-feira às 9:00')
  // Counts agree in number: one hour / one time, several minutes / days / times.
  assert.equal(
    scheduleSummary({ freq: 'interval', intervalN: '1', intervalUnit: 'h', repeatN: '1' }),
    'Executa a cada 1 hora, 1 vez no total'
  )
  assert.equal(
    scheduleSummary({ freq: 'interval', intervalN: '30', intervalUnit: 'm', repeatN: '5' }),
    'Executa a cada 30 minutos, 5 vezes no total'
  )
  assert.equal(scheduleSummary({ freq: 'once', onceN: '2', onceUnit: 'd' }), 'Executa uma vez, daqui a 2 dias')
  assert.equal(scheduleLabel('every 1440m'), 'Diariamente')
})

test('a language without a Bot Mode bundle falls back to the English source', () => {
  const context = load()
  register(context, fakeI18n('ja'))
  const { tr } = context.__i18n

  assert.equal(tr('roster.searchBots'), 'Search bots…')
  assert.equal(tr('groups.thinking', 'Radar'), 'Radar is thinking…')
})

test('components use the host translator hook, bound to the plugin id, when the SDK has it', () => {
  const calls = []
  const sdk = {
    usePluginI18n: id => {
      calls.push(id)
      return key => `[${id}] ${key}`
    }
  }
  const { useBotModeT } = load({ sdk }).__i18n

  assert.equal(useBotModeT()('roster.searchBots'), '[work4you-bots] roster.searchBots')
  assert.deepEqual(calls, ['work4you-bots'])
})

test('en and pt have exactly the same keys, functions take the same parameters, and every message renders', () => {
  const { BOT_MODE_LOCALES } = load().__i18n
  const problems = []

  const walk = (en, pt, path) => {
    for (const key of new Set([...Object.keys(en), ...Object.keys(pt)])) {
      const at = path ? `${path}.${key}` : key

      if (!(key in en) || !(key in pt)) {
        problems.push(`${at}: missing in ${key in en ? 'pt' : 'en'}`)
        continue
      }

      const [a, b] = [en[key], pt[key]]

      if (typeof a !== typeof b) {
        problems.push(`${at}: ${typeof a} in en, ${typeof b} in pt`)
      } else if (typeof a === 'function') {
        if (a.length !== b.length) {
          problems.push(`${at}: ${a.length} parameter(s) in en, ${b.length} in pt`)
        }

        const args = Array.from({ length: a.length }, (_, i) => `arg${i}`)

        for (const [locale, fn] of [
          ['en', a],
          ['pt', b]
        ]) {
          const out = fn(...args)

          if (typeof out !== 'string' || !out.trim()) {
            problems.push(`${at}: ${locale} renders ${JSON.stringify(out)}`)
          }
        }
      } else if (a && typeof a === 'object') {
        walk(a, b, at)
      } else if (typeof a !== 'string' || !a.trim() || !b.trim()) {
        problems.push(`${at}: empty or non-string message`)
      }
    }
  }

  assert.deepEqual(Object.keys(BOT_MODE_LOCALES).sort(), ['en', 'pt'])
  walk(BOT_MODE_LOCALES.en, BOT_MODE_LOCALES.pt, '')
  assert.deepEqual(problems, [])
})
