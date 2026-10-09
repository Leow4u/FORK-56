import { afterEach, describe, expect, it, vi } from 'vitest'

const startGhLogin = vi.fn()
const pollGhLogin = vi.fn()
const cancelGhLogin = vi.fn()

vi.mock('@/api/system', () => ({
  startGhLogin: (...args: unknown[]) => startGhLogin(...args),
  pollGhLogin: (...args: unknown[]) => pollGhLogin(...args),
  cancelGhLogin: (...args: unknown[]) => cancelGhLogin(...args)
}))

const START = {
  session_id: 'sid-1',
  user_code: 'WXYZ-9876',
  verification_url: 'https://github.com/login/device',
  expires_in: 899,
  poll_interval: 5
}

const poll = (status: string, extra: Record<string, unknown> = {}) => ({
  session_id: 'sid-1',
  status,
  error_message: null,
  login: null,
  setup_git: null,
  ...extra
})

/** Manual interval: the test decides when a tick fires. */
function timers() {
  const ticks: Array<() => void> = []

  return {
    setInterval: ((cb: () => void) => {
      ticks.push(cb)

      return ticks.length
    }) as unknown as typeof window.setInterval,
    clearInterval: vi.fn() as unknown as typeof window.clearInterval,
    fire: async () => {
      for (const tick of ticks) {
        tick()
      }

      await Promise.resolve()
      await Promise.resolve()
    }
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('connectGhCli', () => {
  it('starts the flow, opens the verification page, and resolves once GitHub approves', async () => {
    const { connectGhCli } = await import('./gh-cli-connect')
    startGhLogin.mockResolvedValue(START)
    pollGhLogin.mockResolvedValueOnce(poll('pending')).mockResolvedValueOnce(poll('approved', { login: 'octocat' }))
    const open = vi.fn()
    const t = timers()

    const handle = await connectGhCli({ open, profile: 'coder', ...t })

    expect(startGhLogin).toHaveBeenCalledWith('coder')
    expect(open).toHaveBeenCalledWith('https://github.com/login/device')
    expect(handle.start.user_code).toBe('WXYZ-9876')

    await t.fire()
    expect(pollGhLogin).toHaveBeenCalledWith('sid-1', 'coder')
    await t.fire()

    const done = await handle.done
    expect(done.status).toBe('approved')
    expect(done.login).toBe('octocat')
    expect(t.clearInterval).toHaveBeenCalled()

    // Settled: further ticks never poll again.
    await t.fire()
    expect(pollGhLogin).toHaveBeenCalledTimes(2)
  })

  it('resolves denied / expired so the UI can show the backend message', async () => {
    const { connectGhCli } = await import('./gh-cli-connect')
    startGhLogin.mockResolvedValue(START)
    pollGhLogin.mockResolvedValueOnce(poll('denied', { error_message: 'Authorization was denied' }))
    const t = timers()

    const handle = await connectGhCli({ open: () => undefined, ...t })
    await t.fire()

    await expect(handle.done).resolves.toMatchObject({ status: 'denied', error_message: 'Authorization was denied' })
  })

  it('cancel stops polling, tells the backend, and settles the flow as cancelled', async () => {
    const { connectGhCli } = await import('./gh-cli-connect')
    startGhLogin.mockResolvedValue(START)
    pollGhLogin.mockResolvedValue(poll('pending'))
    cancelGhLogin.mockResolvedValue({ ok: true })
    const t = timers()

    const handle = await connectGhCli({ open: () => undefined, profile: 'coder', ...t })
    await t.fire()
    await handle.cancel()
    await handle.cancel() // idempotent

    expect(cancelGhLogin).toHaveBeenCalledTimes(1)
    expect(cancelGhLogin).toHaveBeenCalledWith('sid-1', 'coder')
    expect(t.clearInterval).toHaveBeenCalled()
    await expect(handle.done).resolves.toMatchObject({ status: 'error', error_message: 'cancelled' })

    await t.fire()
    expect(pollGhLogin).toHaveBeenCalledTimes(1)
  })

  it('does not strand the flow when the browser cannot be opened', async () => {
    const { connectGhCli } = await import('./gh-cli-connect')
    startGhLogin.mockResolvedValue(START)
    pollGhLogin.mockResolvedValueOnce(poll('approved', { login: 'octocat' }))
    const t = timers()

    const handle = await connectGhCli({
      open: () => {
        throw new Error('no browser')
      },
      ...t
    })

    await t.fire()

    await expect(handle.done).resolves.toMatchObject({ status: 'approved' })
  })

  it('rejects done on a transport failure while polling', async () => {
    const { connectGhCli } = await import('./gh-cli-connect')
    startGhLogin.mockResolvedValue(START)
    pollGhLogin.mockRejectedValueOnce(new Error('backend gone'))
    const t = timers()

    const handle = await connectGhCli({ open: () => undefined, ...t })
    await t.fire()

    await expect(handle.done).rejects.toThrow('backend gone')
  })
})

describe('isGhMissingError', () => {
  it('recognises the backend 409 detail in either shape', async () => {
    const { isGhMissingError } = await import('./gh-cli-connect')

    expect(isGhMissingError(new Error('409: {"detail":"gh_missing"}'))).toBe(true)
    expect(isGhMissingError('gh_missing')).toBe(true)
    expect(isGhMissingError(new Error('502 Bad Gateway'))).toBe(false)
    expect(isGhMissingError(null)).toBe(false)
  })
})
