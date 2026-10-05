import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { $activityDensity } from '@/store/activity-density'
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
  setApiRequestProfile: () => {},
  // The profile chip refreshes the roster on mount; answer with the two
  // profiles the first test renders so the refresh cannot empty it.
  getProfiles: vi.fn(async () => ({
    profiles: [
      { has_env: false, is_default: true, model: null, name: 'default' },
      { has_env: false, is_default: false, model: null, name: 'coder' }
    ]
  })),
  // The config cache key folds the concrete settings scope in (use-config-record.ts).
  profileScopeKey: (scope?: null | string) => scope ?? 'default'
}))

afterEach(() => {
  cleanup()
  $activityDensity.set('balanced')
  $reasoningCollapsedByDefault.set(false)
  Reflect.deleteProperty(window, 'work4youDesktop')
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
  it('shows personality, reasoning blocks, activity detail, and auto-archive', async () => {
    window.work4youDesktop = {} as Window['work4youDesktop']
    $profiles.set([
      { has_env: false, is_default: true, model: null, name: 'default' } as unknown as ProfileInfo,
      { has_env: false, is_default: false, model: null, name: 'coder' } as unknown as ProfileInfo
    ])
    await renderChat()

    expect(await screen.findByText('Personality')).toBeTruthy()
    expect(screen.getByText('Show Reasoning')).toBeTruthy()
    expect(screen.getByText('Activity detail')).toBeTruthy()
    // A thought only has a block of its own to collapse in Detailed.
    expect(screen.queryByText('Collapse reasoning by default')).toBeNull()
    expect(screen.getByText('Auto-archive stale chats')).toBeTruthy()
    expect(screen.queryByText('Timezone')).toBeNull()
    expect(screen.queryByText('Image Attachments')).toBeNull()
    expect(screen.queryByText('Max preview / image load size')).toBeNull()
    expect(screen.queryByText('Default project directory')).toBeNull()
    expect(screen.queryByText('Nothing archived')).toBeNull()
    // Two profiles in the roster → the shared profile chip is back on the page.
    expect(screen.getByText('Configuring:')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Configuring:' })).toBeTruthy()
  })

  it('saves the activity detail level and offers collapse thinking only in Detailed', async () => {
    await renderChat()

    fireEvent.click(await screen.findByRole('button', { name: 'Compact' }))
    expect($activityDensity.get()).toBe('compact')
    expect(screen.queryByText('Collapse reasoning by default')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }))
    expect($activityDensity.get()).toBe('detailed')
    expect(await screen.findByText('Collapse reasoning by default')).toBeTruthy()
  })

  it('persists collapse thinking from the chat page', async () => {
    $activityDensity.set('detailed')
    await renderChat()

    const toggle = await screen.findByRole('switch', { name: 'Collapse reasoning by default' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)

    await waitFor(() => expect($reasoningCollapsedByDefault.get()).toBe(true))
  })
})
