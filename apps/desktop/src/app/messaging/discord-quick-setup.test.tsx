// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

const updateMessagingPlatform = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()

vi.mock('@/work4you', () => ({
  updateMessagingPlatform: (id: string, body: unknown, profile?: null | string) =>
    updateMessagingPlatform(id, body, profile)
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

const APP_ID = '1086042810000000000'
const TOKEN = `${btoa(APP_ID).replace(/=+$/, '')}.GXk2ap.tW0abcDEFghiJKLmnoPQRstuVWxyz1234567890`

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderQuickSetup({
  configured = false,
  onApplied = vi.fn(),
  scopeProfile = null as null | string
} = {}) {
  const { DiscordQuickSetup } = await import('./discord-quick-setup')

  await act(async () => {
    render(<DiscordQuickSetup configured={configured} onApplied={onApplied} scopeProfile={scopeProfile} />)
  })

  return onApplied
}

function pasteToken(value: string) {
  fireEvent.change(screen.getByLabelText('Bot token'), { target: { value } })
}

describe('DiscordQuickSetup', () => {
  it('decodes the application id from a pasted token and links invite + intents pages', async () => {
    await renderQuickSetup()

    // Nothing token-derived is shown before a token lands.
    expect(screen.queryByText(/Application detected/)).toBeNull()

    pasteToken(`Bot ${TOKEN}`)

    expect(screen.getByText(`Application detected — ID ${APP_ID}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Invite bot to your server/ }))
    expect(openExternalLink).toHaveBeenCalledWith(expect.stringContaining(`client_id=${APP_ID}`))

    fireEvent.click(screen.getByRole('button', { name: /Open bot settings/ }))
    expect(openExternalLink).toHaveBeenCalledWith(`https://discord.com/developers/applications/${APP_ID}/bot`)
  })

  it('flags a malformed token immediately and never shows the checklist', async () => {
    await renderQuickSetup()

    pasteToken('not-a-discord-token')

    expect(screen.getByText(/complete bot token/)).toBeTruthy()
    expect(screen.queryByText(/Application detected/)).toBeNull()
  })

  it('saves the token (and allowlist) with enabled=true, then offers a restart', async () => {
    updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'discord' })
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    pasteToken(TOKEN)
    fireEvent.change(screen.getByLabelText('Allowed Discord user IDs'), {
      target: { value: '123456789012345678' }
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save & enable/ }))
    })

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'discord',
      {
        enabled: true,
        env: { DISCORD_BOT_TOKEN: TOKEN, DISCORD_ALLOWED_USERS: '123456789012345678' }
      },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('rejects a non-snowflake allowlist entry client-side without calling the API', async () => {
    const onApplied = await renderQuickSetup()

    pasteToken(TOKEN)
    fireEvent.change(screen.getByLabelText('Allowed Discord user IDs'), {
      target: { value: '123456789012345678, @carla' }
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save & enable/ }))
    })

    expect(screen.getByText(/@carla is not a numeric Discord user ID/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(onApplied).not.toHaveBeenCalled()
  })

  it('warns that saving replaces the stored token when already configured', async () => {
    await renderQuickSetup({ configured: true })

    expect(screen.getByText(/replaces the stored token/)).toBeTruthy()
  })
})
