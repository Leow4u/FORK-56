import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as notifications from '@/store/notifications'
import { $activeGatewayProfile, $activeProfile, $profiles } from '@/store/profile'
import { makeOAuthProvider } from '@/test/oauth-provider'
import type { ProfileInfo } from '@/types/work4you'

import {
  $desktopOnboarding,
  $profileCredentialWarning,
  adoptPortalLoginForProfile,
  clearPendingProfileAdopt,
  completeDesktopOnboarding,
  consumePendingCredentialWarning,
  type DesktopOnboardingState,
  dismissProfileCredentialWarning,
  dismissProfileSetup,
  type OnboardingContext,
  peekPendingProfileAdopt,
  refreshOnboarding,
  requestDesktopOnboarding,
  requestDesktopOnboardingForCredentialWarning,
  requestDesktopOnboardingWithPortalLogin
} from './onboarding'

const CONFIGURED_KEY = 'work4you-desktop-onboarded-v1'
const WARNING = "No API key configured for provider 'openrouter'. First message will fail."
const PORTAL_EXPIRED = 'Session expired and no refresh token is available.'
const MODEL = 'work4you/operis-5'

function configuredState(overrides: Partial<DesktopOnboardingState> = {}): DesktopOnboardingState {
  return {
    configured: true,
    flow: { status: 'idle' },
    mode: 'oauth',
    providers: null,
    reason: null,
    requested: false,
    firstRunSkipped: false,
    manual: false,
    localEndpoint: false,
    reauth: false,
    profileSetup: null,
    ...overrides
  }
}

function profileInfo(name: string, display_name?: string): ProfileInfo {
  return {
    display_name,
    has_env: false,
    is_default: name === 'default',
    model: null,
    name,
    path: `/home/u/.work4you/profiles/${name}`,
    provider: null,
    skill_count: 0
  }
}

type ApiCall = { body?: unknown; path: string }

function installApiMock(api: (request: ApiCall) => Promise<unknown>) {
  Object.defineProperty(window, 'work4youDesktop', {
    configurable: true,
    value: { api }
  })
}

// The live profile's REST surface during an adopt: its OAuth catalog, the
// recommended Portal model, and the model pin. `recommendedModel: ''` mimics an
// account the backend could not pick a model for.
function profileApi(calls: ApiCall[] = [], recommendedModel = MODEL) {
  return async (request: ApiCall) => {
    calls.push(request)

    if (request.path === '/api/providers/oauth') {
      return { providers: [{ ...makeOAuthProvider('work4you', 'Work4You Portal'), status: { logged_in: true } }] }
    }

    if (request.path.startsWith('/api/model/recommended-default?')) {
      return { provider: 'work4you', model: recommendedModel, free_tier: false }
    }

    if (request.path === '/api/model/set') {
      return { ok: true, provider: 'work4you', model: MODEL, gateway_tools: [] }
    }

    throw new Error(`unexpected api path: ${request.path}`)
  }
}

function readyGateway(): OnboardingContext['requestGateway'] {
  return async (method, params) => {
    if (method === 'reload.env') {
      return {} as never
    }

    if (method === 'setup.status') {
      return { provider_configured: true } as never
    }

    if (method === 'setup.runtime_check') {
      expect(params).toEqual({ provider: 'work4you' })

      return { ok: true } as never
    }

    throw new Error(`unexpected gateway method: ${method}`)
  }
}

function failingGateway(error: string): OnboardingContext['requestGateway'] {
  return async method => {
    if (method === 'reload.env') {
      return {} as never
    }

    if (method === 'setup.status') {
      return { provider_configured: true } as never
    }

    if (method === 'setup.runtime_check') {
      return { ok: false, error, provider: 'work4you' } as never
    }

    throw new Error(`unexpected gateway method: ${method}`)
  }
}

// Drive the public API: a warning-free session event clears the stash and
// disarms the submit gate.
const resetWarning = () => requestDesktopOnboardingForCredentialWarning(undefined)

describe('profile-scoped onboarding', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetWarning()
    clearPendingProfileAdopt()
    $profiles.set([profileInfo('default'), profileInfo('research', 'Research')])
    $activeProfile.set('default')
    $activeGatewayProfile.set('research')
    $desktopOnboarding.set(configuredState())
  })

  afterEach(() => {
    resetWarning()
    clearPendingProfileAdopt()
    $activeGatewayProfile.set('default')
    $activeProfile.set('default')
    $profiles.set([])
    $desktopOnboarding.set(configuredState())
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('deferred credential warning', () => {
    it('keys the warning by the live gateway profile and exposes it for the banner', () => {
      requestDesktopOnboardingForCredentialWarning(WARNING)

      expect($profileCredentialWarning.get()).toEqual({ profile: 'research', warning: WARNING, dismissed: false })
      // Looking at the profile never opens the overlay.
      expect($desktopOnboarding.get()).toMatchObject({ requested: false, profileSetup: null })
    })

    it('fires the submit gate once per warning while the banner keeps showing', () => {
      requestDesktopOnboardingForCredentialWarning(WARNING)

      expect(consumePendingCredentialWarning()).toBe(WARNING)
      expect(consumePendingCredentialWarning()).toBeNull()
      expect($profileCredentialWarning.get()?.warning).toBe(WARNING)
    })

    it('does not gate a send on a different live profile', () => {
      requestDesktopOnboardingForCredentialWarning(WARNING)
      $activeGatewayProfile.set('default')

      expect(consumePendingCredentialWarning()).toBeNull()
    })

    it('keeps a dismissed banner dismissed when heartbeats repeat the warning, but re-arms the gate', () => {
      requestDesktopOnboardingForCredentialWarning(WARNING)
      dismissProfileCredentialWarning()
      expect(consumePendingCredentialWarning()).toBe(WARNING)

      requestDesktopOnboardingForCredentialWarning(WARNING)

      expect($profileCredentialWarning.get()?.dismissed).toBe(true)
      expect(consumePendingCredentialWarning()).toBe(WARNING)
    })

    it('clears the banner on a warning-free session event', () => {
      requestDesktopOnboardingForCredentialWarning(WARNING)
      requestDesktopOnboardingForCredentialWarning(undefined)

      expect($profileCredentialWarning.get()).toBeNull()
      expect(consumePendingCredentialWarning()).toBeNull()
    })
  })

  describe('requestDesktopOnboarding', () => {
    it('opens the profile panel on a secondary profile instead of flipping the app-wide state', () => {
      installApiMock(profileApi())

      requestDesktopOnboarding(WARNING, { pendingPrompt: true })

      const state = $desktopOnboarding.get()
      expect(state.profileSetup).toEqual({
        profile: 'research',
        reason: WARNING,
        reauth: false,
        pendingPrompt: true,
        adopting: false,
        error: null
      })
      expect(state).toMatchObject({ requested: true, manual: false, reason: null, reauth: false, configured: true })
      expect(window.localStorage.getItem(CONFIGURED_KEY)).toBeNull()
    })

    it('marks a Portal-session failure as the reauth variant of the panel', () => {
      installApiMock(profileApi())

      requestDesktopOnboarding(PORTAL_EXPIRED)

      expect($desktopOnboarding.get().profileSetup).toMatchObject({ reauth: true, pendingPrompt: false })
      // The app-wide reauth flag describes the primary; it stays off.
      expect($desktopOnboarding.get().reauth).toBe(false)
    })

    it('keeps the first-run door for the primary profile and for app-scoped requests', () => {
      $activeGatewayProfile.set('default')
      requestDesktopOnboarding(WARNING)

      expect($desktopOnboarding.get()).toMatchObject({ requested: true, reason: WARNING, profileSetup: null })

      $desktopOnboarding.set(configuredState())
      $activeGatewayProfile.set('research')
      requestDesktopOnboarding(PORTAL_EXPIRED, { scope: 'app' })

      expect($desktopOnboarding.get()).toMatchObject({
        requested: true,
        reason: PORTAL_EXPIRED,
        reauth: true,
        profileSetup: null
      })
    })

    it('does not reset a panel whose adopt call is in flight', () => {
      installApiMock(profileApi())
      requestDesktopOnboarding(WARNING)

      const current = $desktopOnboarding.get()
      $desktopOnboarding.set({ ...current, profileSetup: { ...current.profileSetup!, adopting: true } })

      requestDesktopOnboarding(PORTAL_EXPIRED)

      expect($desktopOnboarding.get().profileSetup).toMatchObject({ adopting: true, reason: WARNING, reauth: false })
    })
  })

  describe('refreshOnboarding', () => {
    it('loads the live profile catalog and never runs the primary runtime gate', async () => {
      const calls: ApiCall[] = []
      installApiMock(profileApi(calls))
      window.localStorage.setItem(CONFIGURED_KEY, '1')
      requestDesktopOnboarding(WARNING)

      const requestGateway = vi.fn(async () => {
        throw new Error('the runtime check must not run for a profile panel')
      })

      const ready = await refreshOnboarding({ requestGateway: requestGateway as never })

      expect(ready).toBe(false)
      expect(requestGateway).not.toHaveBeenCalled()
      expect($desktopOnboarding.get()).toMatchObject({ configured: true, requested: true })
      expect(window.localStorage.getItem(CONFIGURED_KEY)).toBe('1')
      expect($desktopOnboarding.get().providers?.map(p => p.id)).toEqual(['work4you'])
      expect(calls.filter(c => c.path === '/api/providers/oauth').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('adoptPortalLoginForProfile', () => {
    it('pins the recommended Portal model on the live profile, then closes the panel and the banner', async () => {
      const calls: ApiCall[] = []
      installApiMock(profileApi(calls))
      const notifySpy = vi.spyOn(notifications, 'notify')
      const onCompleted = vi.fn()

      requestDesktopOnboardingForCredentialWarning(WARNING)
      expect(consumePendingCredentialWarning()).toBe(WARNING)
      requestDesktopOnboarding(WARNING, { pendingPrompt: true })

      await adoptPortalLoginForProfile({ requestGateway: readyGateway(), onCompleted })

      const set = calls.find(c => c.path === '/api/model/set')
      expect(set?.body).toMatchObject({ scope: 'main', provider: 'work4you', model: MODEL })
      expect($desktopOnboarding.get()).toMatchObject({ requested: false, profileSetup: null, configured: true })
      // The profile is done: banner gone, gate quiet, app-wide flag untouched.
      expect($profileCredentialWarning.get()).toBeNull()
      expect(consumePendingCredentialWarning()).toBeNull()
      expect(window.localStorage.getItem(CONFIGURED_KEY)).toBeNull()
      expect(onCompleted).toHaveBeenCalledTimes(1)
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'success',
          title: 'Research is ready',
          message: `${MODEL} via your Work4You account.`
        })
      )
    })

    it('keeps the panel open with the runtime reason when the profile still cannot resolve', async () => {
      installApiMock(profileApi())
      const notifySpy = vi.spyOn(notifications, 'notify')
      requestDesktopOnboarding(WARNING)

      await adoptPortalLoginForProfile({
        requestGateway: failingGateway('No access token found for Work4You Portal login.')
      })

      expect($desktopOnboarding.get().profileSetup).toMatchObject({
        adopting: false,
        error: 'No access token found for Work4You Portal login.'
      })
      expect($desktopOnboarding.get().requested).toBe(true)
      expect(notifySpy).not.toHaveBeenCalled()
    })

    it('explains when the account has no model to recommend', async () => {
      const calls: ApiCall[] = []
      installApiMock(profileApi(calls, ''))
      requestDesktopOnboarding(WARNING)

      await adoptPortalLoginForProfile({ requestGateway: readyGateway() })

      expect($desktopOnboarding.get().profileSetup?.error).toBe(
        'Work4You could not pick a model for your account. Choose a provider instead.'
      )
      expect(calls.some(c => c.path === '/api/model/set')).toBe(false)
    })
  })

  describe('finishing and dismissing', () => {
    it('completeDesktopOnboarding on a profile panel closes it without marking the app configured', () => {
      installApiMock(profileApi())
      requestDesktopOnboardingForCredentialWarning(WARNING)
      requestDesktopOnboarding(WARNING)

      completeDesktopOnboarding()

      expect($desktopOnboarding.get()).toMatchObject({ requested: false, profileSetup: null, configured: true })
      expect(window.localStorage.getItem(CONFIGURED_KEY)).toBeNull()
      expect($profileCredentialWarning.get()).toBeNull()
    })

    it('dismissProfileSetup keeps the banner but leaves the consumed gate quiet', () => {
      installApiMock(profileApi())
      requestDesktopOnboardingForCredentialWarning(WARNING)
      expect(consumePendingCredentialWarning()).toBe(WARNING)
      requestDesktopOnboarding(WARNING, { pendingPrompt: true })

      dismissProfileSetup()

      expect($desktopOnboarding.get()).toMatchObject({ requested: false, profileSetup: null })
      expect($profileCredentialWarning.get()?.warning).toBe(WARNING)
      expect(consumePendingCredentialWarning()).toBeNull()
    })
  })

  describe('banner one-click hand-off', () => {
    it('opens the panel with a pending adopt on a secondary profile', () => {
      installApiMock(profileApi())

      requestDesktopOnboardingWithPortalLogin(WARNING)

      expect($desktopOnboarding.get().profileSetup?.profile).toBe('research')
      expect(peekPendingProfileAdopt()).toBe(true)

      clearPendingProfileAdopt()

      expect(peekPendingProfileAdopt()).toBe(false)
    })

    it('falls back to the plain request on the primary profile', () => {
      $activeGatewayProfile.set('default')

      requestDesktopOnboardingWithPortalLogin(WARNING)

      expect($desktopOnboarding.get()).toMatchObject({ requested: true, reason: WARNING, profileSetup: null })
      expect(peekPendingProfileAdopt()).toBe(false)
    })
  })
})
