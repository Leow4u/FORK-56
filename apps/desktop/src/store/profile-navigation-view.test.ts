import { atom } from 'nanostores'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Keep profile.ts's side-effecting imports inert: the gateway socket layer and
// the REST query client must not run for real in a unit test.
vi.mock('@/store/gateway', () => ({
  $gateway: atom<unknown>(null),
  activeGateway: () => null,
  activeGatewayConnectionId: () => null,
  ensureActiveGatewayOpen: async () => null,
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

const {
  $activeGatewayProfile,
  $profileScope,
  $showAllProfiles,
  ALL_PROFILES,
  endProfileNavigationView,
  selectProfile,
  setShowAllProfiles,
  showAllProfilesForNavigation,
  toggleShowAllProfiles
} = await import('./profile')

const STORAGE_KEY = 'work4you.desktop.showAllProfiles'
const saved = () => window.localStorage.getItem(STORAGE_KEY)

beforeEach(() => {
  setShowAllProfiles(false)
  $activeGatewayProfile.set('default')
})

describe('the all-profiles view a navigation asks for', () => {
  it('shows every profile without rewriting the scope the user saved', () => {
    showAllProfilesForNavigation()

    expect($showAllProfiles.get()).toBe(true)
    expect($profileScope.get()).toBe(ALL_PROFILES)
    expect(saved()).toBe('false')
  })

  it('ends back on the single profile the user chose', () => {
    $activeGatewayProfile.set('asas')
    showAllProfilesForNavigation()

    endProfileNavigationView()

    expect($showAllProfiles.get()).toBe(false)
    expect($profileScope.get()).toBe('asas')
  })

  it('leaves a user who chose all profiles in all profiles when it ends', () => {
    setShowAllProfiles(true)
    showAllProfilesForNavigation()

    endProfileNavigationView()

    expect($showAllProfiles.get()).toBe(true)
    expect(saved()).toBe('true')
  })

  it('gives way to an explicit pick, which is saved', () => {
    showAllProfilesForNavigation()

    setShowAllProfiles(true)
    endProfileNavigationView()

    expect($showAllProfiles.get()).toBe(true)
    expect(saved()).toBe('true')
  })

  it('toggles from what the user sees, so one press leaves all profiles', () => {
    showAllProfilesForNavigation()

    toggleShowAllProfiles()

    expect($showAllProfiles.get()).toBe(false)
    expect(saved()).toBe('false')
  })

  it('is left by picking a profile, like the saved view', () => {
    showAllProfilesForNavigation()

    selectProfile('default')

    expect($showAllProfiles.get()).toBe(false)
    expect($profileScope.get()).toBe('default')
  })
})
