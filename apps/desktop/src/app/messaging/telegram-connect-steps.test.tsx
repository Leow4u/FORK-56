// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'

const startTelegramOnboarding = vi.fn()
const getTelegramOnboardingStatus = vi.fn()
const applyTelegramOnboarding = vi.fn()
const cancelTelegramOnboarding = vi.fn()
const updateMessagingPlatform = vi.fn()
const restartGateway = vi.fn()
const getActionStatus = vi.fn()
const openExternalLink = vi.fn()
const runGatewayRestart = vi.fn()

vi.mock('@/work4you', () => ({
  applyTelegramOnboarding: (
    pairingId: string,
    ids: string[],
    profile?: null | string,
    homeChannel?: { chat_id: string; name: string }
  ) => applyTelegramOnboarding(pairingId, ids, profile, homeChannel),
  cancelTelegramOnboarding: (pairingId: string) => cancelTelegramOnboarding(pairingId),
  getActionStatus: () => getActionStatus(),
  getTelegramOnboardingStatus: (pairingId: string) => getTelegramOnboardingStatus(pairingId),
  restartGateway: () => restartGateway(),
  startTelegramOnboarding: (botName?: string) => startTelegramOnboarding(botName),
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

// The QR encoder is a real dependency, but the component only cares that it
// returns a renderable data URL.
vi.mock('qrcode', () => ({
  toDataURL: vi.fn(async () => 'data:image/png;base64,fake-qr')
}))

const s = en.messaging.telegramPage
const hd = en.messaging.homeDelivery
const home = (chatId: string) => ({ chat_id: chatId, name: chatId })

async function throughDeliver(manualId?: string) {
  expect(await screen.findByText(hd.title)).toBeTruthy()

  if (manualId) {
    fireEvent.change(screen.getByLabelText(hd.label), { target: { value: manualId } })
  }

  await next()
}

/** A sentence as the screen shows it: its **marked** words lose the marks. */
const shown = (text: string) => text.replace(/\*\*/g, '')
const EXPIRES_AT = new Date(Date.now() + 5 * 60_000).toISOString()
const VALID_TOKEN = `123456789:${'A'.repeat(35)}`

const START_RESPONSE = {
  deep_link: 'https://t.me/BotFather?start=abc',
  expires_at: EXPIRES_AT,
  pairing_id: 'pair-1',
  qr_payload: 'tg://resolve?domain=BotFather&start=abc',
  suggested_username: 'work4you_bot'
}

const READY = { bot_username: 'work4you_bot', expires_at: EXPIRES_AT, owner_user_id: '4242', status: 'ready' as const }

beforeEach(() => {
  startTelegramOnboarding.mockResolvedValue(START_RESPONSE)
  getTelegramOnboardingStatus.mockResolvedValue({ expires_at: EXPIRES_AT, status: 'waiting' })
  cancelTelegramOnboarding.mockResolvedValue({ ok: true })
  applyTelegramOnboarding.mockResolvedValue({
    needs_restart: false,
    ok: true,
    platform: 'telegram',
    restart_started: true
  })
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'telegram' })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({ onApplied = vi.fn(), onDone = vi.fn(), scopeProfile = null as null | string } = {}) {
  const { TelegramConnectSteps } = await import('./telegram-connect-steps')

  await act(async () => {
    render(
      <TelegramConnectSteps
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

/** Past the QR: polling reports the bot made, Next unlocked. */
async function waitForBot() {
  expect(await screen.findByText(s.created('work4you_bot'), {}, { timeout: 4000 })).toBeTruthy()
  expect(nextButton().disabled).toBe(false)
}

describe('TelegramConnectSteps', () => {
  it('asks who will use the bot first, then shows the QR that creates it', async () => {
    await renderSteps()

    expect(screen.getByText(s.whoTitle)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)
    expect(startTelegramOnboarding).not.toHaveBeenCalled()

    choose(new RegExp(s.othersTitle))
    await next()

    expect(startTelegramOnboarding).toHaveBeenCalledWith('Work4You')
    const qr = await screen.findByAltText(en.messaging.telegramQuickSetup.qrAlt)
    expect(qr.getAttribute('src')).toBe('data:image/png;base64,fake-qr')
    expect(screen.getByText(s.stepTalk)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    // Both ways to the deep link go through the validated external opener — a
    // raw anchor would let Electron try to resolve tg:// itself.
    fireEvent.click(screen.getByRole('button', { name: s.createStep1Link }))
    fireEvent.click(screen.getByRole('button', { name: en.messaging.telegramQuickSetup.openTelegram }))
    expect(openExternalLink).toHaveBeenCalledTimes(2)
    expect(openExternalLink).toHaveBeenCalledWith(START_RESPONSE.deep_link)
  })

  it('saves "just me" right after the bot exists, allowing the owner Telegram reported', async () => {
    getTelegramOnboardingStatus.mockResolvedValue(READY)
    const { onApplied, onDone } = await renderSteps({ scopeProfile: 'work' })

    choose(new RegExp(s.meTitle))
    await next()
    await waitForBot()

    // The owner is known, so there is nothing to ask about who can talk.
    expect(screen.queryByText(s.stepTalk)).toBeNull()
    await next()
    await throughDeliver()

    await waitFor(() => expect(applyTelegramOnboarding).toHaveBeenCalledWith('pair-1', ['4242'], 'work', home('4242')))
    expect(onApplied).toHaveBeenCalled()
    expect(await screen.findByText(s.readySetUp)).toBeTruthy()
    // The bot's handle is set in bold inside the line.
    expect(screen.getByText('@work4you_bot').closest('li')?.textContent).toBe(shown(s.checkCreated('work4you_bot')))
    expect(screen.getByText(s.whoMe)).toBeTruthy()
    expect(await screen.findByText(en.messaging.channelSteps.checkRestarted, {}, { timeout: 4000 })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: s.openInTelegram }))
    expect(openExternalLink).toHaveBeenCalledWith('https://t.me/work4you_bot')

    fireEvent.click(screen.getByRole('button', { name: en.common.done }))
    expect(onDone).toHaveBeenCalled()
  })

  it('asks for the ID when Telegram did not report who made the bot', async () => {
    getTelegramOnboardingStatus.mockResolvedValue({ ...READY, owner_user_id: undefined })
    await renderSteps()

    choose(new RegExp(s.meTitle))
    await next()
    await waitForBot()
    expect(screen.getByText(s.stepTalk)).toBeTruthy()
    await next()

    expect(screen.getByText(s.meIdTitle)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.meIdLabel), { target: { value: '@carla' } })
    await next()
    expect(screen.getByText(en.messaging.envErrors.telegramUserId('@carla'))).toBeTruthy()
    expect(applyTelegramOnboarding).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(s.meIdLabel), { target: { value: '777' } })
    await next()
    await throughDeliver()
    await waitFor(() => expect(applyTelegramOnboarding).toHaveBeenCalledWith('pair-1', ['777'], null, home('777')))
  })

  it('lists who can talk for other people, starting from the owner, and needs at least one', async () => {
    getTelegramOnboardingStatus.mockResolvedValue(READY)
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    await waitForBot()
    await next()

    expect(screen.getByText(s.talkTitle)).toBeTruthy()
    const list = screen.getByLabelText(s.idsLabel) as HTMLInputElement
    expect(list.value).toBe('4242')
    expect(screen.getByText(/Your ID came from the setup/)).toBeTruthy()

    fireEvent.change(list, { target: { value: ' ' } })
    await next()
    expect(screen.getByText(s.idsRequired)).toBeTruthy()

    fireEvent.change(list, { target: { value: '4242, 99, 4242' } })
    await next()
    await throughDeliver()

    await waitFor(() =>
      expect(applyTelegramOnboarding).toHaveBeenCalledWith('pair-1', ['4242', '99'], null, home('4242'))
    )
    expect(await screen.findByText(s.whoList(2))).toBeTruthy()
  })

  it('takes a @BotFather token instead, saved through the channel update with a restart', async () => {
    await renderSteps({ scopeProfile: 'work' })

    choose(new RegExp(s.othersTitle))
    await next()
    await screen.findByAltText(en.messaging.telegramQuickSetup.qrAlt)
    await click(s.useToken)

    // The QR session is let go server-side.
    expect(cancelTelegramOnboarding).toHaveBeenCalledWith('pair-1')
    expect(screen.getByText(s.tokenTitle)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: '123456789' } })
    await next()
    expect(screen.getByText(en.messaging.envErrors.telegramToken)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: VALID_TOKEN } })
    await next()

    // A token says nothing about the person: approving by code is an answer.
    choose(new RegExp(en.messaging.channelSettings.approveTitle))
    await next()
    await throughDeliver('424242424')

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'telegram',
        {
          clear_env: ['TELEGRAM_ALLOWED_USERS'],
          enabled: true,
          env: { TELEGRAM_BOT_TOKEN: VALID_TOKEN },
          home_channel: home('424242424')
        },
        'work'
      )
    )
    expect(restartGateway).toHaveBeenCalled()
    expect(await screen.findByText(s.checkTokenSaved)).toBeTruthy()
    expect(screen.getByText(s.whoApprove)).toBeTruthy()
    expect(await screen.findByText(en.messaging.channelSteps.checkRestarted, {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: s.openInTelegram })).toBeNull()
  })

  it('saves the token with the listed ids when other people are on a list', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    await click(s.useToken)
    fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: VALID_TOKEN } })
    await next()

    fireEvent.change(screen.getByLabelText(s.idsLabel), { target: { value: '11, 22' } })
    await next()
    await throughDeliver()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'telegram',
        {
          enabled: true,
          env: { TELEGRAM_ALLOWED_USERS: '11,22', TELEGRAM_BOT_TOKEN: VALID_TOKEN },
          home_channel: home('11')
        },
        null
      )
    )
  })

  it('returns to the screen it left, with the error, when the save fails', async () => {
    getTelegramOnboardingStatus.mockResolvedValue(READY)
    applyTelegramOnboarding.mockRejectedValue(new Error('500 boom'))
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    await waitForBot()
    await next()
    await next()
    await throughDeliver()

    expect(await screen.findByText('500 boom')).toBeTruthy()
    expect(screen.getByText(hd.title)).toBeTruthy()
  })

  it('starts again from an expired QR with Try again', async () => {
    getTelegramOnboardingStatus.mockRejectedValue(new Error('410: Telegram setup expired'))
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()

    expect(await screen.findByText(en.messaging.telegramQuickSetup.sessionExpired, {}, { timeout: 4000 })).toBeTruthy()
    await click(en.messaging.channelSteps.tryAgain)
    expect(startTelegramOnboarding).toHaveBeenCalledTimes(2)
  })

  it('reports a failed gateway restart on the ready screen with a restart action', async () => {
    getTelegramOnboardingStatus.mockResolvedValue(READY)
    getActionStatus.mockResolvedValue({ exit_code: 1, running: false })
    await renderSteps()

    choose(new RegExp(s.meTitle))
    await next()
    await waitForBot()
    await next()
    await throughDeliver()

    expect(await screen.findByText(en.messaging.channelSteps.checkRestartFailed(1), {}, { timeout: 4000 })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Restart gateway/ }))
    expect(runGatewayRestart).toHaveBeenCalled()
  })
})
