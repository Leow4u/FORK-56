import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as notifications from '@/store/notifications'
import { makeOAuthProvider } from '@/test/oauth-provider'
import type { OAuthProvider } from '@/types/work4you'

import {
  $desktopOnboarding,
  cancelOnboardingFlow,
  type DesktopOnboardingState,
  isOnboardingFlowInFlight,
  type OnboardingContext,
  refreshOnboarding,
  requestDesktopOnboarding,
  saveOnboardingLocalEndpoint,
  startProviderOAuth,
  submitOnboardingCode
} from './onboarding'

function baseState(overrides: Partial<DesktopOnboardingState> = {}): DesktopOnboardingState {
  return {
    configured: false,
    flow: { status: 'idle' },
    mode: 'oauth',
    providers: null,
    reason: null,
    requested: false,
    firstRunSkipped: false,
    manual: false,
    localEndpoint: false,
    reauth: false,
    ...overrides
  }
}

function installApiMock(api: (request: { path: string }) => Promise<unknown>) {
  Object.defineProperty(window, 'work4youDesktop', {
    configurable: true,
    value: { api }
  })
}

function emptyOpenRouterGateway(): OnboardingContext['requestGateway'] {
  return async method => {
    if (method === 'setup.status') {
      return { provider_configured: true } as never
    }

    if (method === 'setup.runtime_check') {
      return { error: 'No usable credentials found for openrouter.', ok: false, provider: 'openrouter' } as never
    }

    throw new Error(`unexpected gateway method: ${method}`)
  }
}

function portalTokenGateway(): OnboardingContext['requestGateway'] {
  return async method => {
    if (method === 'setup.status') {
      return { provider_configured: true } as never
    }

    if (method === 'setup.runtime_check') {
      return { error: 'No access token found for Work4You Portal login.', ok: false, provider: 'work4you' } as never
    }

    throw new Error(`unexpected gateway method: ${method}`)
  }
}

function keylessCustomGateway(): OnboardingContext['requestGateway'] {
  return async method => {
    if (method === 'setup.status') {
      return { provider_configured: true } as never
    }

    if (method === 'setup.runtime_check') {
      return { ok: true, provider: 'custom' } as never
    }

    throw new Error(`unexpected gateway method: ${method}`)
  }
}

function onboardingContext(requestGateway: OnboardingContext['requestGateway']): OnboardingContext {
  return { requestGateway }
}

function fallbackTimeoutGateway(): OnboardingContext['requestGateway'] {
  return async method => {
    if (method === 'setup.status' || method === 'setup.runtime_check') {
      throw new Error(`request timed out: ${method}`)
    }

    throw new Error(`unexpected gateway method: ${method}`)
  }
}

describe('refreshOnboarding', () => {
  beforeEach(() => {
    window.localStorage.clear()
    $desktopOnboarding.set(baseState())
  })

  afterEach(() => {
    window.localStorage.clear()
    $desktopOnboarding.set(baseState())
    vi.restoreAllMocks()
  })

  it('refreshes OAuth providers again when onboarding was explicitly requested', async () => {
    const api = vi.fn(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth') {
        return { providers: [makeOAuthProvider('fresh')] }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    installApiMock(api)
    $desktopOnboarding.set(baseState({ providers: [makeOAuthProvider('cached')] }))
    requestDesktopOnboarding('Need provider setup')

    const ready = await refreshOnboarding(onboardingContext(emptyOpenRouterGateway()))

    expect(ready).toBe(false)
    expect(api).toHaveBeenCalledTimes(1)
    expect($desktopOnboarding.get().providers?.map(p => p.id)).toEqual(['fresh'])
    expect($desktopOnboarding.get().reason).toContain('No usable credentials found for openrouter.')
    expect($desktopOnboarding.get().reason).toContain('setup.status reports configured credentials')
  })

  it('keeps cached providers when onboarding was not re-requested', async () => {
    const api = vi.fn(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth') {
        return { providers: [makeOAuthProvider('fresh')] }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    installApiMock(api)
    $desktopOnboarding.set(baseState({ providers: [makeOAuthProvider('cached')] }))

    const ready = await refreshOnboarding(onboardingContext(emptyOpenRouterGateway()))

    expect(ready).toBe(false)
    expect(api).not.toHaveBeenCalled()
    expect($desktopOnboarding.get().providers?.map(p => p.id)).toEqual(['cached'])
  })

  it('does not downgrade configured=true on fallback-only readiness failures', async () => {
    const api = vi.fn(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth') {
        return { providers: [makeOAuthProvider('fresh')] }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    installApiMock(api)
    // Simulate a returning user: cache is set and store is configured.
    window.localStorage.setItem('work4you-desktop-onboarded-v1', '1')
    $desktopOnboarding.set(
      baseState({
        configured: true,
        providers: [makeOAuthProvider('cached')],
        reason: null,
        requested: false
      })
    )

    const ready = await refreshOnboarding(onboardingContext(fallbackTimeoutGateway()))

    expect(ready).toBe(false)
    expect(api).not.toHaveBeenCalled()
    expect($desktopOnboarding.get().configured).toBe(true)
    expect($desktopOnboarding.get().reason).toBeNull()
    // The cache must survive the refresh — proving we didn't downgrade.
    expect(window.localStorage.getItem('work4you-desktop-onboarded-v1')).toBe('1')
  })

  it('shows a non-blocking notification when preserving configured on fallback', async () => {
    const notifySpy = vi.spyOn(notifications, 'notify')

    installApiMock(vi.fn())
    $desktopOnboarding.set(
      baseState({
        configured: true,
        providers: [makeOAuthProvider('cached')],
        reason: null,
        requested: false
      })
    )

    await refreshOnboarding(onboardingContext(fallbackTimeoutGateway()))

    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'runtime-not-ready',
        kind: 'error'
      })
    )
    expect($desktopOnboarding.get().configured).toBe(true)
  })

  it('enters setup when the selected OpenRouter credential is genuinely empty', async () => {
    installApiMock(vi.fn())
    window.localStorage.setItem('work4you-desktop-onboarded-v1', '1')
    $desktopOnboarding.set(
      baseState({
        configured: true,
        providers: [makeOAuthProvider('cached')],
        reason: null,
        requested: false
      })
    )

    const ready = await refreshOnboarding(onboardingContext(emptyOpenRouterGateway()))

    expect(ready).toBe(false)
    expect($desktopOnboarding.get().configured).toBe(false)
    expect($desktopOnboarding.get().reason).toContain('No usable credentials found for openrouter.')
    expect($desktopOnboarding.get().reauth).toBe(false)
    expect(window.localStorage.getItem('work4you-desktop-onboarded-v1')).toBeNull()
  })

  it('marks Portal token failures as reauth, not generic first-run', async () => {
    installApiMock(vi.fn())
    window.localStorage.setItem('work4you-desktop-onboarded-v1', '1')
    $desktopOnboarding.set(
      baseState({
        configured: true,
        providers: [makeOAuthProvider('work4you', 'Work4You Portal')],
        reason: null,
        requested: false
      })
    )

    const ready = await refreshOnboarding(onboardingContext(portalTokenGateway()))

    expect(ready).toBe(false)
    expect($desktopOnboarding.get().configured).toBe(false)
    expect($desktopOnboarding.get().reauth).toBe(true)
    expect($desktopOnboarding.get().reason).toContain('No access token found for Work4You Portal login.')
    expect(window.localStorage.getItem('work4you-desktop-onboarded-v1')).toBeNull()
  })

  it('requestDesktopOnboarding sets reauth only for Portal token reasons', () => {
    $desktopOnboarding.set(baseState())
    requestDesktopOnboarding('No usable credentials found for openrouter.')
    expect($desktopOnboarding.get().reauth).toBe(false)

    requestDesktopOnboarding('No access token found for Work4You Portal login.')
    expect($desktopOnboarding.get().reauth).toBe(true)
    expect($desktopOnboarding.get().requested).toBe(true)
  })

  it('keeps a keyless custom runtime out of setup', async () => {
    const api = vi.fn()

    installApiMock(api)
    $desktopOnboarding.set(baseState({ configured: false, reason: 'stale setup error', requested: true }))

    const ready = await refreshOnboarding(onboardingContext(keylessCustomGateway()))

    expect(ready).toBe(true)
    expect(api).not.toHaveBeenCalled()
    expect($desktopOnboarding.get()).toMatchObject({
      configured: true,
      reason: null,
      requested: false,
      reauth: false
    })
  })

  it('does not preserve configured when onboarding was explicitly requested', async () => {
    const api = vi.fn(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth') {
        return { providers: [makeOAuthProvider('fresh')] }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    installApiMock(api)
    $desktopOnboarding.set(
      baseState({
        configured: true,
        providers: [makeOAuthProvider('cached')],
        reason: null,
        requested: true
      })
    )

    const ready = await refreshOnboarding(onboardingContext(fallbackTimeoutGateway()))

    expect(ready).toBe(false)
    // requested overrides preservation — should downgrade.
    expect($desktopOnboarding.get().configured).toBe(false)
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('still surfaces onboarding when fallback failure happens before configured state', async () => {
    const api = vi.fn(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth') {
        return { providers: [makeOAuthProvider('fresh')] }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    installApiMock(api)
    $desktopOnboarding.set(baseState({ configured: false, providers: null, requested: true }))

    const ready = await refreshOnboarding(onboardingContext(fallbackTimeoutGateway()))

    expect(ready).toBe(false)
    expect(api).toHaveBeenCalledTimes(1)
    expect($desktopOnboarding.get().configured).toBe(false)
    expect($desktopOnboarding.get().reason).toContain('request timed out')
  })

  it('deduplicates concurrent provider refresh calls', async () => {
    let resolveProviders!: (value: { providers: OAuthProvider[] }) => void

    const providersPromise = new Promise<{ providers: OAuthProvider[] }>(resolve => {
      resolveProviders = value => {
        resolve(value)
      }
    })

    const api = vi.fn(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth') {
        return providersPromise
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    installApiMock(api)
    $desktopOnboarding.set(baseState({ requested: true }))

    const first = refreshOnboarding(onboardingContext(emptyOpenRouterGateway()))
    const second = refreshOnboarding(onboardingContext(emptyOpenRouterGateway()))

    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(1))

    resolveProviders({ providers: [makeOAuthProvider('shared')] })
    await Promise.all([first, second])

    expect($desktopOnboarding.get().providers?.map(p => p.id)).toEqual(['shared'])
  })
})

describe('OAuth onboarding', () => {
  beforeEach(() => {
    window.localStorage.clear()
    $desktopOnboarding.set(baseState())
  })

  afterEach(() => {
    cancelOnboardingFlow()
    window.localStorage.clear()
    $desktopOnboarding.set(baseState())
    vi.restoreAllMocks()
  })

  it('clears stale readiness errors after OAuth succeeds and completes onboarding directly', async () => {
    const model = 'anthropic/claude-opus-4.8'
    const calls: { body?: unknown; path: string }[] = []

    installApiMock(async ({ body, path }: { body?: unknown; path: string }) => {
      calls.push({ body, path })

      if (path === '/api/providers/oauth/work4you/submit') {
        return { ok: true, status: 'approved' }
      }

      if (path.startsWith('/api/model/options')) {
        return {
          providers: [
            {
              name: 'Work4You Portal',
              slug: 'work4you',
              models: [model]
            }
          ]
        }
      }

      if (path.startsWith('/api/model/recommended-default?')) {
        return { provider: 'work4you', model, free_tier: false }
      }

      if (path === '/api/model/set') {
        return { ok: true, provider: 'work4you', model, gateway_tools: [] }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    const requestGateway: OnboardingContext['requestGateway'] = async (method, params) => {
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

    $desktopOnboarding.set(
      baseState({
        flow: {
          status: 'awaiting_user',
          provider: makeOAuthProvider('work4you', 'Work4You Portal'),
          start: {
            auth_url: 'https://portal.example/auth',
            expires_in: 600,
            flow: 'pkce',
            session_id: 'portal-session'
          },
          code: 'fresh-code'
        },
        reason:
          'No access token found for Work4You Portal login. setup.status reports configured credentials, but runtime resolution still failed.',
        requested: true
      })
    )

    await submitOnboardingCode(onboardingContext(requestGateway))

    const state = $desktopOnboarding.get()
    expect(state.reason).toBeNull()
    // No confirm-model stop: connect lands straight in the app with the
    // recommended default already persisted via /api/model/set.
    expect(state.flow.status).toBe('idle')
    expect(state.configured).toBe(true)

    expect(calls.some(c => c.path === '/api/model/set')).toBe(true)

    const optionsIndex = calls.findIndex(c => c.path.startsWith('/api/model/options'))
    const recommendedIndex = calls.findIndex(c => c.path.startsWith('/api/model/recommended-default'))
    const setIndex = calls.findIndex(c => c.path === '/api/model/set')

    expect(optionsIndex).toBeGreaterThanOrEqual(0)
    expect(recommendedIndex).toBeGreaterThan(optionsIndex)
    expect(setIndex).toBeGreaterThan(recommendedIndex)
  })

  it('does not advance when the default model assignment is not persisted', async () => {
    const model = 'openai/gpt-5.5-pro'
    installApiMock(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth/work4you/submit') {
        return { ok: true, status: 'approved' }
      }

      if (path.startsWith('/api/model/options')) {
        return { providers: [{ name: 'Work4You Portal', slug: 'work4you', models: [model] }] }
      }

      if (path.startsWith('/api/model/recommended-default?')) {
        return { provider: 'work4you', model, free_tier: false }
      }

      if (path === '/api/model/set') {
        return {
          ok: false,
          provider: 'work4you',
          model,
          confirm_required: true,
          confirm_message: 'Confirm this expensive model.'
        }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    const requestGatewayMock = vi.fn(async (method: string) => {
      if (method === 'reload.env') {
        return {}
      }

      throw new Error(`unexpected gateway method: ${method}`)
    })

    const requestGateway = requestGatewayMock as OnboardingContext['requestGateway']
    $desktopOnboarding.set(
      baseState({
        flow: {
          status: 'awaiting_user',
          provider: makeOAuthProvider('work4you', 'Work4You Portal'),
          start: {
            auth_url: 'https://portal.example/auth',
            expires_in: 600,
            flow: 'pkce',
            session_id: 'portal-session'
          },
          code: 'fresh-code'
        },
        requested: true
      })
    )

    await submitOnboardingCode(onboardingContext(requestGateway))

    const state = $desktopOnboarding.get()
    expect(state.flow.status).toBe('error')
    expect(state.flow.status === 'error' ? state.flow.message : '').toContain('Confirm this expensive model.')
    expect(requestGatewayMock).not.toHaveBeenCalledWith('setup.runtime_check', expect.anything())
  })

  it('does not mint a second device code while a poll is in flight', async () => {
    const startCalls: string[] = []
    installApiMock(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth/work4you/start') {
        startCalls.push(path)
        return {
          expires_in: 600,
          flow: 'device_code',
          poll_interval: 5,
          session_id: 'device-session',
          user_code: '5X63-ZPDL',
          verification_url: 'https://portal.work4you.ai/device?user_code=5X63-ZPDL'
        }
      }

      if (path.includes('/poll/')) {
        return { status: 'pending' }
      }

      throw new Error(`unexpected api path: ${path}`)
    })
    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: {
        ...window.work4youDesktop,
        openExternal: vi.fn(async () => undefined)
      }
    })

    const provider = { ...makeOAuthProvider('work4you', 'Work4You Portal'), flow: 'device_code' as const }
    const ctx = onboardingContext(async () => {
      throw new Error('unexpected gateway method')
    })

    await startProviderOAuth(provider, ctx)
    await startProviderOAuth(provider, ctx)

    expect(startCalls).toHaveLength(1)
    expect($desktopOnboarding.get().flow.status).toBe('polling')
    expect(isOnboardingFlowInFlight($desktopOnboarding.get().flow)).toBe(true)
    cancelOnboardingFlow()
  })

  it('does not mint a second device code while the first start is still resolving', async () => {
    let releaseStart: ((value: unknown) => void) | undefined
    const started = new Promise(resolve => {
      releaseStart = resolve
    })
    const startCalls: string[] = []

    installApiMock(async ({ path }: { path: string }) => {
      if (path === '/api/providers/oauth/work4you/start') {
        startCalls.push(path)
        await started
        return {
          expires_in: 600,
          flow: 'device_code',
          poll_interval: 5,
          session_id: 'device-session',
          user_code: 'ABCD-EFGH',
          verification_url: 'https://portal.work4you.ai/device?user_code=ABCD-EFGH'
        }
      }

      if (path.includes('/poll/')) {
        return { status: 'pending' }
      }

      throw new Error(`unexpected api path: ${path}`)
    })
    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: {
        ...window.work4youDesktop,
        openExternal: vi.fn(async () => undefined)
      }
    })

    const provider = { ...makeOAuthProvider('work4you', 'Work4You Portal'), flow: 'device_code' as const }
    const ctx = onboardingContext(async () => {
      throw new Error('unexpected gateway method')
    })

    const first = startProviderOAuth(provider, ctx)
    const second = startProviderOAuth(provider, ctx)
    releaseStart?.(undefined)
    await Promise.all([first, second])

    expect(startCalls).toHaveLength(1)
    expect($desktopOnboarding.get().flow.status).toBe('polling')
    cancelOnboardingFlow()
  })

  it('resets a device-code flow even when the desktop bridge is missing', () => {
    Reflect.deleteProperty(window, 'work4youDesktop')
    $desktopOnboarding.set(
      baseState({
        flow: {
          copied: false,
          provider: { ...makeOAuthProvider('work4you', 'Work4You Portal'), flow: 'device_code' },
          start: {
            expires_in: 600,
            flow: 'device_code',
            poll_interval: 5,
            session_id: 'device-session',
            user_code: '5X63-ZPDL',
            verification_url: 'https://portal.work4you.ai/device?user_code=5X63-ZPDL'
          },
          status: 'polling'
        }
      })
    )

    expect(() => cancelOnboardingFlow()).not.toThrow()
    expect($desktopOnboarding.get().flow.status).toBe('idle')
  })
})

describe('saveOnboardingLocalEndpoint', () => {
  beforeEach(() => {
    window.localStorage.clear()
    $desktopOnboarding.set(baseState())
  })

  afterEach(() => {
    window.localStorage.clear()
    $desktopOnboarding.set(baseState())
    vi.restoreAllMocks()
  })

  function readyGateway(): OnboardingContext['requestGateway'] {
    return async method => {
      if (method === 'reload.env') {
        return {} as never
      }

      if (method === 'setup.status') {
        return { provider_configured: true } as never
      }

      if (method === 'setup.runtime_check') {
        return { ok: true } as never
      }

      throw new Error(`unexpected gateway method: ${method}`)
    }
  }

  it('errors when the endpoint advertises no models (nothing to route to)', async () => {
    const calls: string[] = []
    installApiMock(async ({ path }: { path: string }) => {
      calls.push(path)

      if (path === '/api/providers/validate') {
        return { ok: true, reachable: true, message: '', models: [] }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    const result = await saveOnboardingLocalEndpoint('http://127.0.0.1:8000/v1', '', {
      requestGateway: readyGateway()
    })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('no models')
    // Must not attempt to persist an assignment without a model.
    expect(calls).not.toContain('/api/model/set')
  })

  it('auto-discovers the model and persists provider=custom + base_url, then finishes', async () => {
    const calls: { body?: unknown; path: string }[] = []

    const api = vi.fn(async ({ body, path }: { body?: unknown; path: string }) => {
      calls.push({ body, path })

      if (path === '/api/providers/validate') {
        return { ok: true, reachable: true, message: '', models: ['llama-3.1-8b', 'qwen2.5-7b'] }
      }

      if (path === '/api/model/set') {
        return { ok: true, provider: 'custom', model: 'llama-3.1-8b', base_url: 'http://127.0.0.1:8000/v1' }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    installApiMock(api)
    const onCompleted = vi.fn()

    const result = await saveOnboardingLocalEndpoint('http://127.0.0.1:8000/v1', '', {
      onCompleted,
      requestGateway: readyGateway()
    })

    expect(result.ok).toBe(true)

    const assign = calls.find(c => c.path === '/api/model/set')
    expect(assign?.body).toMatchObject({
      scope: 'main',
      provider: 'custom',
      model: 'llama-3.1-8b',
      base_url: 'http://127.0.0.1:8000/v1'
    })

    expect(onCompleted).toHaveBeenCalledTimes(1)
    expect($desktopOnboarding.get().configured).toBe(true)
  })

  it('forwards the API key to the probe and persists it for auth-gated endpoints', async () => {
    const calls: { body?: unknown; path: string }[] = []

    const api = vi.fn(async ({ body, path }: { body?: unknown; path: string }) => {
      calls.push({ body, path })

      if (path === '/api/providers/validate') {
        return { ok: true, reachable: true, message: '', models: ['gpt-oss-120b'] }
      }

      if (path === '/api/model/set') {
        return { ok: true, provider: 'custom', model: 'gpt-oss-120b', base_url: 'https://text.example.com/v1' }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    installApiMock(api)

    const result = await saveOnboardingLocalEndpoint('https://text.example.com/v1', 'sk-secret', {
      requestGateway: readyGateway()
    })

    expect(result.ok).toBe(true)

    // The probe must receive the key so an auth-gated /v1/models enumerates.
    const probe = calls.find(c => c.path === '/api/providers/validate')
    expect(probe?.body).toMatchObject({
      key: 'OPENAI_BASE_URL',
      value: 'https://text.example.com/v1',
      api_key: 'sk-secret'
    })

    // And the key must be persisted alongside the endpoint for runtime auth.
    const assign = calls.find(c => c.path === '/api/model/set')
    expect(assign?.body).toMatchObject({
      scope: 'main',
      provider: 'custom',
      model: 'gpt-oss-120b',
      base_url: 'https://text.example.com/v1',
      api_key: 'sk-secret'
    })
  })

  it('reports the runtime reason when resolution still fails after saving', async () => {
    installApiMock(async ({ path }: { path: string }) => {
      if (path === '/api/providers/validate') {
        return { ok: true, reachable: true, message: '', models: ['llama-3.1-8b'] }
      }

      if (path === '/api/model/set') {
        return { ok: true }
      }

      throw new Error(`unexpected api path: ${path}`)
    })

    const failingGateway: OnboardingContext['requestGateway'] = async method => {
      if (method === 'reload.env') {
        return {} as never
      }

      if (method === 'setup.status') {
        return { provider_configured: false } as never
      }

      if (method === 'setup.runtime_check') {
        return { ok: false, error: 'No provider can serve the selected model.' } as never
      }

      throw new Error(`unexpected gateway method: ${method}`)
    }

    const result = await saveOnboardingLocalEndpoint('http://127.0.0.1:8000/v1', '', {
      requestGateway: failingGateway
    })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('No provider can serve the selected model.')
    expect($desktopOnboarding.get().configured).not.toBe(true)
  })
})
