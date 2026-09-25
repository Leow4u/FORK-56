import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { $profiles } from '@/store/profile'
import { $reasoningCollapsedByDefault } from '@/store/reasoning-disclosure'
import type { ProfileInfo } from '@/types/work4you'

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

afterEach(() => {
  cleanup()
  $reasoningCollapsedByDefault.set(false)
  delete window.work4youDesktop
})

async function renderChat() {
  getWork4YouConfigRecord.mockResolvedValue({
    display: { personality: 'default', show_reasoning: true },
    timezone: 'UTC',
    agent: { image_input_mode: 'text' }
  })
  getWork4YouConfigSchema.mockResolvedValue({
    fields: {
      'display.personality': { type: 'select', options: ['default', 'concise'] },
      'display.show_reasoning': { type: 'boolean' },
      timezone: { type: 'string', searchable: true, options: ['UTC'] },
      'agent.image_input_mode': { type: 'select', options: ['auto', 'native', 'text'] }
    }
  })
  getElevenLabsVoices.mockResolvedValue({ available: false, voices: [] })

  const { ConfigSettings } = await import('./config-settings')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConfigSettings activeSectionId="chat" />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Chat settings', () => {
  it('shows personality, reasoning blocks, collapse thinking, and auto-archive', async () => {
    window.work4youDesktop = {} as Window['work4youDesktop']
    $profiles.set([
      { has_env: false, is_default: true, model: null, name: 'default' } as unknown as ProfileInfo,
      { has_env: false, is_default: false, model: null, name: 'coder' } as unknown as ProfileInfo
    ])
    await renderChat()

    expect(await screen.findByText('Personality')).toBeTruthy()
    expect(screen.getByText('Reasoning Blocks')).toBeTruthy()
    expect(screen.getByText('Collapse thinking by default')).toBeTruthy()
    expect(screen.getByText('Auto-archive stale chats')).toBeTruthy()
    expect(screen.queryByText('Timezone')).toBeNull()
    expect(screen.queryByText('Image Attachments')).toBeNull()
    expect(screen.queryByText('Max preview / image load size')).toBeNull()
    expect(screen.queryByText('Default project directory')).toBeNull()
    expect(screen.queryByText('Nothing archived')).toBeNull()
    expect(screen.queryByText('Editing profile')).toBeNull()
  })

  it('persists collapse thinking from the chat page', async () => {
    await renderChat()

    const toggle = await screen.findByRole('switch', { name: 'Collapse thinking by default' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)

    await waitFor(() => expect($reasoningCollapsedByDefault.get()).toBe(true))
  })
})
