import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
        agentPanel: 'Agent panel',
        editProfile: 'Edit profile…',
        allConversations: 'Conversations from all profiles',
        railState: { asleep: 'On standby', running: 'Ready', waking: 'Starting…' },
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

const { $profileBackendStates, $activeGatewayProfile, $profileScope, selectProfile, setShowAllProfiles } = vi.hoisted(
  () => {
    const { atom: makeAtom } = require('nanostores') as typeof Nanostores

    return {
      $profileBackendStates: makeAtom<Record<string, 'asleep' | 'running' | 'waking'>>({}),
      $activeGatewayProfile: makeAtom<string>('default'),
      $profileScope: makeAtom<string>('default'),
      selectProfile: vi.fn(),
      setShowAllProfiles: vi.fn()
    }
  }
)

vi.mock('@/store/profile', () => ({
  $profileBackendStates,
  $profileColors: atom({}),
  $profileCreateRequest: atom(0),
  $profileOrder: atom([]),
  $activeGatewayProfile,
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

// The panel switch sits in a Radix popover, whose size hook
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

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Agent panel' }))

  return screen.getByRole('dialog', { name: 'Agent panel' })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  profiles.set([{ is_default: true, name: 'default' }])
  $profileBackendStates.set({})
  $activeGatewayProfile.set('default')
  $profileScope.set('default')
  window.localStorage.removeItem('work4you.desktop.profileRail')
})

describe('ProfileRail', () => {
  it('keeps avatars, creation, management and the panel reachable for a single profile', () => {
    window.localStorage.setItem('work4you.desktop.profileRail', 'collapsed')
    render(<ProfileRail />)
    expect(screen.getByRole('button', { name: 'default' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New profile' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Manage profiles…' }))
    expect(navigate).toHaveBeenCalledWith('/profiles')
    const panel = openPanel()
    expect(panel.textContent).toContain('default')
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Manage gateways…' })).toBeNull()
  })

  it('never opens the panel on hover or keyboard focus', () => {
    vi.useFakeTimers()
    profiles.set(TWO_PROFILES)
    render(<ProfileRail />)
    fireEvent.pointerEnter(screen.getByRole('group', { name: 'Profiles' }))
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'research' }))
    fireEvent.focus(screen.getByRole('button', { name: 'Agent panel' }))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByRole('dialog', { name: 'Agent panel' })).toBeNull()
  })

  it('opens by clicking the chevron and stays open when the pointer leaves', () => {
    vi.useFakeTimers()
    profiles.set(TWO_PROFILES)
    $activeGatewayProfile.set('research')
    $profileBackendStates.set({ research: 'running' })
    render(<ProfileRail />)
    const panel = openPanel()
    expect(panel.textContent).toContain('research')
    expect(panel.textContent).toContain('Ready')
    expect(panel.textContent).toContain('GPT-6')
    expect(panel.textContent).not.toContain('default')
    expect(screen.getByRole('button', { name: 'Agent panel' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.pointerLeave(panel)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('dialog', { name: 'Agent panel' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Agent panel' }))
    expect(screen.queryByRole('dialog', { name: 'Agent panel' })).toBeNull()
    expect(screen.getByRole('button', { name: 'research' })).toBeTruthy()
  })

  it('dismisses with Escape and returns focus to the chevron', async () => {
    render(<ProfileRail />)
    openPanel()
    fireEvent.keyDown(window.document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Agent panel' })).toBeNull()
    await waitFor(() => expect(window.document.activeElement).toBe(screen.getByRole('button', { name: 'Agent panel' })))
  })

  it('dismisses on an outside pointer interaction', async () => {
    render(<ProfileRail />)
    openPanel()
    // Radix installs its outside pointer listener on the next task.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    fireEvent.pointerDown(window.document.body, { button: 0, pointerType: 'mouse' })
    fireEvent.click(window.document.body)
    expect(screen.queryByRole('dialog', { name: 'Agent panel' })).toBeNull()
  })

  it('switches directly from a face and closes the panel', () => {
    profiles.set(TWO_PROFILES)
    render(<ProfileRail />)
    openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'research' }))
    expect(selectProfile).toHaveBeenCalledWith('research')
    expect(screen.queryByRole('dialog', { name: 'Agent panel' })).toBeNull()
  })

  it('opens the selected agent in the existing manager without switching agents', () => {
    profiles.set(TWO_PROFILES)
    $activeGatewayProfile.set('research')
    render(<ProfileRail />)
    openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile…' }))
    expect(navigate).toHaveBeenCalledWith('/profiles?profile=research')
    expect(selectProfile).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Agent panel' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit SOUL.md…' })).toBeNull()
  })

  it('puts the all-conversations switch only inside the panel without changing active identity', () => {
    profiles.set(TWO_PROFILES)
    $activeGatewayProfile.set('research')
    render(<ProfileRail />)
    expect(screen.queryByRole('switch')).toBeNull()
    openPanel()
    fireEvent.click(screen.getByRole('switch', { name: 'Conversations from all profiles' }))
    expect(setShowAllProfiles).toHaveBeenCalledWith(true)
    expect(selectProfile).not.toHaveBeenCalled()
    act(() => {
      $profileScope.set('*')
    })
    expect(screen.getByRole('button', { name: 'research' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'default' }).getAttribute('aria-pressed')).toBe('false')
    const toggle = screen.getByRole('switch', { name: 'Conversations from all profiles' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    expect(setShowAllProfiles).toHaveBeenLastCalledWith(false)
  })

  it('keeps the default identity selected when all conversations are shown', () => {
    profiles.set(TWO_PROFILES)
    $profileScope.set('*')
    render(<ProfileRail />)
    expect(screen.getByRole('button', { name: 'default' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps faces and creation reachable at large profile counts', () => {
    profiles.set([
      { is_default: true, name: 'default' },
      ...Array.from({ length: 20 }, (_, index) => ({ is_default: false, name: `Profile ${index + 1}` }))
    ])
    $activeGatewayProfile.set('Profile 20')
    render(<ProfileRail />)
    expect(screen.getByRole('button', { name: 'Profile 20' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New profile' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Manage profiles…' })).toBeTruthy()
    expect(openPanel().textContent).toContain('Profile 20')
    fireEvent.click(screen.getByRole('button', { name: 'Profile 19' }))
    expect(selectProfile).toHaveBeenCalledWith('Profile 19')
  })

  it.each([
    ['running', 'Ready'],
    ['waking', 'Starting…'],
    ['asleep', 'On standby']
  ] as const)('shows the selected agent availability for %s', (state, label) => {
    $profileBackendStates.set({ default: state })
    render(<ProfileRail />)
    expect(openPanel().textContent).toContain(label)
    expect(screen.getByRole('button', { name: 'default' }).querySelector(`[data-state="${state}"]`)).toBeTruthy()
  })
})
