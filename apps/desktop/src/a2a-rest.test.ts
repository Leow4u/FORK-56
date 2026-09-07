import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createA2AAgent, deleteA2AAgent, getA2AAgents } from './work4you'

describe('A2A peer REST helpers', () => {
  let api: ReturnType<typeof vi.fn>

  beforeEach(() => {
    api = vi.fn().mockResolvedValue({})
    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: { api }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'work4youDesktop')
  })

  it('lists peers from the profile-scoped endpoint', async () => {
    await getA2AAgents('work')

    expect(api).toHaveBeenCalledWith(expect.objectContaining({ path: '/api/a2a/agents', profile: 'work' }))
  })

  it('creates a peer without echoing the token in the client helper', async () => {
    const body = { name: 'researcher', token: 'secret', url: 'http://research-box.local:9900' }

    await createA2AAgent(body, 'work')

    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { ...body, profile: 'work' },
        method: 'POST',
        path: '/api/a2a/agents',
        profile: 'work'
      })
    )
  })

  it('deletes a peer by name', async () => {
    await deleteA2AAgent('researcher', 'work')

    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        path: '/api/a2a/agents/researcher',
        profile: 'work'
      })
    )
  })
})
