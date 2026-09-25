import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/work4you', () => ({
  getWork4YouConfigRecord: vi.fn(async () => ({})),
  getWork4YouConfigSchema: vi.fn(async () => ({ fields: {} })),
  getElevenLabsVoices: vi.fn(async () => ({ available: false, voices: [] })),
  saveWork4YouConfig: vi.fn(async () => ({ ok: true })),
  getApiRequestProfile: () => null,
  setApiRequestProfile: () => undefined,
  getToolsets: vi.fn(async () => [])
}))

import { $profiles } from '@/store/profile'
import type { ProfileInfo } from '@/types/work4you'

import { SettingsView } from './index'

const profile = (name: string, isDefault = false) =>
  ({ has_env: false, is_default: isDefault, model: null, name }) as unknown as ProfileInfo

afterEach(cleanup)

describe('Settings chrome', () => {
  it('keeps search and drops the config import, export, and reset footer', async () => {
    $profiles.set([profile('default', true), profile('coder')])
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <MemoryRouter initialEntries={['/settings?tab=keybinds']}>
        <QueryClientProvider client={client}>
          <SettingsView onClose={() => undefined} />
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('button', { name: 'Reset all' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Search/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Export config' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Import config' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset to defaults' })).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Chat' })[0])
    expect(screen.queryByText('Editing profile')).toBeNull()
  })
})
