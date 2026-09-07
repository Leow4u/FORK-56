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

const PHONE_NUMBER_ID = '123456789012345'
const ACCESS_TOKEN = `EAA${'x'.repeat(120)}`
const APP_SECRET = 'a'.repeat(32)
const VERIFY_TOKEN = 'verify-token-with-plenty-of-length'
const SECRET_KEYS = new Set(['WHATSAPP_CLOUD_ACCESS_TOKEN', 'WHATSAPP_CLOUD_APP_SECRET', 'WHATSAPP_CLOUD_VERIFY_TOKEN'])

function envVar(key: string, value: null | string = null, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: SECRET_KEYS.has(key),
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: key === 'WHATSAPP_CLOUD_PHONE_NUMBER_ID' || key === 'WHATSAPP_CLOUD_ACCESS_TOKEN',
    url: null,
    value
  }
}

const DEFAULT_VARS = [
  envVar('WHATSAPP_CLOUD_PHONE_NUMBER_ID'),
  envVar('WHATSAPP_CLOUD_ACCESS_TOKEN'),
  envVar('WHATSAPP_CLOUD_APP_SECRET'),
  envVar('WHATSAPP_CLOUD_VERIFY_TOKEN'),
  envVar('WHATSAPP_CLOUD_ALLOWED_USERS'),
  envVar('WHATSAPP_CLOUD_PUBLIC_URL'),
  envVar('WHATSAPP_CLOUD_WEBHOOK_HOST'),
  envVar('WHATSAPP_CLOUD_WEBHOOK_PORT'),
  envVar('WHATSAPP_CLOUD_WEBHOOK_PATH')
]

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'whatsapp_cloud' })
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
  envVars = DEFAULT_VARS,
  onApplied = vi.fn(),
  scopeProfile = null as null | string
} = {}) {
  const { WhatsAppCloudQuickSetup } = await import('./whatsapp-cloud-quick-setup')

  await act(async () => {
    render(
      <WhatsAppCloudQuickSetup
        configured={configured}
        envVars={envVars}
        onApplied={onApplied}
        scopeProfile={scopeProfile}
      />
    )
  })

  return onApplied
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText(/^Phone number ID/), { target: { value: PHONE_NUMBER_ID } })
  fireEvent.change(screen.getByLabelText(/^Access token/), { target: { value: ACCESS_TOKEN } })
  fireEvent.change(screen.getByLabelText(/^App secret/), { target: { value: APP_SECRET } })
  fireEvent.change(screen.getByLabelText(/Webhook verify token/), { target: { value: VERIFY_TOKEN } })
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Save & enable/ }))
  })
}

describe('helpers', () => {
  it('builds the callback URL from the public origin, else the local bind', async () => {
    const { whatsappCloudCallbackUrl } = await import('./whatsapp-cloud-quick-setup')

    expect(whatsappCloudCallbackUrl([])).toBe('http://127.0.0.1:8090/whatsapp/webhook')
    expect(
      whatsappCloudCallbackUrl([
        envVar('WHATSAPP_CLOUD_WEBHOOK_PORT', '9090'),
        envVar('WHATSAPP_CLOUD_WEBHOOK_HOST', 'wa.local'),
        envVar('WHATSAPP_CLOUD_WEBHOOK_PATH', 'hooks/meta')
      ])
    ).toBe('http://wa.local:9090/hooks/meta')
    // An all-interfaces bind is not a reachable address to hand Meta.
    expect(whatsappCloudCallbackUrl([envVar('WHATSAPP_CLOUD_WEBHOOK_HOST', '0.0.0.0')])).toBe(
      'http://127.0.0.1:8090/whatsapp/webhook'
    )
    expect(whatsappCloudCallbackUrl([envVar('WHATSAPP_CLOUD_PUBLIC_URL', 'https://tunnel.example/')])).toBe(
      'https://tunnel.example/whatsapp/webhook'
    )
  })

  it('treats an unset or loopback host as not network exposed', async () => {
    const { whatsappCloudIsNetworkExposed } = await import('./whatsapp-cloud-quick-setup')

    expect(whatsappCloudIsNetworkExposed([])).toBe(false)
    expect(whatsappCloudIsNetworkExposed([envVar('WHATSAPP_CLOUD_WEBHOOK_HOST', '127.0.0.1')])).toBe(false)
    expect(whatsappCloudIsNetworkExposed([envVar('WHATSAPP_CLOUD_WEBHOOK_HOST', '0.0.0.0')])).toBe(true)
  })

  it('generates a verify token the gateway validator accepts', async () => {
    const { generateWhatsappCloudVerifyToken } = await import('./whatsapp-cloud-quick-setup')
    const { validateMessagingEnv } = await import('./validate-env')

    const token = generateWhatsappCloudVerifyToken()

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(validateMessagingEnv('WHATSAPP_CLOUD_VERIFY_TOKEN', token)).toBeNull()
    expect(generateWhatsappCloudVerifyToken()).not.toBe(token)
  })
})

describe('WhatsAppCloudQuickSetup', () => {
  it('refuses to save without the phone number id', async () => {
    await renderQuickSetup()

    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getByText(/Enter the Phone number ID first/)).toBeTruthy()
  })

  it('walks through the missing secrets one at a time', async () => {
    await renderQuickSetup()

    fireEvent.change(screen.getByLabelText(/^Phone number ID/), { target: { value: PHONE_NUMBER_ID } })
    await save()
    expect(screen.getByText(/Enter the access token first/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/^Access token/), { target: { value: ACCESS_TOKEN } })
    await save()
    expect(screen.getByText(/Enter the App secret first/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/^App secret/), { target: { value: APP_SECRET } })
    await save()
    expect(screen.getByText(/Generate or enter a verify token first/)).toBeTruthy()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('keeps saved secrets when the fields are left empty', async () => {
    await renderQuickSetup({
      configured: true,
      envVars: [
        envVar('WHATSAPP_CLOUD_PHONE_NUMBER_ID', PHONE_NUMBER_ID),
        envVar('WHATSAPP_CLOUD_ACCESS_TOKEN', null, true),
        envVar('WHATSAPP_CLOUD_APP_SECRET', null, true),
        envVar('WHATSAPP_CLOUD_VERIFY_TOKEN', null, true),
        envVar('WHATSAPP_CLOUD_ALLOWED_USERS', '15551234567'),
        envVar('WHATSAPP_CLOUD_PUBLIC_URL'),
        envVar('WHATSAPP_CLOUD_WEBHOOK_HOST'),
        envVar('WHATSAPP_CLOUD_WEBHOOK_PORT')
      ]
    })

    expect(screen.getByText(/A verify token is already saved/)).toBeTruthy()

    await save()

    const [, body] = updateMessagingPlatform.mock.calls[0]

    expect(body.env).not.toHaveProperty('WHATSAPP_CLOUD_ACCESS_TOKEN')
    expect(body.env).not.toHaveProperty('WHATSAPP_CLOUD_APP_SECRET')
    expect(body.env).not.toHaveProperty('WHATSAPP_CLOUD_VERIFY_TOKEN')
    expect(body.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID).toBe(PHONE_NUMBER_ID)
    expect(body.env.WHATSAPP_CLOUD_ALLOWED_USERS).toBe('15551234567')
  })

  it('rejects a phone number pasted into the phone number id', async () => {
    await renderQuickSetup()

    fillCredentials()
    fireEvent.change(screen.getByLabelText(/^Phone number ID/), { target: { value: '15551234567' } })
    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    // Shown twice on purpose: inline under the field and in the save banner.
    expect(screen.getAllByText(/looks like the phone number itself/).length).toBe(2)
  })

  it('rejects a temporary-looking token and a non-hex app secret', async () => {
    await renderQuickSetup()

    fillCredentials()
    fireEvent.change(screen.getByLabelText(/^Access token/), { target: { value: 'short-token' } })
    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getAllByText(/starts with EAA/).length).toBe(2)

    fireEvent.change(screen.getByLabelText(/^Access token/), { target: { value: ACCESS_TOKEN } })
    fireEvent.change(screen.getByLabelText(/^App secret/), { target: { value: 'not-a-hex-secret' } })
    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getAllByText(/32 hexadecimal characters, from Meta/).length).toBe(2)
  })

  it('rejects a plain-HTTP public origin', async () => {
    await renderQuickSetup()

    fillCredentials()
    fireEvent.change(screen.getByLabelText(/Public HTTPS origin/), { target: { value: 'http://tunnel.example' } })
    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getAllByText(/is not a valid public URL/).length).toBe(2)
  })

  it('saves a localhost bind, the public origin, and the allowlist', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    fillCredentials()
    fireEvent.change(screen.getByLabelText(/Public HTTPS origin/), { target: { value: 'https://tunnel.example' } })
    fireEvent.change(screen.getByLabelText(/Allowed WhatsApp numbers/), { target: { value: '15551234567' } })
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'whatsapp_cloud',
      {
        enabled: true,
        env: {
          WHATSAPP_CLOUD_PHONE_NUMBER_ID: PHONE_NUMBER_ID,
          WHATSAPP_CLOUD_WEBHOOK_HOST: '127.0.0.1',
          WHATSAPP_CLOUD_ACCESS_TOKEN: ACCESS_TOKEN,
          WHATSAPP_CLOUD_APP_SECRET: APP_SECRET,
          WHATSAPP_CLOUD_VERIFY_TOKEN: VERIFY_TOKEN,
          WHATSAPP_CLOUD_PUBLIC_URL: 'https://tunnel.example',
          WHATSAPP_CLOUD_ALLOWED_USERS: '15551234567'
        }
      },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('saves a network bind when chosen', async () => {
    await renderQuickSetup()

    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: /Network/ }))
    await save()

    const [, body] = updateMessagingPlatform.mock.calls[0]

    expect(body.env.WHATSAPP_CLOUD_WEBHOOK_HOST).toBe('0.0.0.0')
  })

  it('generates and copies a verify token', async () => {
    await renderQuickSetup()

    expect(screen.queryByRole('button', { name: /Copy token/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Generate token/ }))

    const generated = (screen.getByLabelText(/Webhook verify token/) as HTMLInputElement).value

    expect(generated).toMatch(/^[0-9a-f]{64}$/)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy token/ }))
    })

    expect(writeText).toHaveBeenCalledWith(generated)
  })

  it('copies the callback URL that Meta needs, following the public origin', async () => {
    await renderQuickSetup()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy callback URL/ }))
    })

    expect(writeText).toHaveBeenCalledWith('http://127.0.0.1:8090/whatsapp/webhook')

    fireEvent.change(screen.getByLabelText(/Public HTTPS origin/), { target: { value: 'https://tunnel.example' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy callback URL/ }))
    })

    expect(writeText).toHaveBeenLastCalledWith('https://tunnel.example/whatsapp/webhook')
  })

  it('warns while the callback still points at localhost', async () => {
    await renderQuickSetup()

    expect(screen.getByText(/which Meta cannot reach/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Public HTTPS origin/), { target: { value: 'https://tunnel.example' } })

    expect(screen.queryByText(/which Meta cannot reach/)).toBeNull()
  })

  it('warns while no allowlist is set', async () => {
    await renderQuickSetup()

    expect(screen.getByText(/anyone who messages your business number/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Allowed WhatsApp numbers/), { target: { value: '15551234567' } })

    expect(screen.queryByText(/anyone who messages your business number/)).toBeNull()
  })

  it('opens the guide and the Meta developer dashboard', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /WhatsApp Cloud API guide/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://work4you.ai/docs/user-guide/messaging/whatsapp-cloud')

    fireEvent.click(screen.getByRole('button', { name: /Meta developer dashboard/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://developers.facebook.com/apps')
  })
})
