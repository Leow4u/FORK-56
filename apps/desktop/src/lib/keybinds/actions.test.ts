import { describe, expect, it } from 'vitest'

import { en } from '@/i18n/en'

import { defaultBindings, KEYBIND_ACTIONS, keybindAction } from './actions'
import { canonicalizeCombo } from './combo'

describe('session.archive keybind action', () => {
  it('is registered under the session category', () => {
    const action = keybindAction('session.archive')

    expect(action).toBeDefined()
    expect(action?.category).toBe('session')
  })

  it('ships unbound so it does not claim a chord for every user', () => {
    const action = keybindAction('session.archive')

    expect(action?.defaults).toEqual([])
    // A missing entry would silently drop from the panel; an accidental
    // default binding would change behaviour for everyone. Guard both.
    expect(defaultBindings()['session.archive']).toEqual([])
  })

  it('has an English label so it renders in the shortcuts panel', () => {
    expect(en.keybinds.actions['session.archive']).toBe('Archive current session')
  })

  it('appears exactly once in KEYBIND_ACTIONS', () => {
    const matches = KEYBIND_ACTIONS.filter(action => action.id === 'session.archive')

    expect(matches).toHaveLength(1)
  })
})

describe('composer.voice keybind action', () => {
  // Off macOS the voice toggle shipped unbound (Ctrl+B is the sidebar there),
  // so Windows users had no voice shortcut at all.
  it('ships a shortcut on this platform that no other action claims by default', () => {
    const defaults = defaultBindings()
    const voice = (defaults['composer.voice'] ?? []).map(canonicalizeCombo)

    expect(voice.length).toBeGreaterThan(0)

    for (const [id, combos] of Object.entries(defaults)) {
      if (id === 'composer.voice') {
        continue
      }

      for (const combo of combos) {
        expect(voice, id).not.toContain(canonicalizeCombo(combo))
      }
    }
  })
})
