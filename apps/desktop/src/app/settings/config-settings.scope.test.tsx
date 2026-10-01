import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $activeGatewayProfile } from '@/store/profile'
import { $settingsScopeOverride, setSettingsScope } from '@/store/settings-scope'

const getWork4YouConfigRecord = vi.fn()
const getWork4YouConfigSchema = vi.fn()
const getElevenLabsVoices = vi.fn()
const saveWork4YouConfig = vi.fn()
const getGlobalModelOptions = vi.fn()
const getEnvVars = vi.fn()

vi.mock('@/work4you', () => ({
  getWork4YouConfigRecord: (...args: unknown[]) => getWork4YouConfigRecord(...args),
  getWork4YouConfigSchema: (...args: unknown[]) => getWork4YouConfigSchema(...args),
  getElevenLabsVoices: (...args: unknown[]) => getElevenLabsVoices(...args),
  saveWork4YouConfig: (...args: unknown[]) => saveWork4YouConfig(...args),
  getGlobalModelOptions: (...args: unknown[]) => getGlobalModelOptions(...args),
  getEnvVars: (...args: unknown[]) => getEnvVars(...args),
  setEnvVar: vi.fn(),
  deleteEnvVar: vi.fn(),
  revealEnvVar: vi.fn(),
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  getApiRequestProfile: () => 'default',
  setApiRequestProfile: () => undefined,
  // The config cache key folds the concrete scope in (use-config-record.ts).
  profileScopeKey: (scope?: null | string) => scope ?? 'default'
}))

// Settings pages carry the CONCRETE profile they edit on every request. The
// shared scope store's raw override is `null` while it follows the app's
// active profile, and `profileScoped(null)` omits `?profile=` — which the
// Electron router sends to the primary backend's launch home, not to the
// profile the sidebar rail selected. These tests pin the contract that the
// pages never forward that `null`.
beforeEach(() => {
  $activeGatewayProfile.set('default')
  $settingsScopeOverride.set(null)
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
  saveWork4YouConfig.mockResolvedValue({ ok: true })
  getGlobalModelOptions.mockResolvedValue({ providers: [] })
  getEnvVars.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  $settingsScopeOverride.set(null)
  $activeGatewayProfile.set('default')
})

async function renderSection(activeSectionId: string) {
  const { ConfigSettings } = await import('./config-settings')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConfigSettings activeSectionId={activeSectionId} />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ConfigSettings profile scope', () => {
  it('reads config, schema, catalog, and keys for the active profile, never the primary one', async () => {
    $activeGatewayProfile.set('coder')

    await renderSection('model')

    await waitFor(() => expect(getGlobalModelOptions).toHaveBeenCalledWith(undefined, 'coder'))
    expect(getWork4YouConfigRecord).toHaveBeenCalledWith('coder')
    expect(getWork4YouConfigSchema).toHaveBeenCalledWith('coder')
    expect(getEnvVars).toHaveBeenCalledWith('coder')

    for (const call of [getWork4YouConfigRecord, getWork4YouConfigSchema, getGlobalModelOptions, getEnvVars]) {
      expect(call).not.toHaveBeenCalledWith(expect.anything(), null)
      expect(call).not.toHaveBeenCalledWith(null)
      expect(call).not.toHaveBeenCalledWith(undefined)
    }
  })

  it('saves an edit into the active profile', async () => {
    $activeGatewayProfile.set('coder')

    await renderSection('chat')

    // Schema switches render before the device-level Chat rows, so the first
    // switch is `display.show_reasoning`.
    const [toggle] = await screen.findAllByRole('switch')
    fireEvent.click(toggle)

    await waitFor(() =>
      expect(saveWork4YouConfig).toHaveBeenCalledWith(
        expect.objectContaining({ display: expect.objectContaining({ show_reasoning: false }) }),
        'coder'
      )
    )
  })

  it('follows an explicit scope override onto another profile', async () => {
    setSettingsScope('research')

    await renderSection('model')

    await waitFor(() => expect(getGlobalModelOptions).toHaveBeenCalledWith(undefined, 'research'))
    expect(getWork4YouConfigRecord).toHaveBeenCalledWith('research')
    expect(getEnvVars).toHaveBeenCalledWith('research')
    expect(getWork4YouConfigRecord).not.toHaveBeenCalledWith('default')
  })

  it('remounts the page when the scope changes so no draft crosses profiles', async () => {
    await renderSection('chat')

    expect(await screen.findByText('Reasoning Blocks')).toBeTruthy()
    expect(getWork4YouConfigRecord).toHaveBeenCalledWith('default')

    setSettingsScope('research')

    await waitFor(() => expect(getWork4YouConfigRecord).toHaveBeenCalledWith('research'))
    await waitFor(() => expect(getWork4YouConfigSchema).toHaveBeenCalledWith('research'))
    expect(saveWork4YouConfig).not.toHaveBeenCalled()
  })
})
