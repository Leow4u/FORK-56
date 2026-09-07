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
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'google_chat' })
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
  const { GoogleChatQuickSetup } = await import('./google-chat-quick-setup')

  await act(async () => {
    render(<GoogleChatQuickSetup configured={configured} onApplied={onApplied} scopeProfile={scopeProfile} />)
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

describe('subscriptionProject', () => {
  it('extracts the project embedded in a full subscription path', async () => {
    const { subscriptionProject } = await import('./google-chat-quick-setup')

    expect(subscriptionProject('projects/my-project/subscriptions/work4you-chat')).toBe('my-project')
    expect(subscriptionProject('work4you-chat')).toBeNull()
  })
})

describe('GoogleChatQuickSetup', () => {
  it('defaults to Pub/Sub mode and links the Google Cloud console', async () => {
    await renderQuickSetup()

    expect(screen.getByLabelText('Project ID')).toBeTruthy()
    expect(screen.getByLabelText('Subscription path')).toBeTruthy()
    expect(screen.queryByLabelText('HTTP events URL')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Open Google Cloud console/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://console.cloud.google.com/')
  })

  it('switches to HTTP callback mode and swaps the fields and checklist', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /HTTP callback/ }))

    expect(screen.getByLabelText('HTTP events URL')).toBeTruthy()
    expect(screen.getByLabelText('App service account email')).toBeTruthy()
    expect(screen.queryByLabelText('Subscription path')).toBeNull()
    expect(screen.getByText(/set Connection settings to App URL/)).toBeTruthy()
  })

  it('flags a malformed project ID and subscription path live', async () => {
    await renderQuickSetup()

    setField('Project ID', 'My Project!')
    expect(screen.getByText(/not a valid Google Cloud project ID/)).toBeTruthy()

    setField('Subscription path', 'work4you-chat')
    expect(screen.getByText(/not a full Pub\/Sub subscription path/)).toBeTruthy()
  })

  it('flags a project ID that does not match the subscription path', async () => {
    await renderQuickSetup()

    setField('Project ID', 'other-project')
    setField('Subscription path', 'projects/my-project/subscriptions/work4you-chat')

    expect(screen.getByText(/does not match the project inside the subscription path/)).toBeTruthy()

    await save()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('refuses to save Pub/Sub mode until both fields are filled', async () => {
    await renderQuickSetup()

    setField('Project ID', 'my-project')
    await save()

    expect(screen.getByText(/Enter the project ID and the subscription path/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('refuses to save HTTP mode without the events URL and SA email', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /HTTP callback/ }))
    setField('HTTP events URL', 'https://example.com/chat/events')
    await save()

    expect(screen.getByText(/Enter the events URL and the app service account email/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('saves Pub/Sub mode with enabled=true, trimming values and omitting empty optionals', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    setField('Project ID', ' my-project ')
    setField('Subscription path', ' projects/my-project/subscriptions/work4you-chat ')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'google_chat',
      {
        enabled: true,
        env: {
          GOOGLE_CHAT_PROJECT_ID: 'my-project',
          GOOGLE_CHAT_SUBSCRIPTION_NAME: 'projects/my-project/subscriptions/work4you-chat'
        }
      },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('saves HTTP mode with the SA JSON, audience, and allowlist when provided', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /HTTP callback/ }))
    setField('Service Account JSON', '/keys/sa.json')
    setField('HTTP events URL', 'https://example.com/chat/events')
    setField('App service account email', 'work4you-chat@my-project.iam.gserviceaccount.com')
    setField('Token audience', 'https://example.com/chat/events')
    setField('Allowed users', 'you@yourcompany.com, *')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'google_chat',
      {
        enabled: true,
        env: {
          GOOGLE_CHAT_SERVICE_ACCOUNT_JSON: '/keys/sa.json',
          GOOGLE_CHAT_HTTP_EVENTS_URL: 'https://example.com/chat/events',
          GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL: 'work4you-chat@my-project.iam.gserviceaccount.com',
          GOOGLE_CHAT_HTTP_EVENTS_AUDIENCE: 'https://example.com/chat/events',
          GOOGLE_CHAT_ALLOWED_USERS: 'you@yourcompany.com, *'
        }
      },
      null
    )
  })

  it('rejects malformed allowlist emails client-side before any API call', async () => {
    await renderQuickSetup()

    setField('Project ID', 'my-project')
    setField('Subscription path', 'projects/my-project/subscriptions/work4you-chat')
    setField('Allowed users', 'you@yourcompany.com, not-an-email')
    await save()

    expect(screen.getByText(/not-an-email does not look like an email address/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })
})
