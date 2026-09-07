// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessagingEnvVarInfo } from '@/types/work4you'

const updateMessagingPlatform = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()
const writeText = vi.fn()

vi.mock('@/work4you', () => ({
  updateMessagingPlatform: (platformId: string, body: unknown, profile?: null | string) =>
    updateMessagingPlatform(platformId, body, profile)
}))

vi.mock('@/lib/external-link', () => ({
  openExternalLink: (href: string) => openExternalLink(href)
}))

vi.mock('@/store/notifications', () => ({
  notify: (input: unknown) => notify(input),
  notifyError: vi.fn()
}))

vi.mock('@/store/system-actions', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $gatewayRestarting: atom(false), runGatewayRestart: vi.fn() }
})

function envVar(key: string, value: null | string = null): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key === 'API_SERVER_KEY',
    is_set: Boolean(value),
    key,
    prompt: key,
    redacted_value: null,
    required: key === 'API_SERVER_KEY',
    url: null,
    value
  }
}

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'api_server' })
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderQuickSetup({
  configured = false,
  envVars = [envVar('API_SERVER_KEY'), envVar('API_SERVER_PORT'), envVar('API_SERVER_HOST')],
  onApplied = vi.fn(),
  scopeProfile = null as null | string
} = {}) {
  const { ApiServerQuickSetup } = await import('./api-server-quick-setup')

  await act(async () => {
    render(
      <ApiServerQuickSetup
        configured={configured}
        envVars={envVars}
        onApplied={onApplied}
        scopeProfile={scopeProfile}
      />
    )
  })

  return onApplied
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Save & enable/ }))
  })
}

describe('helpers', () => {
  it('generates keys that pass the adapter startup guard (16+ chars, URL-safe)', async () => {
    const { generateApiServerKey } = await import('./api-server-quick-setup')
    const { isUsableApiServerKey } = await import('./validate-env')

    const key = generateApiServerKey()

    expect(key.length).toBeGreaterThanOrEqual(16)
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(isUsableApiServerKey(key)).toBe(true)
    expect(generateApiServerKey()).not.toBe(key)
  })

  it('builds the base URL from saved values with adapter defaults filled in', async () => {
    const { apiServerBaseUrl } = await import('./api-server-quick-setup')

    expect(apiServerBaseUrl([])).toBe('http://127.0.0.1:8642/v1')
    expect(apiServerBaseUrl([envVar('API_SERVER_PORT', '9000'), envVar('API_SERVER_HOST', 'my-server.local')])).toBe(
      'http://my-server.local:9000/v1'
    )
    // Wildcard binds are shown as loopback — that's the address a local tool dials.
    expect(apiServerBaseUrl([envVar('API_SERVER_HOST', '0.0.0.0')])).toBe('http://127.0.0.1:8642/v1')
  })

  it('flags network-reachable binds and leaves loopback alone', async () => {
    const { apiServerIsNetworkExposed } = await import('./api-server-quick-setup')

    expect(apiServerIsNetworkExposed([])).toBe(false)
    expect(apiServerIsNetworkExposed([envVar('API_SERVER_HOST', '127.0.0.1')])).toBe(false)
    expect(apiServerIsNetworkExposed([envVar('API_SERVER_HOST', '0.0.0.0')])).toBe(true)
    expect(apiServerIsNetworkExposed([envVar('API_SERVER_HOST', '192.168.1.5')])).toBe(true)
  })
})

describe('ApiServerQuickSetup', () => {
  it('generates a strong key into the input', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /Generate key/ }))

    const input = screen.getByLabelText('API key') as HTMLInputElement

    expect(input.value.length).toBeGreaterThanOrEqual(16)
  })

  it('flags a weak key live and refuses to save it', async () => {
    await renderQuickSetup()

    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'short-key' } })
    expect(screen.getByText(/at least 16 characters/)).toBeTruthy()

    await save()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('refuses to save without a key', async () => {
    await renderQuickSetup()

    await save()
    expect(screen.getByText(/Generate or paste an API key first/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('saves the key, enables the platform, and reports success', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    fireEvent.click(screen.getByRole('button', { name: /Generate key/ }))

    const key = (screen.getByLabelText('API key') as HTMLInputElement).value

    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'api_server',
      { enabled: true, env: { API_SERVER_KEY: key } },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('shows the saved connection details and copies the base URL', async () => {
    await renderQuickSetup({
      configured: true,
      envVars: [
        envVar('API_SERVER_KEY', null),
        envVar('API_SERVER_PORT', '9000'),
        envVar('API_SERVER_HOST', '127.0.0.1'),
        envVar('API_SERVER_MODEL_NAME', 'dutelog-agent')
      ]
    })

    expect(screen.getByText('http://127.0.0.1:9000/v1')).toBeTruthy()
    expect(screen.getByText(/dutelog-agent/)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy base URL/ }))
    })
    expect(writeText).toHaveBeenCalledWith('http://127.0.0.1:9000/v1')
  })

  it('warns when the bind address is reachable from the network', async () => {
    await renderQuickSetup({ envVars: [envVar('API_SERVER_HOST', '0.0.0.0')] })

    expect(screen.getByText(/bound to a network-reachable address/)).toBeTruthy()
  })

  it('links the Open WebUI guide', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /Open WebUI guide/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://work4you.ai/docs/user-guide/messaging/open-webui')
  })
})
