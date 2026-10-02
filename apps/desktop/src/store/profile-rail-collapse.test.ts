import { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The rail folds to a one-line strip. An untouched preference lets the profile
// count decide (folded alone, open once a second profile exists); the first
// explicit choice pins it and is remembered per machine.
vi.mock('@/store/gateway', () => ({
  $gateway: atom(null),
  ensureGatewayForAgent: vi.fn(async () => true),
  ensureGatewayForProfile: vi.fn(async () => undefined),
  openGatewayForProfile: vi.fn(async () => undefined)
}))
vi.mock('@/work4you', () => ({
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  setApiRequestProfile: vi.fn()
}))

const STORAGE_KEY = 'work4you.desktop.profileRail'

const { $profileRailCollapsed, $profileRailPreference, $profiles, setProfileRailCollapsed } =
  await import('@/store/profile')

function profile(name: string, isDefault = false) {
  return {
    has_env: false,
    is_default: isDefault,
    model: null,
    name,
    path: `/p/${name}`,
    provider: null,
    skill_count: 0
  }
}

const ONLY_DEFAULT = [profile('default', true)]
const TWO = [profile('default', true), profile('research')]

beforeEach(() => {
  window.localStorage.removeItem(STORAGE_KEY)
  $profileRailPreference.set('')
  $profiles.set(ONLY_DEFAULT)
})

afterEach(() => {
  window.localStorage.removeItem(STORAGE_KEY)
})

describe('$profileRailCollapsed', () => {
  it('folds for a lone default profile and opens once a second profile exists', () => {
    expect($profileRailCollapsed.get()).toBe(true)

    $profiles.set(TWO)

    expect($profileRailCollapsed.get()).toBe(false)
  })

  it('treats the not-yet-loaded list like a lone profile', () => {
    $profiles.set([])

    expect($profileRailCollapsed.get()).toBe(true)
  })

  it('pins an explicit fold regardless of the profile count, and remembers it', () => {
    $profiles.set(TWO)
    setProfileRailCollapsed(true)

    expect($profileRailCollapsed.get()).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('collapsed')

    $profiles.set([...TWO, profile('writer')])
    expect($profileRailCollapsed.get()).toBe(true)
  })

  it('pins an explicit unfold even with only the default profile', () => {
    setProfileRailCollapsed(false)

    expect($profileRailCollapsed.get()).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('expanded')
  })
})
