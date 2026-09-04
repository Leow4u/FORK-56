import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import type * as ReactRouterDom from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ToolProvider, ToolsetConfig, ToolsetInfo } from '@/types/work4you'

const navigateSpy = vi.fn()

vi.mock('react-router', async importOriginal => ({
  ...(await importOriginal<typeof ReactRouterDom>()),
  useNavigate: () => navigateSpy
}))

const render = (ui: ReactElement) =>
  rtlRender(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {ui}
      </QueryClientProvider>
    </MemoryRouter>
  )

const getToolsets = vi.fn()
const setToolsetEnabled = vi.fn()
const getToolsetConfig = vi.fn()
const getToolsetModels = vi.fn()
const selectToolsetModel = vi.fn()
const selectToolsetProvider = vi.fn()
const setEnvVar = vi.fn()
const deleteEnvVar = vi.fn()
const revealEnvVar = vi.fn()
const runToolsetPostSetup = vi.fn()
const getActionStatus = vi.fn()
const startOAuthLogin = vi.fn()
const pollOAuthSession = vi.fn()
const getWork4YouConfigRecord = vi.fn()
const getWork4YouConfigSchema = vi.fn()
const saveWork4YouConfig = vi.fn()
const getElevenLabsVoices = vi.fn()

vi.mock('@/work4you', () => ({
  getToolsets: (profile?: null | string) => getToolsets(profile),
  setToolsetEnabled: (name: string, enabled: boolean, profile?: null | string) =>
    setToolsetEnabled(name, enabled, profile),
  getToolsetConfig: (name: string) => getToolsetConfig(name),
  getToolsetModels: (name: string, provider?: string) => getToolsetModels(name, provider),
  selectToolsetModel: (name: string, model: string, provider?: string) => selectToolsetModel(name, model, provider),
  selectToolsetProvider: (name: string, provider: string) => selectToolsetProvider(name, provider),
  setEnvVar: (key: string, value: string) => setEnvVar(key, value),
  deleteEnvVar: (key: string) => deleteEnvVar(key),
  revealEnvVar: (key: string) => revealEnvVar(key),
  runToolsetPostSetup: (name: string, key: string) => runToolsetPostSetup(name, key),
  getActionStatus: (name: string, lines?: number) => getActionStatus(name, lines),
  startOAuthLogin: (providerId: string) => startOAuthLogin(providerId),
  pollOAuthSession: (providerId: string, sessionId: string) => pollOAuthSession(providerId, sessionId),
  getWork4YouConfigRecord: () => getWork4YouConfigRecord(),
  getWork4YouConfigSchema: () => getWork4YouConfigSchema(),
  saveWork4YouConfig: (config: unknown) => saveWork4YouConfig(config),
  getElevenLabsVoices: () => getElevenLabsVoices(),
  setApiRequestProfile: () => undefined,
  getApiRequestProfile: () => null
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('@/store/activity', () => ({
  upsertDesktopActionTask: vi.fn()
}))

function provider(name: string, overrides: Partial<ToolProvider> = {}): ToolProvider {
  return {
    name,
    badge: 'paid',
    tag: '',
    env_vars: [],
    post_setup: null,
    requires_work4you_auth: false,
    is_active: false,
    ...overrides
  }
}

function toolsetConfig(name: string, providers: ToolProvider[]): ToolsetConfig {
  return {
    name,
    has_category: true,
    active_provider: 'Work4You Subscription',
    providers
  }
}

function toolset(overrides: Partial<ToolsetInfo> = {}): ToolsetInfo {
  return {
    name: 'image_gen',
    label: 'Image Generation',
    description: 'image_generate',
    enabled: true,
    configured: true,
    tools: ['image_generate'],
    ...overrides
  }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )

  getToolsets.mockResolvedValue([
    toolset(),
    toolset({
      name: 'video_gen',
      label: 'Video Generation',
      description: 'video_generate',
      tools: ['video_generate']
    }),
    toolset({ name: 'web', label: 'Web Search', tools: ['web_search'] })
  ])
  setToolsetEnabled.mockResolvedValue({ ok: true, name: 'image_gen', enabled: false })
  getToolsetConfig.mockImplementation(async (name: string) => {
    if (name === 'video_gen') {
      return toolsetConfig('video_gen', [
        provider('Work4You Subscription', {
          badge: 'subscription',
          requires_work4you_auth: true,
          is_active: true
        }),
        provider('DeepInfra'),
        provider('FAL'),
        provider('xAI Grok Imagine')
      ])
    }

    return toolsetConfig('image_gen', [
      provider('Work4You Subscription', {
        badge: 'subscription',
        requires_work4you_auth: true,
        is_active: true
      }),
      provider('FAL.ai'),
      provider('DeepInfra'),
      provider('Work4You Portal (image)', { badge: 'subscription', requires_work4you_auth: true }),
      provider('OpenAI')
    ])
  })
  getToolsetModels.mockImplementation(async (name: string) => {
    if (name === 'video_gen') {
      return {
        name: 'video_gen',
        has_models: true,
        provider: 'Work4You Subscription',
        plugin: 'fal',
        models: [{ id: 'pixverse-v6', display: 'Pixverse v6', speed: 'fast', strengths: '', price: '' }],
        current: 'pixverse-v6',
        default: 'pixverse-v6'
      }
    }

    return {
      name: 'image_gen',
      has_models: true,
      provider: 'Work4You Subscription',
      plugin: 'fal',
      models: [{ id: 'z-image-turbo', display: 'Z-Image Turbo', speed: 'fast', strengths: '', price: '' }],
      current: 'z-image-turbo',
      default: 'z-image-turbo'
    }
  })
  getWork4YouConfigRecord.mockResolvedValue({})
  getWork4YouConfigSchema.mockResolvedValue({ fields: {}, category_order: [] })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('ImageVideoSettings', () => {
  it('hosts Image and Video Generation with Subscription plus models, not BYOK', async () => {
    const { ImageVideoSettings } = await import('./image-video-settings')
    render(<ImageVideoSettings />)

    expect(await screen.findByRole('heading', { name: 'Image & Video' })).toBeTruthy()
    expect(await screen.findByRole('switch', { name: 'Image Generation' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Video Generation' })).toBeTruthy()
    expect(screen.queryByText('Web Search')).toBeNull()

    expect((await screen.findAllByRole('button', { name: /Work4You Subscription/ })).length).toBeGreaterThanOrEqual(2)
    expect(await screen.findByText('Z-Image Turbo')).toBeTruthy()
    expect(await screen.findByText('Pixverse v6')).toBeTruthy()
    expect(screen.queryByText('FAL.ai')).toBeNull()
    expect(screen.queryByText('DeepInfra')).toBeNull()
    expect(screen.queryByText('FAL')).toBeNull()
    expect(screen.queryByText('xAI Grok Imagine')).toBeNull()
    expect(screen.queryByText('Work4You Portal (image)')).toBeNull()
    expect(screen.queryByText('OpenAI')).toBeNull()
  })

  it('toggles Image Generation through setToolsetEnabled', async () => {
    const { ImageVideoSettings } = await import('./image-video-settings')
    render(<ImageVideoSettings />)

    const sw = await screen.findByRole('switch', { name: 'Image Generation' })
    expect(sw.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(sw)

    await waitFor(() => expect(setToolsetEnabled).toHaveBeenCalled())
    expect(setToolsetEnabled.mock.calls[0].slice(0, 2)).toEqual(['image_gen', false])
  })
})
