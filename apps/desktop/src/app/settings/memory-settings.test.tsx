import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getWork4YouConfigRecord = vi.fn()
const getWork4YouConfigSchema = vi.fn()
const getElevenLabsVoices = vi.fn()
const saveWork4YouConfig = vi.fn()

vi.mock('@/work4you', () => ({
  getWork4YouConfigRecord: () => getWork4YouConfigRecord(),
  getWork4YouConfigSchema: () => getWork4YouConfigSchema(),
  getElevenLabsVoices: () => getElevenLabsVoices(),
  saveWork4YouConfig: (config: unknown) => saveWork4YouConfig(config),
  getApiRequestProfile: () => 'default',
  setApiRequestProfile: () => {}
}))

const schema = {
  fields: {
    'memory.memory_enabled': { type: 'boolean' },
    'memory.user_profile_enabled': { type: 'boolean' },
    'memory.memory_char_limit': { type: 'number' },
    'memory.user_char_limit': { type: 'number' },
    'memory.provider': { type: 'select', options: ['', 'honcho'] },
    'context.engine': { type: 'select', options: ['compressor'] },
    'compression.enabled': { type: 'boolean' },
    'compression.threshold': { type: 'number' },
    'compression.target_ratio': { type: 'number' },
    'compression.protect_last_n': { type: 'number' }
  }
}

const config = {
  memory: {
    memory_enabled: true,
    user_profile_enabled: true,
    memory_char_limit: 2200,
    user_char_limit: 500,
    provider: 'honcho'
  },
  context: { engine: 'compressor' },
  compression: { enabled: true, threshold: 0.8, target_ratio: 0.2, protect_last_n: 20 }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderMemory() {
  getWork4YouConfigRecord.mockResolvedValue(config)
  getWork4YouConfigSchema.mockResolvedValue(schema)
  getElevenLabsVoices.mockResolvedValue({ available: false, voices: [] })
  saveWork4YouConfig.mockResolvedValue({ ok: true })

  const { ConfigSettings } = await import('./config-settings')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConfigSettings activeSectionId="memory" importInputRef={{ current: null }} />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Memory settings', () => {
  it('shows persistent memory and the user profile, and hides engine knobs', async () => {
    await renderMemory()

    expect(await screen.findByText('Persistent Memory')).toBeTruthy()
    expect(screen.getByText('User Profile')).toBeTruthy()
    expect(screen.queryByText('Memory Budget')).toBeNull()
    expect(screen.queryByText('Profile Budget')).toBeNull()
    expect(screen.queryByText('Memory Provider')).toBeNull()
    expect(screen.queryByText('Context Engine')).toBeNull()
    expect(screen.queryByText('Auto-Compression')).toBeNull()
    expect(screen.queryByText('Compression Threshold')).toBeNull()
    expect(screen.queryByText('Compression Target')).toBeNull()
    expect(screen.queryByText('Protected Recent Messages')).toBeNull()
  })

  it('saves a user profile toggle without rewriting the hidden knobs', async () => {
    await renderMemory()

    const toggle = await screen.findByRole('switch', { name: 'User Profile' })
    fireEvent.click(toggle)

    await waitFor(() =>
      expect(saveWork4YouConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: expect.objectContaining({
            memory_enabled: true,
            user_profile_enabled: false,
            provider: 'honcho',
            memory_char_limit: 2200
          })
        })
      )
    )
  })
})
