// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProfileInfo } from '@/types/work4you'

// Keep store/profile's side-effecting imports inert — same seam as
// store/profile.test.ts / profile-tag.test.tsx.
vi.mock('@/store/gateway', () => ({
  $gateway: atom<unknown>(null),
  ensureGatewayForAgent: vi.fn(async () => undefined),
  ensureGatewayForProfile: vi.fn(async () => undefined),
  openGatewayForProfile: vi.fn(async () => undefined)
}))
vi.mock('@/work4you', () => ({
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  setApiRequestProfile: vi.fn()
}))
vi.mock('@/lib/query-client', () => ({ invalidateProfileScopedQueries: vi.fn() }))
vi.mock('@/store/starmap', () => ({ resetStarmapGraph: vi.fn() }))
vi.mock('@/lib/bot-face-clock', () => ({ startFaceClock: vi.fn() }))

const { $activeGatewayProfile, $profiles } = await import('@/store/profile')
const { $settingsScopeOverride } = await import('@/store/settings-scope')
const { ScopeChip, SettingsProfileScope, settingsScopeLabel } = await import('./profile-scope')

const profile = (name: string, isDefault = false, extra: Partial<ProfileInfo> = {}): ProfileInfo =>
  ({ has_env: false, is_default: isDefault, model: null, name, ...extra }) as unknown as ProfileInfo

beforeEach(() => {
  $activeGatewayProfile.set('default')
  $settingsScopeOverride.set(null)
  $profiles.set([])
})

afterEach(cleanup)

describe('SettingsProfileScope', () => {
  it('renders nothing with fewer than two profiles', () => {
    $profiles.set([profile('default', true)])

    const { container } = render(<SettingsProfileScope />)
    expect(container.textContent).toBe('')
  })

  it('shows one chip per profile with the active profile selected by default', () => {
    $profiles.set([profile('default', true), profile('coder')])

    render(<SettingsProfileScope />)

    expect(screen.getByRole('radio', { name: 'Work4You' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'coder' })).toBeTruthy()
    expect(screen.getByText('Editing profile')).toBeTruthy()
    // Following the active profile still names the home being edited so the
    // chips cannot be read as a multi-profile bind.
    expect(
      screen.getByText('These settings only change the “Work4You” profile. Other profiles stay independent.')
    ).toBeTruthy()
    expect($settingsScopeOverride.get()).toBeNull()
  })

  it('selecting another profile sets the shared override; re-selecting the active clears it', () => {
    $profiles.set([profile('default', true), profile('coder')])

    render(<SettingsProfileScope />)

    fireEvent.click(screen.getByRole('radio', { name: 'coder' }))
    expect($settingsScopeOverride.get()).toBe('coder')
    expect(
      screen.getByText('These settings only change the “coder” profile. Other profiles stay independent.')
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: 'Work4You' }))
    expect($settingsScopeOverride.get()).toBeNull()
    expect(
      screen.getByText('These settings only change the “Work4You” profile. Other profiles stay independent.')
    ).toBeTruthy()
  })

  it('keeps the note quiet while following the active DEFAULT profile', () => {
    $profiles.set([profile('default', true), profile('coder')])

    render(<SettingsProfileScope />)

    const note = screen.getByRole('status')
    // The default profile is named by the product name, never its slug.
    expect(note.textContent).toContain('Work4You')
    expect(note.hasAttribute('data-scope-loud')).toBe(false)
    expect(note.hasAttribute('data-scope-override')).toBe(false)
  })

  it('states the edit target loudly when the active profile is a non-default bot (no override)', () => {
    // Opening a WorkBot chat makes its profile the active one; a Settings edit
    // then lands in profiles/<bot>/config.yaml while the user believes they
    // are editing their main config. The note must stand out.
    $activeGatewayProfile.set('scout')
    $profiles.set([profile('default', true), profile('scout')])

    render(<SettingsProfileScope />)

    expect($settingsScopeOverride.get()).toBeNull()
    const note = screen.getByRole('status')
    expect(note.textContent).toContain('scout')
    expect(note.getAttribute('data-scope-loud')).toBe('true')
  })

  it('turns the note loud on an explicit pick of a non-default profile and quiet back on the default', () => {
    $profiles.set([profile('default', true), profile('coder')])

    render(<SettingsProfileScope />)

    fireEvent.click(screen.getByRole('radio', { name: 'coder' }))
    expect(screen.getByRole('status').getAttribute('data-scope-loud')).toBe('true')
    expect(screen.getByRole('status').getAttribute('data-scope-override')).toBe('true')

    fireEvent.click(screen.getByRole('radio', { name: 'Work4You' }))
    expect(screen.getByRole('status').hasAttribute('data-scope-loud')).toBe(false)
  })

  it('labels chips with the bot title, else the display name, else the slug', () => {
    $profiles.set([
      profile('default', true, { display_name: 'Work4You (default)' }),
      profile('coder', false, { bot_title: 'JordyV', display_name: 'Copy' }),
      profile('research', false, { display_name: 'Pesquisa' }),
      profile('weather-man')
    ])

    render(<SettingsProfileScope />)

    expect(screen.getByRole('radio', { name: 'Work4You (default)' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'JordyV' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Copy' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Pesquisa' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'weather-man' })).toBeTruthy()
  })

  it('keeps selection keyed on the canonical name while showing the presentation label', () => {
    $profiles.set([profile('default', true), profile('coder', false, { bot_title: 'JordyV' })])

    render(<SettingsProfileScope />)

    fireEvent.click(screen.getByRole('radio', { name: 'JordyV' }))

    expect($settingsScopeOverride.get()).toBe('coder')
    expect(screen.getByRole('status').textContent).toContain('JordyV')
    expect(screen.getByRole('status').textContent).not.toContain('coder')
  })

  it('centers the label, chips, and helper when align is center', () => {
    $profiles.set([profile('default', true), profile('coder')])

    const { container } = render(<SettingsProfileScope align="center" />)
    const root = container.firstElementChild

    expect(root?.className).toContain('items-center')
    expect(root?.className).toContain('text-center')
    expect(screen.getByRole('radiogroup').className).toContain('justify-center')
  })

  it("draws each chip as the profile's bot face, with the selected name open and the others folded", () => {
    $profiles.set([
      profile('default', true, { ui_meta: { 'work4you-bots': { color: '#ef4444', custom: true, shape: 'cloud' } } }),
      profile('coder', false, { bot_title: 'JordyV' })
    ])

    render(<SettingsProfileScope />)

    const selected = screen.getByRole('radio', { name: 'Work4You' })
    const other = screen.getByRole('radio', { name: 'JordyV' })

    // The face is the same drawing the rail and the roster make from the
    // stored look; the label stays the accessible name whether open or folded.
    expect(selected.querySelector('svg')?.getAttribute('data-bot-face')).toBe('default')
    expect(selected.querySelector('svg')?.getAttribute('data-hb-shape')).toBe('cloud')
    expect(other.querySelector('svg')?.getAttribute('data-bot-face')).toBe('coder')
    expect(selected.getAttribute('data-expanded')).toBe('true')
    expect(other.hasAttribute('data-expanded')).toBe(false)

    fireEvent.click(other)

    expect(other.getAttribute('data-expanded')).toBe('true')
    expect(selected.hasAttribute('data-expanded')).toBe(false)
  })
})

describe('ScopeChip', () => {
  it('stays a plain text chip without a profile name', () => {
    render(<ScopeChip active={false} label="All" onSelect={() => undefined} />)

    const chip = screen.getByRole('radio', { name: 'All' })

    expect(chip.querySelector('svg')).toBeNull()
    expect(chip.textContent).toBe('All')
  })
})

describe('settingsScopeLabel', () => {
  it('falls back to the product name for the default profile, never the slug or a "(default)" suffix', () => {
    const label = settingsScopeLabel(profile('default', true))

    expect(label).toBe('Work4You')
    expect(label).not.toContain('(default)')
  })

  it('prefers the bot title, then the display name, and keeps the slug for other profiles', () => {
    expect(settingsScopeLabel(profile('default', true, { display_name: 'Leo bot' }))).toBe('Leo bot')
    expect(settingsScopeLabel(profile('default', true, { bot_title: 'Jarvis', display_name: 'Leo bot' }))).toBe('Jarvis')
    expect(settingsScopeLabel(profile('weather-man'))).toBe('weather-man')
  })
})
