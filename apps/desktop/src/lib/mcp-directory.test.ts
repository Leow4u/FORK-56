import {
  completeComposioConnect,
  type DirectoryApp,
  directoryAppDescription,
  filterDirectoryApps,
  groupDirectorySections,
  mcpCatalogPrimaryAction,
  mcpDirectoryQueryHit,
  mcpDirectoryShowsAvailable,
  mcpDirectoryShowsConnected
} from '@work4you/shared'
import { describe, expect, it } from 'vitest'

function app(partial: Partial<DirectoryApp> & Pick<DirectoryApp, 'id' | 'name' | 'source'>): DirectoryApp {
  return {
    description: `${partial.name} app`,
    section: 'email',
    popular: false,
    connected: false,
    auth_type: 'oauth',
    ...partial
  }
}

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
  it('all and discover show both', () => {
    expect(mcpDirectoryShowsConnected('all')).toBe(true)
    expect(mcpDirectoryShowsAvailable('all')).toBe(true)
    expect(mcpDirectoryShowsConnected('discover')).toBe(true)
    expect(mcpDirectoryShowsAvailable('discover')).toBe(true)
  })

  it('connected hides available', () => {
    expect(mcpDirectoryShowsConnected('connected')).toBe(true)
    expect(mcpDirectoryShowsAvailable('connected')).toBe(false)
  })

  it('available hides connected', () => {
    expect(mcpDirectoryShowsConnected('available')).toBe(false)
    expect(mcpDirectoryShowsAvailable('available')).toBe(true)
  })
})

describe('mcpCatalogPrimaryAction', () => {
  it('labels oauth Connect and everything else Install', () => {
    expect(mcpCatalogPrimaryAction('oauth')).toBe('connect')
    expect(mcpCatalogPrimaryAction('api_key')).toBe('install')
    expect(mcpCatalogPrimaryAction(undefined)).toBe('install')
  })
})

describe('filterDirectoryApps', () => {
  const apps = [
    app({ id: 'gmail', name: 'Gmail', source: 'composio', popular: true, connected: true }),
    app({ id: 'notion', name: 'Notion', source: 'native', section: 'productivity', connected: false }),
    app({ id: 'work4you_apps', name: 'Apps', source: 'native', connected: true })
  ]

  it('hides the work4you_apps runtime server', () => {
    const visible = filterDirectoryApps(apps, { filter: 'all', query: '', section: null })
    expect(visible.map(row => row.id)).toEqual(['gmail', 'notion'])
  })

  it('connected filter drops unconnected apps', () => {
    const visible = filterDirectoryApps(apps, { filter: 'connected', query: '', section: null })
    expect(visible.map(row => row.id)).toEqual(['gmail'])
  })
})

describe('groupDirectorySections', () => {
  it('pins popular apps and still lists them in their type section', () => {
    const groups = groupDirectorySections([
      app({ id: 'gmail', name: 'Gmail', source: 'composio', popular: true, section: 'email' }),
      app({ id: 'hubspot', name: 'HubSpot', source: 'composio', section: 'crm', popular: true }),
      app({ id: 'custom-1', name: 'Mine', source: 'custom', section: 'other' })
    ])

    expect(groups[0]?.id).toBe('popular')
    expect(groups[0]?.apps.map(row => row.id)).toEqual(['gmail', 'hubspot'])
    const email = groups.find(group => group.id === 'email')
    expect(email?.apps.map(row => row.id)).toEqual(['gmail'])
    expect(groups.at(-1)?.id).toBe('custom')
  })
})

describe('completeComposioConnect', () => {
  it('opens the vendor redirect and does not call native MCP auth', async () => {
    const opened: string[] = []

    const connected = await completeComposioConnect({
      authorize: async () => ({ redirect_url: 'https://connect.example/hubspot' }),
      wait: async () => ({ connected: true }),
      open: url => {
        opened.push(url)
      }
    })

    expect(connected).toBe(true)
    expect(opened).toEqual(['https://connect.example/hubspot'])
  })

  it('retries wait once when the first poll is still pending', async () => {
    let waits = 0

    const connected = await completeComposioConnect({
      authorize: async () => ({ redirect_url: 'https://connect.example/slack' }),
      wait: async () => {
        waits += 1

        return { connected: waits > 1 }
      },
      open: () => undefined,
      sleep: async () => undefined
    })

    expect(connected).toBe(true)
    expect(waits).toBe(2)
  })
})

describe('directoryAppDescription', () => {
  it('adds the Instagram Business/Creator note', () => {
    expect(
      directoryAppDescription({
        description: 'Publish to Instagram.',
        notes: 'instagram_business_creator'
      })
    ).toBe('Publish to Instagram. Instagram Business or Creator only.')
  })
})
