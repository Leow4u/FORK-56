// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSlackManifest = vi.fn()
const updateMessagingPlatform = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()
const writeText = vi.fn()

vi.mock('@/work4you', () => ({
  getSlackManifest: () => getSlackManifest(),
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

const MANIFEST = {
  display_information: { name: 'Work4You' },
  features: { slash_commands: [{ command: '/new' }] },
  settings: { socket_mode_enabled: true }
}

beforeEach(() => {
  getSlackManifest.mockResolvedValue({ manifest: MANIFEST })
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'slack' })
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  })
  writeText.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderQuickSetup({ configured = false, onApplied = vi.fn(), scopeProfile = null as null | string } = {}) {
  const { SlackQuickSetup } = await import('./slack-quick-setup')

  await act(async () => {
    render(<SlackQuickSetup configured={configured} onApplied={onApplied} scopeProfile={scopeProfile} />)
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

describe('SlackQuickSetup', () => {
  it('copies the generated manifest as pretty JSON and opens the create-app page', async () => {
    await renderQuickSetup()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy app manifest/ }))
    })

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(MANIFEST, null, 2))
    expect(await screen.findByText('Manifest copied')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Create app on Slack/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://api.slack.com/apps?new_app=1')
  })

  it('flags swapped tokens live — each field insists on its own prefix', async () => {
    await renderQuickSetup()

    setField('Bot token', 'xapp-1-A123-456-abc')
    expect(screen.getByText('This token must start with xoxb-')).toBeTruthy()

    setField('App-level token', 'xoxb-123-456-abc')
    expect(screen.getByText('This token must start with xapp-')).toBeTruthy()
  })

  it('refuses to save until both tokens are present', async () => {
    await renderQuickSetup()

    setField('Bot token', 'xoxb-123-456-abc')
    await save()

    expect(screen.getByText(/Paste both tokens/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('saves both tokens with enabled=true and omits an empty allowlist', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    setField('Bot token', '  xoxb-123-456-abc ')
    setField('App-level token', 'xapp-1-A123-456-abc')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'slack',
      {
        enabled: true,
        env: { SLACK_APP_TOKEN: 'xapp-1-A123-456-abc', SLACK_BOT_TOKEN: 'xoxb-123-456-abc' }
      },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('rejects malformed member IDs client-side before any API call', async () => {
    await renderQuickSetup()

    setField('Bot token', 'xoxb-123-456-abc')
    setField('App-level token', 'xapp-1-A123-456-abc')
    setField('Allowed Slack member IDs', 'U01ABC2DEF3,@carla')
    await save()

    expect(screen.getByText(/@carla does not look like a Slack member ID/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()

    setField('Allowed Slack member IDs', 'U01ABC2DEF3,*')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'slack',
      expect.objectContaining({
        env: expect.objectContaining({ SLACK_ALLOWED_USERS: 'U01ABC2DEF3,*' })
      }),
      null
    )
  })
})
