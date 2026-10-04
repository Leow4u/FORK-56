import { afterEach, describe, expect, it, vi } from 'vitest'

const restartGateway = vi.fn()
const getActionStatus = vi.fn()
const notifyError = vi.fn()

vi.mock('@/work4you', () => ({
  getActionStatus: (name: string, lines: number, profile?: string) => getActionStatus(name, lines, profile),
  restartGateway: (profile?: string) => restartGateway(profile)
}))

vi.mock('@/i18n', () => ({ translateNow: (key: string) => key }))

vi.mock('@/store/notifications', () => ({ notifyError: (...args: unknown[]) => notifyError(...args) }))

const settled = { exit_code: 0, lines: [], name: 'gateway-restart', pid: 7, running: false }

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

async function run(profile?: null | string) {
  const { runGatewayRestart } = await import('./system-actions')
  const done = runGatewayRestart(profile)

  await vi.runAllTimersAsync()
  await done
}

describe('runGatewayRestart', () => {
  it('restarts and polls the gateway of the profile it is given', async () => {
    vi.useFakeTimers()
    restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 7 })
    getActionStatus.mockResolvedValue(settled)

    await run('work')

    expect(restartGateway).toHaveBeenCalledWith('work')
    expect(getActionStatus).toHaveBeenCalledWith('gateway-restart', 180, 'work')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it("restarts the app's active profile without one", async () => {
    vi.useFakeTimers()
    restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 7 })
    getActionStatus.mockResolvedValue(settled)

    await run()
    await run(null)

    expect(restartGateway.mock.calls).toEqual([[undefined], [undefined]])
    expect(getActionStatus).toHaveBeenCalledWith('gateway-restart', 180, undefined)
  })

  it('toasts a restart that failed', async () => {
    vi.useFakeTimers()
    restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 7 })
    getActionStatus.mockResolvedValue({ ...settled, exit_code: 1 })

    await run('work')

    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})
