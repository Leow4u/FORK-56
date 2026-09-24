import { beforeEach, describe, expect, it } from 'vitest'

import { accountMcpEntries, accountMcpToInstall, mcpIsDeviceServer, rememberAccountMcp } from './mcp-home'

describe('mcp home', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps a local process on this device and shares http, gmail, and drive', () => {
    expect(mcpIsDeviceServer('files', { command: 'npx' })).toBe(true)
    expect(mcpIsDeviceServer('docs', { url: 'https://mcp.example/mcp' })).toBe(false)
    expect(mcpIsDeviceServer('gmail', { command: 'npx' })).toBe(false)
    expect(mcpIsDeviceServer('googledrive', { url: 'https://drive.example' })).toBe(false)
  })

  it('installs a remembered account server that this connection does not have', () => {
    rememberAccountMcp([{ name: 'gmail', url: 'https://gmail.example' }])
    rememberAccountMcp(accountMcpEntries({ notes: { url: 'https://notes.example' }, files: { command: 'npx' } }))

    expect(accountMcpToInstall({ notes: {} }, readCatalog()).map(entry => entry.name)).toEqual(['gmail'])
  })
})

function readCatalog() {
  return JSON.parse(localStorage.getItem('work4you.account-mcp') || '[]') as Array<{ name: string }>
}
