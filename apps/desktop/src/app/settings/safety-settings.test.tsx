import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

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
    'approvals.mode': { type: 'string' },
    'approvals.timeout': { type: 'number' },
    'approvals.mcp_reload_confirm': { type: 'boolean' },
    command_allowlist: { type: 'list' },
    'security.redact_secrets': { type: 'boolean' },
    'security.allow_private_urls': { type: 'boolean' },
    'browser.allow_private_urls': { type: 'boolean' },
    'browser.auto_local_for_private_urls': { type: 'boolean' },
    'checkpoints.enabled': { type: 'boolean' }
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSafety(config: Record<string, unknown>) {
  getWork4YouConfigRecord.mockResolvedValue(config)
  getWork4YouConfigSchema.mockResolvedValue(schema)
  getElevenLabsVoices.mockResolvedValue({ available: false, voices: [] })
  saveWork4YouConfig.mockResolvedValue({ ok: true })

  const { ConfigSettings } = await import('./config-settings')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConfigSettings activeSectionId="safety" importInputRef={{ current: null }} />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Safety settings', () => {
  it('offers Ask, Decide for me, and Run without asking, and hides engine knobs', async () => {
    await renderSafety({
      approvals: { mode: 'smart', timeout: 300, mcp_reload_confirm: true },
      command_allowlist: ['git status'],
      security: { redact_secrets: true, allow_private_urls: false },
      browser: { allow_private_urls: false, auto_local_for_private_urls: false },
      checkpoints: { enabled: false }
    })

    expect(await screen.findByText('Decide for me')).toBeTruthy()
    expect(screen.getByText('Commands that can run')).toBeTruthy()
    expect(screen.getByText('git status')).toBeTruthy()
    expect(screen.queryByText('Approval Timeout')).toBeNull()
    expect(screen.queryByText('Confirm MCP Reloads')).toBeNull()
    expect(screen.queryByText('Redact Secrets')).toBeNull()
    expect(screen.queryByText('Allow Private URLs')).toBeNull()
    expect(screen.queryByText('Browser Private URLs')).toBeNull()
    expect(screen.queryByText('Local Browser For Private URLs')).toBeNull()
    expect(screen.queryByText('File Checkpoints')).toBeNull()

    fireEvent.click(screen.getByRole('combobox'))
    expect(await screen.findByRole('option', { name: 'Ask' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Decide for me' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Run without asking' })).toBeTruthy()
  })

  it('hides the command list when commands run without asking', async () => {
    await renderSafety({
      approvals: { mode: 'off' },
      command_allowlist: ['rm']
    })

    expect(await screen.findByText('Run without asking')).toBeTruthy()
    expect(screen.queryByText('Commands that can run')).toBeNull()
    expect(screen.queryByText('rm')).toBeNull()
  })

  it('saves an added command as a list', async () => {
    await renderSafety({
      approvals: { mode: 'manual' },
      command_allowlist: []
    })

    const input = await screen.findByRole('textbox', { name: 'Command' })
    fireEvent.change(input, { target: { value: 'rm' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set' }))

    await waitFor(() =>
      expect(saveWork4YouConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          approvals: expect.objectContaining({ mode: 'manual' }),
          command_allowlist: ['rm']
        })
      )
    )
  })
})
