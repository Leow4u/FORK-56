import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { displayModelName } from '@/lib/model-status-label'

// Radix Select calls scrollIntoView on its items when the content opens; jsdom
// doesn't implement it (nor hasPointerCapture / releasePointerCapture), so stub
// them to let the dropdown open in tests.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

const getGlobalModelInfo = vi.fn()
const getGlobalModelOptions = vi.fn()
const setModelAssignment = vi.fn()
const getWork4YouConfigRecord = vi.fn()
const saveWork4YouConfig = vi.fn()
let profileSwitchHandler: (() => void) | null = null

vi.mock('@/work4you', () => ({
  getGlobalModelInfo: () => getGlobalModelInfo(),
  getGlobalModelOptions: () => getGlobalModelOptions(),
  getApiRequestProfile: () => 'default',
  setModelAssignment: (body: unknown) => setModelAssignment(body),
  getWork4YouConfigRecord: () => getWork4YouConfigRecord(),
  saveWork4YouConfig: (config: unknown) => saveWork4YouConfig(config),
  setApiRequestProfile: () => {}
}))

vi.mock('../hooks/use-on-profile-switch', () => ({
  useOnProfileSwitch: (handler: () => void) => {
    profileSwitchHandler = handler
  }
}))

beforeEach(() => {
  getGlobalModelInfo.mockResolvedValue({ provider: 'work4you', model: 'work4you-4' })
  getGlobalModelOptions.mockResolvedValue({
    providers: [
      {
        name: 'Work4You',
        slug: 'work4you',
        models: ['work4you-4', 'work4you-4-mini'],
        authenticated: true,
        capabilities: { 'work4you-4': { reasoning: true, fast: true } }
      }
    ]
  })
  setModelAssignment.mockResolvedValue({ ok: true, provider: 'work4you', model: 'work4you-4', gateway_tools: [] })
  getWork4YouConfigRecord.mockResolvedValue({ agent: { reasoning_effort: 'medium', service_tier: 'normal' } })
  saveWork4YouConfig.mockResolvedValue({ ok: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  profileSwitchHandler = null
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
  it('lists the current provider models and hides provider, auxiliary, and mixture of agents', async () => {
    await renderModelSettings()

    await waitFor(() => expect(getGlobalModelInfo).toHaveBeenCalled())
    await waitFor(() => expect(getGlobalModelOptions).toHaveBeenCalled())

    const modelSelect = (await screen.findAllByRole('combobox'))[0]
    fireEvent.click(modelSelect)

    expect(await screen.findByRole('option', { name: displayModelName('work4you-4') })).toBeTruthy()
    expect(screen.getByRole('option', { name: displayModelName('work4you-4-mini') })).toBeTruthy()
    expect(screen.queryByText('Provider')).toBeNull()
    expect(screen.queryByText('Auxiliary models')).toBeNull()
    expect(screen.queryByText('Mixture of Agents')).toBeNull()
    expect(screen.queryByRole('button', { name: /Set up/ })).toBeNull()
    expect(screen.getByText(/Applies to new sessions/)).toBeTruthy()
  })

  it('applies a model from the current provider', async () => {
    await renderModelSettings()

    fireEvent.click((await screen.findAllByRole('combobox'))[0])
    fireEvent.click(await screen.findByRole('option', { name: displayModelName('work4you-4-mini') }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(setModelAssignment).toHaveBeenCalledWith({
        model: 'work4you-4-mini',
        provider: 'work4you',
        scope: 'main'
      })
    )
  })

  it('replaces the selected model when the active profile changes', async () => {
    getGlobalModelInfo
      .mockResolvedValueOnce({ provider: 'custom', model: 'local-a' })
      .mockResolvedValueOnce({ provider: 'work4you', model: 'work4you-4' })
    getGlobalModelOptions
      .mockResolvedValueOnce({
        providers: [
          {
            name: 'Custom A',
            slug: 'custom',
            models: ['local-a'],
            authenticated: true,
            capabilities: { 'local-a': { reasoning: true, fast: false } }
          }
        ]
      })
      .mockResolvedValueOnce({
        providers: [
          {
            name: 'Work4You',
            slug: 'work4you',
            models: ['work4you-4'],
            authenticated: true,
            capabilities: { 'work4you-4': { reasoning: true, fast: true } }
          }
        ]
      })

    await renderModelSettings()
    expect((await screen.findAllByRole('combobox'))[0].textContent).toContain(displayModelName('local-a'))

    await act(async () => {
      profileSwitchHandler?.()
    })

    await waitFor(() => expect(getGlobalModelInfo).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getAllByRole('combobox')[0].textContent).toContain(displayModelName('work4you-4'))
    )
    expect(screen.queryByRole('button', { name: /Set up/ })).toBeNull()
  })

  it('preserves a user-defined provider endpoint when applying the main model', async () => {
    getGlobalModelInfo.mockResolvedValueOnce({ provider: 'local-ollama', model: 'qwen3:latest' })
    getGlobalModelOptions.mockResolvedValueOnce({
      providers: [
        {
          name: 'Ollama',
          slug: 'local-ollama',
          models: ['qwen3:latest', 'qwen3:other'],
          authenticated: true,
          is_user_defined: true,
          api_url: 'http://localhost:11434/v1',
          capabilities: {
            'qwen3:latest': { reasoning: true, fast: false },
            'qwen3:other': { reasoning: true, fast: false }
          }
        }
      ]
    })
    setModelAssignment.mockResolvedValueOnce({
      ok: true,
      provider: 'local-ollama',
      model: 'qwen3:other',
      gateway_tools: []
    })

    await renderModelSettings()

    fireEvent.click((await screen.findAllByRole('combobox'))[0])
    fireEvent.click(await screen.findByRole('option', { name: displayModelName('qwen3:other') }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(setModelAssignment).toHaveBeenCalledWith({
        model: 'qwen3:other',
        provider: 'local-ollama',
        scope: 'main',
        base_url: 'http://localhost:11434/v1'
      })
    )
  })

  it('writes the profile default speed (service_tier) when the fast switch is toggled', async () => {
    await renderModelSettings()
    await waitFor(() => expect(getWork4YouConfigRecord).toHaveBeenCalled())

    const fastSwitch = await screen.findByRole('switch', { name: 'Fast' })
    expect(fastSwitch.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(fastSwitch)

    await waitFor(() =>
      expect(saveWork4YouConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: expect.objectContaining({ service_tier: 'fast', reasoning_effort: 'medium' })
        })
      )
    )
  })

  it('leaves an explicit medium effort and normal tier unchanged', async () => {
    await renderModelSettings()

    const reasoning = (await screen.findAllByRole('combobox')).find(node => node.textContent?.includes('Medium'))
    expect(reasoning).toBeTruthy()
    const fastSwitch = await screen.findByRole('switch', { name: 'Fast' })
    expect(fastSwitch.getAttribute('aria-checked')).toBe('false')

    await waitFor(() => expect(getWork4YouConfigRecord).toHaveBeenCalled())
    expect(saveWork4YouConfig).not.toHaveBeenCalled()
  })

  it('shows High and persists it when reasoning was never chosen', async () => {
    getWork4YouConfigRecord.mockResolvedValue({ agent: { reasoning_effort: '', service_tier: 'normal' } })

    await renderModelSettings()

    await waitFor(() =>
      expect(saveWork4YouConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: expect.objectContaining({ reasoning_effort: 'high', service_tier: 'normal' })
        })
      )
    )
    expect((await screen.findAllByRole('combobox')).some(node => node.textContent?.includes('High'))).toBe(true)
  })

  it('shows Fast on and persists it when the tier was never chosen', async () => {
    getWork4YouConfigRecord.mockResolvedValue({ agent: { reasoning_effort: 'medium', service_tier: '' } })

    await renderModelSettings()

    await waitFor(() =>
      expect(saveWork4YouConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: expect.objectContaining({ reasoning_effort: 'medium', service_tier: 'fast' })
        })
      )
    )
    expect((await screen.findByRole('switch', { name: 'Fast' })).getAttribute('aria-checked')).toBe('true')
  })

  it('hides the reasoning and speed defaults when the main model reports no capabilities', async () => {
    getGlobalModelOptions.mockResolvedValueOnce({
      providers: [
        {
          name: 'Work4You',
          slug: 'work4you',
          models: ['work4you-4'],
          authenticated: true,
          capabilities: { 'work4you-4': { reasoning: false, fast: false } }
        }
      ]
    })

    await renderModelSettings()
    await waitFor(() => expect(getWork4YouConfigRecord).toHaveBeenCalled())

    expect(screen.queryByRole('switch', { name: 'Fast' })).toBeNull()
    expect(screen.queryByText('Reasoning')).toBeNull()
  })
})
