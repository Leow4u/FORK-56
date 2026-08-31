import { describe, expect, it } from 'vitest'

import {
  mcpCatalogPrimaryAction,
  mcpDirectoryQueryHit,
  mcpDirectoryShowsAvailable,
  mcpDirectoryShowsConnected
} from './mcp-directory-filter'

describe('mcpDirectoryQueryHit', () => {
  it('matches any field case-insensitively', () => {
    expect(mcpDirectoryQueryHit(['Linear', 'issues and projects'], 'linear')).toBe(true)
    expect(mcpDirectoryQueryHit(['Linear', 'issues and projects'], 'PROJECT')).toBe(true)
    expect(mcpDirectoryQueryHit(['Linear', 'issues and projects'], 'gmail')).toBe(false)
  })

  it('treats an empty query as a match', () => {
    expect(mcpDirectoryQueryHit(['Linear'], '  ')).toBe(true)
    expect(mcpDirectoryQueryHit([null, undefined], '')).toBe(true)
  })
})

describe('mcpDirectoryShowsConnected / available', () => {
  it('all shows both sections', () => {
    expect(mcpDirectoryShowsConnected('all')).toBe(true)
    expect(mcpDirectoryShowsAvailable('all')).toBe(true)
  })

  it('connected hides the catalog section', () => {
    expect(mcpDirectoryShowsConnected('connected')).toBe(true)
    expect(mcpDirectoryShowsAvailable('connected')).toBe(false)
  })

  it('available hides the installed section', () => {
    expect(mcpDirectoryShowsConnected('available')).toBe(false)
    expect(mcpDirectoryShowsAvailable('available')).toBe(true)
  })
})

describe('mcpCatalogPrimaryAction', () => {
  it('labels oauth catalog entries Connect and everything else Install', () => {
    expect(mcpCatalogPrimaryAction('oauth')).toBe('connect')
    expect(mcpCatalogPrimaryAction('api_key')).toBe('install')
    expect(mcpCatalogPrimaryAction('none')).toBe('install')
    expect(mcpCatalogPrimaryAction(undefined)).toBe('install')
  })
})
