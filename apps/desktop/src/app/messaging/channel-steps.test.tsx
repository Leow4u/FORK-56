// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

const testMessagingPlatform = vi.fn()

vi.mock('@/work4you', () => ({
  getActionStatus: vi.fn(),
  restartGateway: vi.fn(),
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
