/** Unified MCP / Work4You Apps directory helpers (desktop + web). */

export type McpDirectoryFilter = 'discover' | 'all' | 'connected' | 'available'

export const DIRECTORY_SECTION_IDS = [
  'developer',
  'data',
  'finance',
  'crm',
  'marketing',
  'social',
  'email',
  'productivity',
  'files',
  'communication',
  'ai',
  'other'
] as const

export type DirectorySectionId = (typeof DIRECTORY_SECTION_IDS)[number]

export const DIRECTORY_SECTION_LABELS: Record<DirectorySectionId | 'popular' | 'custom', string> = {
  popular: 'Popular',
  developer: 'Developer',
  data: 'Data',
  finance: 'Finance',
  crm: 'CRM',
  marketing: 'Marketing',
  social: 'Social',
  email: 'Email',
  productivity: 'Productivity',
  files: 'Files',
  communication: 'Communication',
  ai: 'AI',
  other: 'Other',
  custom: 'Your servers'
}

export const HIDDEN_DIRECTORY_IDS = new Set(['work4you_apps'])

export interface DirectoryApp {
  id: string
  name: string
  description: string
  section: string
  popular: boolean
  source: 'native' | 'composio' | 'custom'
  connected: boolean
  auth_type?: string
  needs_login?: boolean
  notes?: string | null
  required_env?: { name: string; prompt: string; required: boolean }[]
  needs_install?: boolean
  installed?: boolean
  enabled?: boolean
  /** Official toolkit mark from logos.composio.dev. Custom MCP URLs never carry one. */
  logo?: string | null
}

/** Official toolkit marks Composio already hosts. Not a favicon service. */
export const COMPOSIO_LOGOS_ORIGIN = 'https://logos.composio.dev'

/** Privileged Electron scheme so a file:// renderer can paint those marks. */
export const COMPOSIO_LOGO_PROTOCOL = 'work4you-logo'

export function composioToolkitLogoUrl(slug: string): string {
  const safe = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')

  return safe ? `${COMPOSIO_LOGOS_ORIGIN}/api/${encodeURIComponent(safe)}` : ''
}

export function isTrustedComposioLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'logos.composio.dev' &&
      parsed.pathname.startsWith('/api/') &&
      parsed.pathname.length > '/api/'.length &&
      !parsed.pathname.includes('..')
    )
  } catch {
    return false
  }
}

/**
 * Remote mark for catalog rows (native MCP + Work4You Apps). Custom servers
 * never get one: a private MCP URL must not leak off-box via a favicon fetch.
 * Native ids are public slugs (`figma`, `n8n`), not hosts.
 */
export function directoryAppLogoUrl(app: Pick<DirectoryApp, 'id' | 'source' | 'logo'>): string | null {
  if (app.source === 'custom') {
    return null
  }

  if (typeof app.logo === 'string' && isTrustedComposioLogoUrl(app.logo)) {
    return app.logo
  }

  const derived = composioToolkitLogoUrl(app.id)

  return derived && isTrustedComposioLogoUrl(derived) ? derived : null
}

export function composioLogoProtocolUrl(cdnUrl: string): string | null {
  if (!isTrustedComposioLogoUrl(cdnUrl)) {
    return null
  }

  const slug = new URL(cdnUrl).pathname.replace(/^\/api\//, '')

  return slug ? `${COMPOSIO_LOGO_PROTOCOL}://mark/${encodeURIComponent(slug)}` : null
}

export function composioCdnUrlFromProtocolRequest(requestUrl: string): string | null {
  try {
    const parsed = new URL(requestUrl)

    if (parsed.protocol !== `${COMPOSIO_LOGO_PROTOCOL}:` || parsed.hostname !== 'mark') {
      return null
    }

    const slug = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
    const cdn = composioToolkitLogoUrl(slug)

    return cdn && isTrustedComposioLogoUrl(cdn) ? cdn : null
  } catch {
    return null
  }
}

/**
 * Packaged Electron loads the renderer from file://, which cannot paint a
 * remote <img>. Map the CDN URL onto the privileged work4you-logo scheme.
 * http(s) origins (web, Vite) load the CDN directly.
 */
export function composioLogoImgSrc(
  cdnUrl: null | string | undefined,
  pageProtocol = typeof window === 'undefined' ? '' : window.location.protocol
): string | null {
  if (typeof cdnUrl !== 'string' || !isTrustedComposioLogoUrl(cdnUrl)) {
    return null
  }

  if (pageProtocol === 'file:') {
    return composioLogoProtocolUrl(cdnUrl)
  }

  return cdnUrl
}

export function mcpDirectoryQueryHit(fields: ReadonlyArray<null | string | undefined>, query: string): boolean {
  const needle = query.trim().toLowerCase()

  if (!needle) {
    return true
  }

  return fields.some(field => (field ?? '').toLowerCase().includes(needle))
}

export function mcpDirectoryShowsConnected(filter: McpDirectoryFilter): boolean {
  return filter === 'all' || filter === 'connected' || filter === 'discover'
}

export function mcpDirectoryShowsAvailable(filter: McpDirectoryFilter): boolean {
  return filter === 'all' || filter === 'available' || filter === 'discover'
}

/** OAuth catalog entries use the same install handler; the label is Connect. */
export function mcpCatalogPrimaryAction(authType: string | undefined): 'connect' | 'install' {
  return authType === 'oauth' ? 'connect' : 'install'
}

export function filterDirectoryApps(
  apps: readonly DirectoryApp[],
  opts: { filter: McpDirectoryFilter; query: string; section: string | null }
): DirectoryApp[] {
  return apps.filter(app => {
    if (HIDDEN_DIRECTORY_IDS.has(app.id)) {
      return false
    }

    if (opts.section && opts.section !== 'all' && app.section !== opts.section) {
      return false
    }

    if (!mcpDirectoryQueryHit([app.name, app.id, app.description], opts.query)) {
      return false
    }

    if (opts.filter === 'connected') {
      return app.connected
    }

    if (opts.filter === 'available') {
      return !app.connected
    }

    return true
  })
}

export interface DirectorySectionGroup {
  id: string
  label: string
  apps: DirectoryApp[]
}

/**
 * Perplexity-style groups. Popular apps also appear in their type section.
 * `discover` and `all` both section; connected/available stay sectioned too
 * so the store never splits into a native-vs-Composio taxonomy.
 */
export function groupDirectorySections(apps: readonly DirectoryApp[]): DirectorySectionGroup[] {
  const groups: DirectorySectionGroup[] = []
  const popular = apps.filter(app => app.popular)

  if (popular.length) {
    groups.push({ id: 'popular', label: DIRECTORY_SECTION_LABELS.popular, apps: popular })
  }

  const custom = apps.filter(app => app.source === 'custom')

  for (const id of DIRECTORY_SECTION_IDS) {
    const rows = apps.filter(app => app.section === id && app.source !== 'custom')

    if (!rows.length) {
      continue
    }

    groups.push({ id, label: DIRECTORY_SECTION_LABELS[id], apps: rows })
  }

  if (custom.length) {
    groups.push({ id: 'custom', label: DIRECTORY_SECTION_LABELS.custom, apps: custom })
  }

  return groups
}

export function directoryAppDescription(app: Pick<DirectoryApp, 'description' | 'notes'>): string {
  if (app.notes === 'instagram_business_creator') {
    const base = app.description.trim()
    const note = 'Instagram Business or Creator only.'

    return base ? `${base} ${note}` : note
  }

  return app.description
}

export async function completeComposioConnect(opts: {
  authorize: () => Promise<{ redirect_url?: string }>
  wait: () => Promise<{ connected?: boolean }>
  open: (url: string) => void | Promise<void>
  sleep?: (ms: number) => Promise<void>
}): Promise<boolean> {
  const started = await opts.authorize()
  const url = started.redirect_url

  if (!url) {
    throw new Error('missing_redirect_url')
  }

  await opts.open(url)
  const result = await opts.wait()

  if (result.connected) {
    return true
  }

  const sleep = opts.sleep ?? ((ms: number) => new Promise(r => setTimeout(r, ms)))
  await sleep(1500)
  const retry = await opts.wait()

  return Boolean(retry.connected)
}

export function composioAppSuggestKeywords(app: { id: string; name: string }): string[] {
  const keywords: string[] = []
  const seen = new Set<string>()

  const add = (value: string) => {
    const trimmed = value.trim().toLowerCase()

    if (!trimmed || seen.has(trimmed)) {
      return
    }

    seen.add(trimmed)
    keywords.push(trimmed)
  }

  add(app.id)

  if (app.id.includes('_')) {
    add(app.id.replace(/_/g, ' '))
  }

  add(app.name)

  return keywords
}

export function findComposioDirectoryApp(
  apps: readonly DirectoryApp[],
  server: string
): DirectoryApp | undefined {
  const needle = server.trim().toLowerCase()

  if (!needle) {
    return undefined
  }

  return apps.find(
    app =>
      app.source === 'composio' &&
      (app.id.toLowerCase() === needle || app.name.toLowerCase() === needle)
  )
}

export function composioAppsToSuggestible(
  apps: readonly DirectoryApp[],
  nativeServers: ReadonlySet<string>
): Array<{ keywords: string[]; server: string; source: 'composio'; url: string }> {
  const native = new Set([...nativeServers].map(name => name.toLowerCase()))

  return apps
    .filter(
      app =>
        app.source === 'composio' &&
        !app.connected &&
        !app.needs_login &&
        !native.has(app.id.toLowerCase())
    )
    .map(app => ({
      keywords: composioAppSuggestKeywords(app),
      server: app.id,
      source: 'composio' as const,
      url: ''
    }))
}
