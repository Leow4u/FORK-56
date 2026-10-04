// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

const testMessagingPlatform = vi.fn()
const restartGateway = vi.fn()
const getActionStatus = vi.fn()

vi.mock('@/work4you', () => ({
  getActionStatus: (name: string, lines: number, profile?: string) => getActionStatus(name, lines, profile),
  restartGateway: (profile?: string) => restartGateway(profile),
  testMessagingPlatform: (id: string, profile?: null | string) => testMessagingPlatform(id, profile)
}))

vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

vi.mock('@/store/system-actions', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $gatewayRestarting: atom(false), runGatewayRestart: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('Marked', () => {
  it('sets marked words in bold and quoted commands in code, keeping the sentence whole', async () => {
    const { Marked } = await import('./channel-steps')

    const { container } = render(<Marked text="Run `teams status` in **Bot** › **Settings** now." />)

    expect(container.textContent).toBe('Run teams status in Bot › Settings now.')
    expect(screen.getByText('teams status', { selector: 'code' })).toBeTruthy()
    expect(screen.getByText('Bot', { selector: 'b' })).toBeTruthy()
    expect(screen.getByText('Settings', { selector: 'b' })).toBeTruthy()
  })
})

describe('testUntilOk', () => {
  it('tries again while the adapter comes up and stops at the first pass', async () => {
    vi.useFakeTimers()
    const { testUntilOk } = await import('./channel-steps')
    testMessagingPlatform
      .mockRejectedValueOnce(new Error('503 starting'))
      .mockResolvedValueOnce({ message: 'Listener is up.', ok: true })

    const check = testUntilOk('teams', 'work', 3)
    await vi.runAllTimersAsync()

    await expect(check).resolves.toEqual({ message: 'Listener is up.', outcome: 'ok' })
    expect(testMessagingPlatform).toHaveBeenCalledTimes(2)
    expect(testMessagingPlatform).toHaveBeenCalledWith('teams', 'work')
  })

  it('gives up with the last explanation after the attempts', async () => {
    vi.useFakeTimers()
    const { testUntilOk } = await import('./channel-steps')
    testMessagingPlatform.mockResolvedValue({ message: 'Nothing answered on 127.0.0.1:3978.', ok: false })

    const check = testUntilOk('teams', null, 3)
    await vi.runAllTimersAsync()

    await expect(check).resolves.toEqual({ message: 'Nothing answered on 127.0.0.1:3978.', outcome: 'failed' })
    expect(testMessagingPlatform).toHaveBeenCalledTimes(3)
  })
})

describe('restartAndWatch', () => {
  const settled = { exit_code: 0, lines: [], name: 'gateway-restart', pid: 7, running: false }

  it('restarts and watches the gateway of the profile being configured', async () => {
    vi.useFakeTimers()
    restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 7 })
    getActionStatus.mockResolvedValue(settled)
    const { restartAndWatch } = await import('./channel-steps')

    const restarted = restartAndWatch('work')
    await vi.runAllTimersAsync()

    await expect(restarted).resolves.toEqual({ outcome: 'ok' })
    expect(restartGateway).toHaveBeenCalledWith('work')
    expect(getActionStatus).toHaveBeenCalledWith('gateway-restart', 5, 'work')
  })

  it("follows the app's active profile when none is being configured", async () => {
    vi.useFakeTimers()
    restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 7 })
    getActionStatus.mockResolvedValue(settled)
    const { restartAndWatch } = await import('./channel-steps')

    const restarted = restartAndWatch(null)
    await vi.runAllTimersAsync()
    await restarted

    expect(restartGateway).toHaveBeenCalledWith(undefined)
    expect(getActionStatus).toHaveBeenCalledWith('gateway-restart', 5, undefined)
  })

  it('reports the exit code of a restart that failed for that profile', async () => {
    vi.useFakeTimers()
    restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 7 })
    getActionStatus.mockResolvedValue({ ...settled, exit_code: 1 })
    const { restartAndWatch } = await import('./channel-steps')

    const restarted = restartAndWatch('work')
    await vi.runAllTimersAsync()

    await expect(restarted).resolves.toEqual({ exitCode: 1, outcome: 'failed' })
  })
})

describe('RestartLine', () => {
  it('restarts the profile being configured from the manual restart', async () => {
    const { runGatewayRestart } = await import('@/store/system-actions')
    const { RestartLine } = await import('./channel-steps')

    render(<RestartLine restart={{ exitCode: 1, outcome: 'failed' }} scopeProfile="work" />)
    fireEvent.click(screen.getByRole('button', { name: /restart gateway/i }))

    expect(runGatewayRestart).toHaveBeenCalledWith('work')
  })
})
