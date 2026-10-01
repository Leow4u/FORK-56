import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $visibleModels, modelVisibilityKey } from '@/store/model-visibility'
import type { EnvVarInfo } from '@/types/work4you'

const getGlobalModelOptions = vi.fn()
const getEnvVars = vi.fn()
const setEnvVar = vi.fn()

vi.mock('@/work4you', () => ({
  getGlobalModelOptions: (...args: unknown[]) => getGlobalModelOptions(...args),
  getEnvVars: () => getEnvVars(),
  setEnvVar: (...args: unknown[]) => setEnvVar(...args),
  deleteEnvVar: vi.fn(),
  revealEnvVar: vi.fn(),
  getApiRequestProfile: () => 'default',
  setApiRequestProfile: () => undefined
}))

function keyVar(patch: Partial<EnvVarInfo> = {}): EnvVarInfo {
  return {
    advanced: false,
    category: 'provider',
    description: 'Use your OpenAI key for OpenAI models.',
    is_password: true,
    is_set: false,
    provider: 'openai',
    provider_label: 'OpenAI',
    redacted_value: null,
    tools: [],
    url: '',
    ...patch
  }
}

beforeEach(() => {
  $visibleModels.set(null)
  getGlobalModelOptions.mockResolvedValue({
    providers: [
      {
        authenticated: true,
        featured_models: ['operis-5'],
        models: ['operis-5', 'claude-opus-4.8'],
        name: 'Work4You Portal',
        slug: 'work4you'
      }
    ]
  })
  getEnvVars.mockResolvedValue({
    OPENAI_API_KEY: keyVar()
  })
})

afterEach(() => {
  cleanup()
  $visibleModels.set(null)
  vi.clearAllMocks()
})

async function renderModelSettings() {
  const { ModelSettings } = await import('./model-settings')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <ModelSettings />
    </QueryClientProvider>
  )
}

describe('ModelSettings', () => {
  it('lists the featured catalog and hides the profile model controls', async () => {
    await renderModelSettings()

    expect(await screen.findByRole('switch', { name: 'Operis 5' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Claude Opus 4.8' })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
    expect(screen.queryByText('Reasoning')).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Fast' })).toBeNull()
    expect(screen.queryByText('Auxiliary models')).toBeNull()
    expect(screen.getByRole('button', { name: 'View all models' })).toBeTruthy()
    expect(await screen.findByText('OpenAI')).toBeTruthy()
  })

  it('reveals the rest of the catalog and toggles what the picker shows', async () => {
    await renderModelSettings()

    fireEvent.click(await screen.findByRole('button', { name: 'View all models' }))
    const hidden = await screen.findByRole('switch', { name: 'Claude Opus 4.8' })
    expect(hidden.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(await screen.findByRole('switch', { name: 'Operis 5' }))

    await waitFor(() => {
      const keys = $visibleModels.get()
      expect(keys?.has(modelVisibilityKey('work4you', 'operis-5'))).toBe(false)
    })
  })

  it('searches models that are outside the featured shortlist', async () => {
    await renderModelSettings()

    fireEvent.change(await screen.findByRole('textbox', { name: 'Add or search model' }), {
      target: { value: 'opus' }
    })

    expect(await screen.findByRole('switch', { name: 'Claude Opus 4.8' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Operis 5' })).toBeNull()
  })
})
