// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const updateMessagingPlatform = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()

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

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'email' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderQuickSetup({
  configured = false,
  onApplied = vi.fn(),
  scopeProfile = null as null | string
} = {}) {
  const { EmailQuickSetup } = await import('./email-quick-setup')

  await act(async () => {
    render(<EmailQuickSetup configured={configured} onApplied={onApplied} scopeProfile={scopeProfile} />)
  })

  return onApplied
}

function setField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Save & enable/ }))
  })
}

describe('EmailQuickSetup', () => {
  it('detects the provider from the address domain and links its app-password page', async () => {
    await renderQuickSetup()

    setField('Email address', 'agent@gmail.com')

    // Preset resolved → hosts summary replaces the custom host inputs.
    expect(screen.getByText('imap.gmail.com:993 · smtp.gmail.com:587')).toBeTruthy()
    expect(screen.queryByLabelText('IMAP host')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Create app password/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://myaccount.google.com/apppasswords')
  })

  it('flags a malformed address live', async () => {
    await renderQuickSetup()

    setField('Email address', 'not-an-address')
    expect(screen.getByText(/not-an-address does not look like an email address/)).toBeTruthy()
  })

  it('refuses to save without an address and password', async () => {
    await renderQuickSetup()

    setField('Email address', 'agent@gmail.com')
    await save()

    expect(screen.getByText(/Enter the email address and password/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('saves preset hosts with enabled=true and no port overrides', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    setField('Email address', ' agent@gmail.com ')
    setField('Password', 'app-password')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'email',
      {
        enabled: true,
        env: {
          EMAIL_ADDRESS: 'agent@gmail.com',
          EMAIL_PASSWORD: 'app-password',
          EMAIL_IMAP_HOST: 'imap.gmail.com',
          EMAIL_SMTP_HOST: 'smtp.gmail.com'
        }
      },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('saves custom hosts and ports when no preset is chosen', async () => {
    await renderQuickSetup()

    setField('Email address', 'agent@mycompany.com')
    setField('Password', 'secret')
    // Unknown domain → custom stays selected and the host inputs render.
    setField('IMAP host', 'mail.mycompany.com')
    setField('IMAP port', '1993')
    setField('SMTP host', 'mail.mycompany.com')
    setField('SMTP port', '2587')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'email',
      {
        enabled: true,
        env: {
          EMAIL_ADDRESS: 'agent@mycompany.com',
          EMAIL_PASSWORD: 'secret',
          EMAIL_IMAP_HOST: 'mail.mycompany.com',
          EMAIL_IMAP_PORT: '1993',
          EMAIL_SMTP_HOST: 'mail.mycompany.com',
          EMAIL_SMTP_PORT: '2587'
        }
      },
      null
    )
  })

  it('blocks the save on a custom host pasted with a scheme', async () => {
    await renderQuickSetup()

    setField('Email address', 'agent@mycompany.com')
    setField('Password', 'secret')
    setField('IMAP host', 'https://mail.mycompany.com')
    setField('SMTP host', 'mail.mycompany.com')
    await save()

    expect(screen.getByText(/not a valid mail server host/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('rejects malformed allowlist senders client-side before any API call', async () => {
    await renderQuickSetup()

    setField('Email address', 'agent@gmail.com')
    setField('Password', 'app-password')
    setField('Allowed senders', 'you@example.com, carla')
    await save()

    expect(screen.getByText(/carla does not look like an email address/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()

    setField('Allowed senders', 'you@example.com, *')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'email',
      expect.objectContaining({
        env: expect.objectContaining({ EMAIL_ALLOWED_USERS: 'you@example.com, *' })
      }),
      null
    )
  })

  it('lets an explicit provider click override the domain auto-detect', async () => {
    await renderQuickSetup()

    setField('Email address', 'agent@gmail.com')
    expect(screen.getByText('imap.gmail.com:993 · smtp.gmail.com:587')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByLabelText('IMAP host')).toBeTruthy()

    // Further typing must not snap the picker back to the detected preset.
    setField('Email address', 'agent2@gmail.com')
    expect(screen.getByLabelText('IMAP host')).toBeTruthy()
  })
})
