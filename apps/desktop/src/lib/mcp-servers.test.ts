import { describe, expect, it } from 'vitest'

import { getServers, isServerShape, normalizeEntry, serverTransport, serverUsesOAuth } from './mcp-servers'

describe('serverTransport', () => {
  it('reads a url as HTTP and a command as stdio, like the loader', () => {
    expect(serverTransport({ url: 'https://mcp.notion.com/mcp' })).toBe('http')
    expect(serverTransport({ command: 'npx', args: ['-y', 'files-mcp'] })).toBe('stdio')
  })

  it('prefers the url when an entry carries both', () => {
    expect(serverTransport({ url: 'https://example.test/mcp', command: 'npx' })).toBe('http')
  })

  it('has no answer for an entry that is not a server', () => {
    expect(serverTransport({ enabled: false })).toBeNull()
    expect(isServerShape({ enabled: false })).toBe(false)
  })

  it('agrees with the pasted-config normalizer', () => {
    // Cursor/Claude write `type`; the transport is still inferred from url/command.
    expect(serverTransport(normalizeEntry({ type: 'sse', url: 'https://example.test/sse' }))).toBe('http')
  })
})

describe('serverUsesOAuth', () => {
  it('only flags explicit OAuth, never header or API-key auth', () => {
    expect(serverUsesOAuth({ url: 'https://example.test/mcp', auth: 'oauth' })).toBe(true)
    expect(serverUsesOAuth({ url: 'https://example.test/mcp', headers: { Authorization: 'Bearer x' } })).toBe(false)
    expect(serverUsesOAuth({ command: 'npx' })).toBe(false)
  })
})

describe('getServers', () => {
  it('returns the map, or an empty one for a missing or malformed section', () => {
    const servers = { notion: { url: 'https://mcp.notion.com/mcp' } }

    expect(getServers({ mcp_servers: servers })).toBe(servers)
    expect(getServers({})).toEqual({})
    expect(getServers({ mcp_servers: [] })).toEqual({})
    expect(getServers(null)).toEqual({})
  })
})
