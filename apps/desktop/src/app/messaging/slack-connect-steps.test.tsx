// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'

const updateMessagingPlatform = vi.fn()
const getSlackManifest = vi.fn()
const restartGateway = vi.fn()
const getActionStatus = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()
const writeText = vi.fn()

vi.mock('@/work4you', () => ({
  getActionStatus: () => getActionStatus(),
  getSlackManifest: () => getSlackManifest(),
  restartGateway: () => restartGateway(),
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

const s = en.messaging.slackPage
const MANIFEST = { display_information: { name: 'Work4You' } }

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'slack' })
  getSlackManifest.mockResolvedValue({ manifest: MANIFEST })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({ scopeProfile = null as null | string } = {}) {
  const { SlackConnectSteps } = await import('./slack-connect-steps')
  const onApplied = vi.fn()
  const onDone = vi.fn()

  await act(async () => {
    render(
      <SlackConnectSteps onApplied={onApplied} onDone={onDone} platformConnected={false} scopeProfile={scopeProfile} />
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

async function reachTokens(audience: RegExp) {
  choose(audience)
  await next()
  await next()
}

async function reachWhoCanTalk(audience: RegExp) {
  await reachTokens(audience)
  fireEvent.change(screen.getByLabelText(s.botTokenLabel), { target: { value: 'xoxb-1-2-abc' } })
  fireEvent.change(screen.getByLabelText(s.appTokenLabel), { target: { value: 'xapp-1-A0-xyz' } })
  await next()
}

describe('SlackConnectSteps', () => {
  it('creates the app from the generated manifest', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()

    expect(screen.getByText(s.createTitle)).toBeTruthy()
    expect(screen.getByText('From a manifest', { selector: 'b' })).toBeTruthy()

    await click(s.copyManifest)
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(MANIFEST, null, 2))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', message: s.manifestCopied }))

    fireEvent.click(screen.getByRole('button', { name: s.createApp }))
    expect(openExternalLink).toHaveBeenCalledWith('https://api.slack.com/apps?new_app=1')
  })

  it('needs both tokens with their own prefixes before going on', async () => {
    await renderSteps()
    await reachTokens(new RegExp(s.othersTitle))

    expect(nextButton().disabled).toBe(true)

    // The two tokens swapped: each field says which prefix it wants.
    fireEvent.change(screen.getByLabelText(s.botTokenLabel), { target: { value: 'xapp-1-A0-xyz' } })
    fireEvent.change(screen.getByLabelText(s.appTokenLabel), { target: { value: 'xoxb-1-2-abc' } })
    expect(screen.getByText(en.messaging.envErrors.slackTokenPrefix('xoxb-'))).toBeTruthy()
    expect(screen.getByText(en.messaging.envErrors.slackTokenPrefix('xapp-'))).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(s.botTokenLabel), { target: { value: 'xoxb-1-2-abc' } })
    fireEvent.change(screen.getByLabelText(s.appTokenLabel), { target: { value: 'xapp-1-A0-xyz' } })
    expect(nextButton().disabled).toBe(false)
  })

  it('saves both tokens with the listed members, turns the channel on and restarts', async () => {
    const { onApplied } = await renderSteps({ scopeProfile: 'work' })
    await reachWhoCanTalk(new RegExp(s.othersTitle))

    const list = screen.getByLabelText(en.messaging.channelSettings.listTitle)
    fireEvent.change(list, { target: { value: 'U01ABC2DEF3, ana' } })
    await next()
    expect(screen.getByText(en.messaging.envErrors.slackMemberId('ana'))).toBeTruthy()

    fireEvent.change(list, { target: { value: 'U01ABC2DEF3, U04XYZ9GHI7' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'slack',
        {
          enabled: true,
          env: {
            SLACK_ALLOWED_USERS: 'U01ABC2DEF3,U04XYZ9GHI7',
            SLACK_APP_TOKEN: 'xapp-1-A0-xyz',
            SLACK_BOT_TOKEN: 'xoxb-1-2-abc'
          }
        },
        'work'
      )
    )
    expect(onApplied).toHaveBeenCalled()
    expect(restartGateway).toHaveBeenCalled()
    expect(await screen.findByText(s.checkTokensSaved)).toBeTruthy()
    expect(screen.getByText(s.whoList(2))).toBeTruthy()
    expect(await screen.findByText(en.messaging.channelSteps.checkRestarted, {}, { timeout: 4000 })).toBeTruthy()
  })

  it('lets the whole workspace in with the allowlist wildcard', async () => {
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.othersTitle))

    choose(new RegExp(s.everyoneTitle))
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'slack',
        expect.objectContaining({ env: expect.objectContaining({ SLACK_ALLOWED_USERS: '*' }) }),
        null
      )
    )
    expect(await screen.findByText(s.whoEveryone)).toBeTruthy()
  })

  it('asks for the own member ID when it is just the person', async () => {
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.meTitle))

    expect(screen.getByText(s.meIdTitle)).toBeTruthy()
    await next()
    expect(screen.getByText(s.idsRequired)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.meIdLabel), { target: { value: 'U01ABC2DEF3' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'slack',
        expect.objectContaining({ env: expect.objectContaining({ SLACK_ALLOWED_USERS: 'U01ABC2DEF3' }) }),
        null
      )
    )
    expect(await screen.findByText(s.whoMe)).toBeTruthy()
  })
})
