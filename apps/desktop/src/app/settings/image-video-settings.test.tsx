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
  getToolsetModels: (name: string, provider?: string, profile?: null | string) =>
    getToolsetModels(name, provider, profile),
  selectToolsetModel: (name: string, model: string, provider?: string, profile?: null | string) =>
    selectToolsetModel(name, model, provider, profile),
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
        models: [{ id: 'veo3.1', display: 'Veo 3.1', speed: 'fast', strengths: '', price: '' }],
        current: 'veo3.1',
        default: 'veo3.1'
      }
    }

    return {
      name: 'image_gen',
      has_models: true,
      provider: 'Work4You Subscription',
      plugin: 'fal',
      models: [
        {
          id: 'fal-ai/flux-2-pro',
          display: 'FLUX 2 Pro',
          speed: '~6s',
          strengths: 'Studio photorealism',
          price: '$0.03/MP'
        },
        {
          id: 'fal-ai/nano-banana-2',
          display: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
          speed: '~3s',
          strengths: 'Fast reasoning',
          price: ''
        }
      ],
      current: 'fal-ai/nano-banana-2',
      default: 'fal-ai/nano-banana-2'
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
  it('lists image and video models without a power switch or subscription chrome', async () => {
    const { ImageVideoSettings } = await import('./image-video-settings')
    const view = render(<ImageVideoSettings />)

    expect(await screen.findByRole('heading', { name: 'Image & Video' })).toBeTruthy()
    expect(screen.getByText('Choose the image model and the video model.')).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByText('Web Search')).toBeNull()
    expect(getToolsetConfig).not.toHaveBeenCalled()
    expect(setToolsetEnabled).not.toHaveBeenCalled()

    expect(await screen.findByRole('radio', { name: /Nano Banana 2/ })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Veo 3.1/ })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: /FLUX 2 Pro/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Show 1 more model/ })).toBeTruthy()
    expect(view.container.querySelector('[data-brand="gemini"]')).toBeTruthy()
    expect(view.container.querySelector('[data-brand="deepmind"]')).toBeTruthy()
    expect(screen.queryByText('N2')).toBeNull()
    expect(screen.queryByText('F2')).toBeNull()
    expect(screen.queryByText('V3')).toBeNull()
    expect(screen.getAllByText('In use').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('Work4You Subscription')).toBeNull()
    expect(screen.queryByText('No API key required.')).toBeNull()
    expect(screen.queryByText('This is your active backend')).toBeNull()
    expect(screen.queryByText('Managed FAL image generation billed to your subscription')).toBeNull()
    expect(screen.queryByText('FAL.ai')).toBeNull()
    expect(screen.queryByText('DeepInfra')).toBeNull()
    expect(screen.queryByText('OpenAI')).toBeNull()
  })

  it('expands and collapses the other models', async () => {
    const { ImageVideoSettings } = await import('./image-video-settings')
    render(<ImageVideoSettings />)

    fireEvent.click(await screen.findByRole('button', { name: /Show 1 more model/ }))
    expect(await screen.findByRole('radio', { name: /FLUX 2 Pro/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.queryByRole('radio', { name: /FLUX 2 Pro/ })).toBeNull()
    expect(screen.getByRole('radio', { name: /Nano Banana 2/ })).toBeTruthy()
  })

  it('selects a model through the existing toolset model API', async () => {
    const { ImageVideoSettings } = await import('./image-video-settings')
    render(<ImageVideoSettings />)

    fireEvent.click(await screen.findByRole('button', { name: /Show 1 more model/ }))
    fireEvent.click(await screen.findByRole('radio', { name: /FLUX 2 Pro/ }))

    await waitFor(() =>
      expect(selectToolsetModel).toHaveBeenCalledWith(
        'image_gen',
        'fal-ai/flux-2-pro',
        'Work4You Subscription',
        null
      )
    )
  })

  it('turns a disabled image or video toolset back on', async () => {
    getToolsets.mockResolvedValueOnce([
      toolset({ enabled: false }),
      toolset({
        name: 'video_gen',
        label: 'Video Generation',
        description: 'video_generate',
        tools: ['video_generate']
      })
    ])

    const { ImageVideoSettings } = await import('./image-video-settings')
    render(<ImageVideoSettings />)

    await waitFor(() => expect(setToolsetEnabled).toHaveBeenCalledWith('image_gen', true, null))
    expect(screen.queryByRole('switch')).toBeNull()
    expect(await screen.findByRole('radio', { name: /Nano Banana 2/ })).toBeTruthy()
  })

  it('shows the model list loading line instead of provider setup', async () => {
    getToolsetModels.mockImplementation(() => new Promise(() => {}))

    const { ImageVideoSettings } = await import('./image-video-settings')
    render(<ImageVideoSettings />)

    expect(await screen.findByText('Image Generation')).toBeTruthy()
    expect(screen.getAllByText('Loading model catalog...').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByText('Loading configuration')).toBeNull()
    expect(screen.queryByText('Work4You Subscription')).toBeNull()
  })
})
