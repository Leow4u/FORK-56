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

const { $activeGatewayProfile, $profiles } = await import('@/store/profile')
const { $settingsScopeOverride } = await import('@/store/settings-scope')
const { SettingsProfileScope } = await import('./profile-scope')

const profile = (name: string, isDefault = false): ProfileInfo =>
  ({ has_env: false, is_default: isDefault, model: null, name }) as unknown as ProfileInfo

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

    expect(screen.getByRole('radio', { name: 'default' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'coder' })).toBeTruthy()
    expect(screen.getByText('Editing profile')).toBeTruthy()
    // Following the active profile still names the home being edited so the
    // chips cannot be read as a multi-profile bind.
    expect(
      screen.getByText('These settings only change the “default” profile. Other profiles stay independent.')
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

    fireEvent.click(screen.getByRole('radio', { name: 'default' }))
    expect($settingsScopeOverride.get()).toBeNull()
    expect(
      screen.getByText('These settings only change the “default” profile. Other profiles stay independent.')
    ).toBeTruthy()
  })
})
