import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authorizeConnector, bootstrapConnectors, waitConnector } = vi.hoisted(() => ({
  authorizeConnector: vi.fn(async () => ({
    redirect_url: 'https://connect.example/gmail',
    connection_id: 'ca-gmail'
  })),
  bootstrapConnectors: vi.fn(async () => ({ ok: true })),
  waitConnector: vi.fn(async () => ({ connected: true }))
}))

vi.mock('@/api/mcp', () => ({
  authorizeConnector,
  bootstrapConnectors,
  waitConnector
}))

describe('connectWork4YouApp', () => {
  beforeEach(() => {
    bootstrapConnectors.mockClear()
    authorizeConnector.mockClear()
    waitConnector.mockClear()
  })

  it('scopes bootstrap/authorize/wait to the session profile and waits on this connection_id', async () => {
    const { connectWork4YouApp } = await import('./composio-connect')

    const ok = await connectWork4YouApp('gmail', {
      open: () => undefined,
      profile: 'tester'
    })

    expect(ok).toBe(true)
    expect(bootstrapConnectors).toHaveBeenCalledWith('tester')
    expect(authorizeConnector).toHaveBeenCalledWith('gmail', 'tester')
    expect(waitConnector).toHaveBeenCalledWith('gmail', 'tester', 'ca-gmail')
  })
})
