// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'

const updateMessagingPlatform = vi.fn()
const restartGateway = vi.fn()
const getActionStatus = vi.fn()
const openExternalLink = vi.fn()
const runGatewayRestart = vi.fn()

vi.mock('@/work4you', () => ({
  getActionStatus: () => getActionStatus(),
  restartGateway: () => restartGateway(),
  updateMessagingPlatform: (id: string, body: unknown, profile?: null | string) =>
    updateMessagingPlatform(id, body, profile)
}))

vi.mock('@/lib/external-link', () => ({
  openExternalLink: (href: string) => openExternalLink(href)
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('@/store/system-actions', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $gatewayRestarting: atom(false), runGatewayRestart: () => runGatewayRestart() }
})

const s = en.messaging.discordPage

// The first segment of a bot token is the application id in base64.
const APP_ID = '1287441000712345678'
const TOKEN = `${btoa(APP_ID).replace(/=+$/, '')}.GhIjKl.${'a'.repeat(27)}`

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'discord' })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({ onApplied = vi.fn(), onDone = vi.fn(), scopeProfile = null as null | string } = {}) {
  const { DiscordConnectSteps } = await import('./discord-connect-steps')

  await act(async () => {
    render(
      <DiscordConnectSteps
        onApplied={onApplied}
        onDone={onDone}
        platformConnected={false}
        scopeProfile={scopeProfile}
      />
    )
  })

  return { onApplied, onDone }
}

function choose(name: RegExp | string) {
  fireEvent.click(screen.getByRole('radio', { name }))
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

const next = () => click('Next')
const nextButton = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement

/** Who → token → invite, landing on Who can talk. */
async function reachWhoCanTalk(audience: RegExp) {
  choose(audience)
  await next()
  fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: TOKEN } })
  await next()
  await next()
}

describe('DiscordConnectSteps', () => {
  it('reads the application from the token and builds the invite from it', async () => {
    await renderSteps()

    expect(screen.getByText(s.whoTitle)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)
    choose(new RegExp(s.othersTitle))
    await next()

    expect(screen.getByText(s.createTitle)).toBeTruthy()
    expect(screen.getByText('Developer Portal', { selector: 'b' })).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    // The portal opens through the validated external opener.
    fireEvent.click(screen.getByRole('button', { name: s.openPortal }))
    expect(openExternalLink).toHaveBeenCalledWith('https://discord.com/developers/applications')

    // Half a token is a paste mistake, said at once.
    fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: 'abc.def' } })
    expect(screen.getByText(en.messaging.envErrors.discordToken)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    // A "Bot " prefix copied along with the token is dropped.
    fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: `Bot ${TOKEN}` } })
    expect(screen.getByText(s.tokenRead(APP_ID))).toBeTruthy()
    await next()

    expect(screen.getByText(s.inviteTitle)).toBeTruthy()
    const invite = `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot+applications.commands&permissions=274878286912`
    expect(screen.getByText(invite)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: s.openInvite }))
    expect(openExternalLink).toHaveBeenCalledWith(invite)
  })

  it('saves the token with the listed people, turns the channel on and restarts', async () => {
    const { onApplied, onDone } = await renderSteps({ scopeProfile: 'work' })
    await reachWhoCanTalk(new RegExp(s.othersTitle))

    expect(screen.getByText(s.talkTitle)).toBeTruthy()
    // The person's choice is set in bold in the note.
    expect(screen.getByText(s.othersTitle, { selector: 'b' })).toBeTruthy()

    const list = screen.getByLabelText(en.messaging.channelSettings.listTitle)
    await next()
    expect(screen.getByText(s.idsRequired)).toBeTruthy()

    // Names are not ids, and `*` is the other answer, not a list entry.
    fireEvent.change(list, { target: { value: '284102345678901234, @ana' } })
    await next()
    expect(screen.getByText(en.messaging.envErrors.discordUserId('@ana'))).toBeTruthy()
    fireEvent.change(list, { target: { value: '284102345678901234, *' } })
    await next()
    expect(screen.getByText(en.messaging.envErrors.discordUserId('*'))).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()

    fireEvent.change(list, { target: { value: '284102345678901234, 284109876543210987' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'discord',
        {
          enabled: true,
          env: { DISCORD_ALLOWED_USERS: '284102345678901234,284109876543210987', DISCORD_BOT_TOKEN: TOKEN }
        },
        'work'
      )
    )
    expect(onApplied).toHaveBeenCalled()
    expect(restartGateway).toHaveBeenCalled()
    expect(await screen.findByText(s.readySetUp)).toBeTruthy()
    expect(screen.getByText(s.checkTokenSaved)).toBeTruthy()
    expect(screen.getByText(s.whoList(2))).toBeTruthy()
    expect(await screen.findByText(en.messaging.channelSteps.checkRestarted, {}, { timeout: 4000 })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: en.common.done }))
    expect(onDone).toHaveBeenCalled()
  })

  it('lets everyone the bot can see in with the allowlist wildcard', async () => {
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.othersTitle))

    choose(new RegExp(s.everyoneTitle))
    expect(screen.queryByLabelText(en.messaging.channelSettings.listTitle)).toBeNull()
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'discord',
        { enabled: true, env: { DISCORD_ALLOWED_USERS: '*', DISCORD_BOT_TOKEN: TOKEN } },
        null
      )
    )
    expect(await screen.findByText(s.whoEveryone)).toBeTruthy()
  })

  it('asks for the own user ID when it is just the person', async () => {
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.meTitle))

    expect(screen.getByText(s.meIdTitle)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.meIdLabel), { target: { value: '284102345678901234' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'discord',
        { enabled: true, env: { DISCORD_ALLOWED_USERS: '284102345678901234', DISCORD_BOT_TOKEN: TOKEN } },
        null
      )
    )
    expect(await screen.findByText(s.whoMe)).toBeTruthy()
  })

  it('returns to Who can talk, with the error, when the save fails', async () => {
    updateMessagingPlatform.mockRejectedValue(new Error('400 bad token'))
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.othersTitle))

    choose(new RegExp(s.everyoneTitle))
    await next()

    expect(await screen.findByText('400 bad token')).toBeTruthy()
    expect(screen.getByText(s.talkTitle)).toBeTruthy()
    expect(restartGateway).not.toHaveBeenCalled()
  })

  it('reports a restart that could not start, with a restart action', async () => {
    restartGateway.mockRejectedValue(new Error('503 busy'))
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.othersTitle))

    choose(new RegExp(s.everyoneTitle))
    await next()

    expect(await screen.findByText(en.messaging.channelSteps.checkRestartNotStarted(': 503 busy'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Restart gateway/ }))
    expect(runGatewayRestart).toHaveBeenCalled()
  })
})
