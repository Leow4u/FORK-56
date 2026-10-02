import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import type * as Nanostores from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProfileRail } from './profile-switcher'

const navigate = vi.fn()

vi.mock('react-router', () => ({
  useNavigate: () => navigate
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      common: { cancel: 'Cancel', delete: 'Delete' },
      profiles: {
        actions: 'Actions',
        allProfiles: 'All profiles',
        autoColor: 'Auto',
        color: 'Color…',
        colorFor: 'Color',
        connectGateway: 'Manage gateways…',
        editSoul: 'Edit SOUL.md…',
        exportProfile: 'Export profile…',
        failedLoadSoul: 'Failed to load SOUL.md',
        failedSaveSoul: 'Failed to save SOUL.md',
        importProfile: 'Import profile…',
        manageProfiles: 'Manage profiles…',
        manageShort: 'Manage…',
        newProfile: 'New profile',
        renameMenu: 'Rename…',
        saveSoul: 'Save',
        saving: 'Saving…',
        setColor: (color: string) => `Set color ${color}`,
        showAllProfiles: 'Show all profiles',
        showingAllProfiles: 'Showing all profiles',
        soulSaved: 'SOUL.md saved',
        state: { asleep: 'Asleep', running: 'Running', waking: 'Waking up…' },
        switchTo: 'Switch to',
        switchToProfile: (name: string) => `Switch to ${name}`,
        switcher: 'Profile switcher',
        thisProfile: 'This profile',
        title: 'Profiles'
      }
    }
  })
}))

const { $profileBackendStates, $profileScope, selectProfile, setShowAllProfiles } = vi.hoisted(() => {
  const { atom: makeAtom } = require('nanostores') as typeof Nanostores

  return {
    $profileBackendStates: makeAtom<Record<string, 'asleep' | 'running' | 'waking'>>({}),
    $profileScope: makeAtom<string>('default'),
    selectProfile: vi.fn(),
    setShowAllProfiles: vi.fn()
  }
})

vi.mock('@/store/profile', () => ({
  $activeGatewayProfile: atom('default'),
  $profileBackendStates,
  $profileColors: atom({}),
  $profileCreateRequest: atom(0),
  $profileOrder: atom([]),
  $profiles: atom([{ is_default: true, name: 'default' }]),
  $profileScope,
  ALL_PROFILES: '*',
  normalizeProfileKey: (name: string) => name,
  profileLabel: (profile: { display_name?: string; name: string }) =>
    (profile.display_name ?? '').trim() || profile.name,
  refreshActiveProfile: vi.fn().mockResolvedValue(undefined),
  selectProfile,
  setProfileColor: vi.fn(),
  setProfileOrder: vi.fn(),
  setShowAllProfiles,
  sortByProfileOrder: (profiles: unknown[]) => profiles
}))

vi.mock('@/store/profile-share', () => ({
  runExportProfileFlow: vi.fn(),
  runImportProfileFlow: vi.fn()
}))

vi.mock('./use-profile-prewarm', () => ({
  useProfilePrewarm: () => ({ cancelPrewarm: vi.fn(), startPrewarm: vi.fn() })
}))

vi.mock('@/work4you', () => ({
  getProfileSoul: vi.fn().mockResolvedValue({ content: '' }),
  updateProfileSoul: vi.fn()
}))

// The hover panel's segmented control sits in a Radix popover, whose size hook
// wants a ResizeObserver jsdom doesn't ship. Nothing here measures anything.
vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
)

vi.mock('@/components/chat/code-editor', () => ({ CodeEditor: () => null }))
vi.mock('../../profiles/create-profile-dialog', () => ({ CreateProfileDialog: () => null }))
vi.mock('../../profiles/delete-profile-dialog', () => ({ DeleteProfileDialog: () => null }))
vi.mock('../../profiles/rename-profile-dialog', () => ({ RenameProfileDialog: () => null }))

const { $profiles } = await import('@/store/profile')

const profiles = $profiles as ReturnType<
  typeof atom<Array<{ is_default: boolean; model?: null | string; name: string }>>
>

const TWO_PROFILES = [
  { is_default: true, name: 'default' },
  { is_default: false, model: 'openai/gpt-6', name: 'research' }
]

function hoverRail() {
  fireEvent.pointerEnter(screen.getByRole('group', { name: 'Profiles' }))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  navigate.mockClear()
  selectProfile.mockClear()
  setShowAllProfiles.mockClear()
  profiles.set([{ is_default: true, name: 'default' }])
  $profileBackendStates.set({})
  $profileScope.set('default')
})

describe('ProfileRail footer', () => {
  it('opens profile management and hides the gateway shortcut', () => {
    render(<ProfileRail />)

    fireEvent.click(screen.getByRole('button', { name: 'Manage profiles…' }))

    expect(navigate).toHaveBeenCalledWith('/profiles')
    expect(screen.queryByRole('button', { name: 'Manage gateways…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Import profile…' })).toBeNull()
  })

  it('keeps the active profile explicit beside profile management', () => {
    render(<ProfileRail />)

    expect(screen.getByRole('button', { name: 'default' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Manage profiles…' })).toBeTruthy()
    // One profile has nothing to fan out: no All toggle, no hover panel.
    expect(screen.queryByRole('button', { name: 'Show all profiles' })).toBeNull()
  })

  it('keeps thirteen profiles direct and condenses the fourteenth', () => {
    profiles.set([
      { is_default: true, name: 'default' },
      ...Array.from({ length: 12 }, (_, index) => ({ is_default: false, name: `Profile ${index + 1}` }))
    ])
    const { unmount } = render(<ProfileRail />)

    expect(screen.queryByRole('button', { name: 'Profiles' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Profile 12' })).toBeTruthy()
    unmount()

    profiles.set([
      { is_default: true, name: 'default' },
      ...Array.from({ length: 13 }, (_, index) => ({ is_default: false, name: `Profile ${index + 1}` }))
    ])
    render(<ProfileRail />)

    expect(screen.getByRole('button', { name: 'Profiles' })).toBeTruthy()
  })

  it('stays shrinkable with many profiles', () => {
    profiles.set([
      { is_default: true, name: 'default' },
      ...Array.from({ length: 13 }, (_, index) => ({ is_default: false, name: `Profile ${index + 1}` }))
    ])
    render(<ProfileRail />)

    expect(screen.getByRole('group', { name: 'Profiles' }).className).toContain('min-w-0')
    expect(screen.getByRole('button', { name: 'Profiles' })).toBeTruthy()
  })
})

describe('ProfileRail scope controls', () => {
  it('splits "go to default" and "show all" into two buttons', () => {
    profiles.set(TWO_PROFILES)
    render(<ProfileRail />)

    fireEvent.click(screen.getByRole('button', { name: 'Show all profiles' }))
    expect(setShowAllProfiles).toHaveBeenCalledWith(true)
    expect(selectProfile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'default' }))
    expect(selectProfile).toHaveBeenCalledWith('default')
  })

  it('marks the All toggle pressed while the sidebar shows every profile', () => {
    profiles.set(TWO_PROFILES)
    $profileScope.set('*')
    render(<ProfileRail />)

    const toggle = screen.getByRole('button', { name: 'Showing all profiles' })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggle)
    expect(setShowAllProfiles).toHaveBeenCalledWith(false)
  })

  it('switches on a tile click without waiting for the hover panel', () => {
    profiles.set(TWO_PROFILES)
    render(<ProfileRail />)

    fireEvent.click(screen.getByRole('button', { name: 'research' }))

    expect(selectProfile).toHaveBeenCalledWith('research')
    expect(screen.queryByRole('dialog', { name: 'Profile switcher' })).toBeNull()
  })
})

describe('ProfileRail backend state', () => {
  it('paints each tile with its backend state', () => {
    profiles.set(TWO_PROFILES)
    $profileBackendStates.set({ default: 'running', research: 'asleep' })
    render(<ProfileRail />)

    const defaultTile = screen.getByRole('button', { name: 'default' })
    const researchTile = screen.getByRole('button', { name: 'research' })

    expect(defaultTile.querySelector('[data-state="running"]')).toBeTruthy()
    expect(researchTile.querySelector('[data-state="asleep"]')).toBeTruthy()
  })
})

describe('ProfileRail hover panel', () => {
  it('opens after a dwell with identity, scope and the other profiles, and closes on leave', () => {
    vi.useFakeTimers()
    profiles.set(TWO_PROFILES)
    $profileBackendStates.set({ default: 'running', research: 'asleep' })
    render(<ProfileRail />)

    hoverRail()
    expect(screen.queryByRole('dialog', { name: 'Profile switcher' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(200)
    })

    const panel = screen.getByRole('dialog', { name: 'Profile switcher' })
    expect(panel.textContent).toContain('default')
    expect(panel.textContent).toContain('Running')
    expect(screen.getByRole('button', { name: 'This profile' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All profiles' })).toBeTruthy()

    const row = screen.getByRole('button', { name: 'Switch to research' })
    expect(row.textContent).toContain('Asleep')

    fireEvent.pointerLeave(screen.getByRole('group', { name: 'Profiles' }))
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.queryByRole('dialog', { name: 'Profile switcher' })).toBeNull()
  })

  it('switches from a panel row and flips scope from the segmented control', () => {
    vi.useFakeTimers()
    profiles.set(TWO_PROFILES)
    render(<ProfileRail />)

    hoverRail()
    act(() => {
      vi.advanceTimersByTime(200)
    })

    fireEvent.click(screen.getByRole('button', { name: 'All profiles' }))
    expect(setShowAllProfiles).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to research' }))
    expect(selectProfile).toHaveBeenCalledWith('research')
    expect(screen.queryByRole('dialog', { name: 'Profile switcher' })).toBeNull()
  })

  it('stays open while a row menu is up, even though the menu portals outside the panel', () => {
    vi.useFakeTimers()
    profiles.set(TWO_PROFILES)
    render(<ProfileRail />)

    hoverRail()
    act(() => {
      vi.advanceTimersByTime(200)
    })

    const kebab = screen.getByRole('button', { name: 'Actions: research' })
    // Radix opens the menu on the pointerdown/up pair, not the synthetic click.
    // (No findBy here: waitFor polls with real timers, which fake timers stall.)
    act(() => {
      fireEvent.pointerDown(kebab, { button: 0, pointerType: 'mouse' })
      fireEvent.pointerUp(kebab, { button: 0, pointerType: 'mouse' })
      fireEvent.click(kebab)
      vi.advanceTimersByTime(50)
    })

    const menu = screen.getByRole('menu')
    expect(menu.textContent).toContain('Edit SOUL.md…')

    // The modal menu aria-hides everything else (the panel included) while it
    // is up, so look the panel up with `hidden` — it must still be mounted.
    const panel = () => screen.queryByRole('dialog', { hidden: true, name: 'Profile switcher' })
    expect(panel()).toBeTruthy()

    // Moving onto the (portaled) menu fires pointerleave on the panel; a click
    // in it is an "outside" interaction for the popover. Neither may close it.
    fireEvent.pointerLeave(panel()!, { relatedTarget: menu })
    fireEvent.pointerDown(menu, { button: 0, pointerType: 'mouse' })
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(panel()).toBeTruthy()
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('never opens for a single profile', () => {
    vi.useFakeTimers()
    render(<ProfileRail />)

    hoverRail()
    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(screen.queryByRole('dialog', { name: 'Profile switcher' })).toBeNull()
  })
})
