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
// The selector refreshes the roster on mount; answer with the roster the test
// set so an awaited query never sees the list wiped to [] mid-test.
const roster = vi.hoisted(() => ({ profiles: [] as unknown[] }))
vi.mock('@/work4you', () => ({
  getProfiles: vi.fn(async () => ({ profiles: roster.profiles })),
  setApiRequestProfile: vi.fn()
}))
vi.mock('@/lib/query-client', () => ({ invalidateProfileScopedQueries: vi.fn() }))
vi.mock('@/store/starmap', () => ({ resetStarmapGraph: vi.fn() }))
vi.mock('@/lib/bot-face-clock', () => ({ startFaceClock: vi.fn() }))

const { $activeGatewayProfile, $profiles } = await import('@/store/profile')
const { $settingsScopeOverride } = await import('@/store/settings-scope')
const { SettingsProfileScope, settingsScopeLabel } = await import('./profile-scope')

const profile = (name: string, isDefault = false, extra: Partial<ProfileInfo> = {}): ProfileInfo =>
  ({ has_env: false, is_default: isDefault, model: null, name, ...extra }) as unknown as ProfileInfo

function setProfiles(list: ProfileInfo[]) {
  roster.profiles = list
  $profiles.set(list)
}

// The selector is a Select — open it, then pick the option by its label.
async function pick(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Configuring:' }))
  fireEvent.click(await screen.findByRole('option', { name }))
}

beforeEach(() => {
  // jsdom's scrollIntoView is missing; Radix Select calls it on open.
  Element.prototype.scrollIntoView = vi.fn()
  $activeGatewayProfile.set('default')
  $settingsScopeOverride.set(null)
  setProfiles([])
})

afterEach(cleanup)

describe('SettingsProfileScope', () => {
  it('renders nothing with fewer than two profiles', () => {
    setProfiles([profile('default', true)])

    const { container } = render(<SettingsProfileScope />)

    expect(container.textContent).toBe('')
  })

  it('shows the dropdown with the active profile selected and no note while editing the default profile', async () => {
    setProfiles([profile('default', true), profile('coder')])

    render(<SettingsProfileScope />)

    expect(screen.getByText('Configuring:')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Configuring:' }).textContent).toContain('Work4You')
    // Editing the default profile needs no note.
    expect(screen.queryByRole('status')).toBeNull()
    expect($settingsScopeOverride.get()).toBeNull()

    fireEvent.click(screen.getByRole('combobox', { name: 'Configuring:' }))
    expect(await screen.findByRole('option', { name: 'Work4You' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'coder' })).toBeTruthy()
  })

  it('selecting another profile sets the shared override and names it loudly; re-selecting the active clears both', async () => {
    setProfiles([profile('default', true), profile('coder')])

    render(<SettingsProfileScope />)

    await pick('coder')
    expect($settingsScopeOverride.get()).toBe('coder')
    expect(
      screen.getByText('These settings only change the “coder” profile. Other profiles stay independent.')
    ).toBeTruthy()
    expect(screen.getByRole('status').getAttribute('data-scope-loud')).toBe('true')
    expect(screen.getByRole('status').getAttribute('data-scope-override')).toBe('true')

    await pick('Work4You')
    expect($settingsScopeOverride.get()).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('states the edit target loudly when the active profile is a non-default bot (no override)', () => {
    // Opening a WorkBot chat makes its profile the active one; a Settings edit
    // then lands in profiles/<bot>/config.yaml while the user believes they
    // are editing their main config. The note must stand out.
    $activeGatewayProfile.set('scout')
    setProfiles([profile('default', true), profile('scout')])

    render(<SettingsProfileScope />)

    expect($settingsScopeOverride.get()).toBeNull()
    const note = screen.getByRole('status')
    expect(note.textContent).toContain('scout')
    expect(note.getAttribute('data-scope-loud')).toBe('true')
    expect(note.hasAttribute('data-scope-override')).toBe(false)
  })

  it('labels options with the bot title, else the display name, else the product name for the default, else the slug', async () => {
    setProfiles([
      profile('default', true),
      profile('coder', false, { bot_title: 'JordyV', display_name: 'Copy' }),
      profile('research', false, { display_name: 'Pesquisa' }),
      profile('weather-man')
    ])

    render(<SettingsProfileScope />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Configuring:' }))

    expect(await screen.findByRole('option', { name: 'Work4You' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'JordyV' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Copy' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Pesquisa' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'weather-man' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /\(default\)/ })).toBeNull()
  })

  it('keeps selection keyed on the canonical name while showing the presentation label', async () => {
    setProfiles([profile('default', true), profile('coder', false, { bot_title: 'JordyV' })])

    render(<SettingsProfileScope />)

    await pick('JordyV')

    expect($settingsScopeOverride.get()).toBe('coder')
    expect(screen.getByRole('status').textContent).toContain('JordyV')
    expect(screen.getByRole('status').textContent).not.toContain('coder')
  })

  it('centers the selector and the note when align is center', () => {
    $activeGatewayProfile.set('coder')
    setProfiles([profile('default', true), profile('coder')])

    const { container } = render(<SettingsProfileScope align="center" />)
    const root = container.firstElementChild

    expect(root?.className).toContain('items-center')
    expect(root?.className).toContain('text-center')
    expect(screen.getByRole('status').className).toContain('max-w-xl')
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
