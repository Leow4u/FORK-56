import {
  completeComposioConnect,
  composioAppsToSuggestible,
  composioAppSuggestKeywords,
  composioCdnUrlFromProtocolRequest,
  composioLogoImgSrc,
  type DirectoryApp,
  directoryAppDescription,
  directoryAppLogoUrl,
  filterDirectoryApps,
  findComposioDirectoryApp,
  groupDirectorySections,
  isTrustedComposioLogoUrl,
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

describe('composioAppSuggestKeywords', () => {
  it('uses the slug and display name, not short token splits', () => {
    expect(composioAppSuggestKeywords({ id: 'apollo', name: 'Apollo' })).toEqual(['apollo'])
    expect(composioAppSuggestKeywords({ id: 'canva', name: 'Canva' })).toEqual(['canva'])
    expect(composioAppSuggestKeywords({ id: 'granola_mcp', name: 'Granola' })).toEqual([
      'granola_mcp',
      'granola mcp',
      'granola'
    ])
  })
})

describe('findComposioDirectoryApp', () => {
  it('matches directory id or name case-insensitively and ignores native rows', () => {
    const apps = [
      app({ id: 'linear', name: 'Linear', source: 'native' }),
      app({ id: 'apollo', name: 'Apollo', source: 'composio', section: 'crm' })
    ]

    expect(findComposioDirectoryApp(apps, 'Apollo')?.id).toBe('apollo')
    expect(findComposioDirectoryApp(apps, 'linear')).toBeUndefined()
  })
})

describe('composioAppsToSuggestible', () => {
  it('suggests disconnected Work4You Apps and skips native collisions', () => {
    const apps = [
      app({ id: 'apollo', name: 'Apollo', source: 'composio', connected: false, section: 'crm' }),
      app({ id: 'gmail', name: 'Gmail', source: 'composio', connected: true }),
      app({ id: 'hubspot', name: 'HubSpot', source: 'composio', needs_login: true, section: 'crm' }),
      app({ id: 'slack', name: 'Slack', source: 'composio', connected: false })
    ]

    const suggestible = composioAppsToSuggestible(apps, new Set(['slack']))

    expect(suggestible.map(row => row.server)).toEqual(['apollo'])
    expect(suggestible[0]?.source).toBe('composio')
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

describe('directoryAppLogoUrl', () => {
  it('uses the Composio CDN for Work4You Apps rows', () => {
    expect(directoryAppLogoUrl({ id: 'gmail', source: 'composio' })).toBe(
      'https://logos.composio.dev/api/gmail'
    )
    expect(directoryAppLogoUrl({ id: 'granola_mcp', source: 'composio' })).toBe(
      'https://logos.composio.dev/api/granola_mcp'
    )
  })

  it('uses the Composio CDN for catalog rows and never for custom MCP', () => {
    expect(directoryAppLogoUrl({ id: 'gmail', source: 'composio' })).toBe(
      'https://logos.composio.dev/api/gmail'
    )
    expect(directoryAppLogoUrl({ id: 'n8n', source: 'native' })).toBe(
      'https://logos.composio.dev/api/n8n'
    )
    expect(
      directoryAppLogoUrl({
        id: 'gmail',
        source: 'native',
        logo: 'https://logos.composio.dev/api/gmail'
      })
    ).toBe('https://logos.composio.dev/api/gmail')
    expect(
      directoryAppLogoUrl({
        id: 'my-box',
        source: 'custom',
        logo: 'https://logos.composio.dev/api/gmail'
      })
    ).toBeNull()
  })

  it('rejects untrusted broker logo URLs and falls back to the CDN', () => {
    expect(
      directoryAppLogoUrl({
        id: 'hubspot',
        source: 'composio',
        logo: 'https://evil.example/x.png'
      })
    ).toBe('https://logos.composio.dev/api/hubspot')
    expect(isTrustedComposioLogoUrl('https://evil.example/x.png')).toBe(false)
    expect(isTrustedComposioLogoUrl('https://logos.composio.dev/api/gmail')).toBe(true)
    expect(isTrustedComposioLogoUrl('https://logos.composio.dev/api/')).toBe(false)
  })

  it('maps file:// origins onto the privileged Electron logo scheme', () => {
    expect(composioLogoImgSrc('https://logos.composio.dev/api/gmail', 'http:')).toBe(
      'https://logos.composio.dev/api/gmail'
    )
    expect(composioLogoImgSrc('https://logos.composio.dev/api/n8n', 'file:')).toBe(
      'work4you-logo://mark/n8n'
    )
    expect(composioLogoImgSrc('https://evil.example/x.png', 'file:')).toBeNull()
    expect(composioCdnUrlFromProtocolRequest('work4you-logo://mark/gmail')).toBe(
      'https://logos.composio.dev/api/gmail'
    )
    expect(composioCdnUrlFromProtocolRequest('work4you-logo://mark/unreal-engine')).toBe(
      'https://logos.composio.dev/api/unreal-engine'
    )
  })
})
