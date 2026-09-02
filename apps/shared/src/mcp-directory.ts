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

/** Editorial Popular pins for native catalog names. Keep in sync with
 *  ``work4you_cli/connectors_catalog.py`` ``NATIVE_POPULAR``. */
export const NATIVE_POPULAR = new Set(['notion', 'vercel', 'stripe', 'figma'])

/** Native-only section buckets. Unknown names fall through to `other`.
 *  Keep in sync with ``work4you_cli/connectors_catalog.py`` ``NATIVE_SECTIONS``. */
export const NATIVE_SECTIONS: Record<string, DirectorySectionId> = {
  airtable: 'data',
  asana: 'productivity',
  atlassian: 'developer',
  'comfy-cloud': 'ai',
  datadog: 'data',
  figma: 'files',
  hugging_face: 'ai',
  intercom: 'communication',
  linear: 'productivity',
  n8n: 'developer',
  netlify: 'developer',
  notion: 'productivity',
  paypal: 'finance',
  sentry: 'developer',
  square: 'finance',
  stripe: 'finance',
  supabase: 'data',
  'unreal-engine': 'developer',
  vercel: 'developer',
  webflow: 'developer'
}

export interface NativeCatalogLike {
  name: string
  description?: string
  auth_type?: string
  required_env?: { name: string; prompt: string; required: boolean }[]
  needs_install?: boolean
  installed?: boolean
  enabled?: boolean
}

export interface InstalledDirectoryServer {
  name: string
  description?: string
  auth?: string
}

export function httpErrorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    const rec = error as { message?: unknown; status?: unknown; statusCode?: unknown }

    if (typeof rec.statusCode === 'number' && Number.isFinite(rec.statusCode)) {
      return rec.statusCode
    }

    if (typeof rec.status === 'number' && Number.isFinite(rec.status)) {
      return rec.status
    }

    if (typeof rec.message === 'string') {
      const match = /^(\d{3})\b/.exec(rec.message.trim())

      if (match) {
        return Number(match[1])
      }
    }
  }

  if (typeof error === 'string') {
    const match = /^(\d{3})\b/.exec(error.trim())

    if (match) {
      return Number(match[1])
    }
  }

  return null
}

/** True when `/api/connectors/directory` is missing (old runtime) rather than failing. */
export function isConnectorsDirectoryMissing(error: unknown): boolean {
  const status = httpErrorStatus(error)

  return status === 404 || status === 405
}

export function nativeCatalogToDirectoryApp(entry: NativeCatalogLike): DirectoryApp {
  const id = entry.name
  const installed = Boolean(entry.installed)

  return {
    id,
    name: id,
    description: (entry.description ?? '').trim(),
    section: NATIVE_SECTIONS[id] ?? 'other',
    popular: NATIVE_POPULAR.has(id),
    source: 'native',
    connected: installed,
    auth_type: entry.auth_type,
    needs_login: false,
    notes: null,
    required_env: entry.required_env ?? [],
    needs_install: Boolean(entry.needs_install),
    installed,
    enabled: Boolean(entry.enabled)
  }
}

function directorySourceOf(source: DirectoryApp['source'] | string | undefined): DirectoryApp['source'] {
  if (source === 'composio') {
    return 'composio'
  }

  if (source === 'custom') {
    return 'custom'
  }

  return 'native'
}

/**
 * Build the unified directory. Pass `directoryApps: null` when the connectors
 * control plane is missing so Discover still fills from `/api/mcp/catalog`
 * instead of rendering an empty store next to an installed custom server.
 */
export function buildMcpDirectoryApps(opts: {
  directoryApps: readonly DirectoryApp[] | null | undefined
  nativeCatalog: readonly NativeCatalogLike[]
  installed: readonly InstalledDirectoryServer[]
}): DirectoryApp[] {
  const rows: DirectoryApp[] = []

  if (opts.directoryApps) {
    for (const app of opts.directoryApps) {
      rows.push({ ...app, source: directorySourceOf(app.source) })
    }
  } else {
    for (const entry of opts.nativeCatalog) {
      if (!entry.name || HIDDEN_DIRECTORY_IDS.has(entry.name)) {
        continue
      }

      rows.push(nativeCatalogToDirectoryApp(entry))
    }
  }

  const known = new Set(rows.map(app => app.id))

  for (const server of opts.installed) {
    if (!server.name || HIDDEN_DIRECTORY_IDS.has(server.name) || known.has(server.name)) {
      continue
    }

    rows.push({
      id: server.name,
      name: server.name,
      description: server.description ?? '',
      section: 'other',
      popular: false,
      source: 'custom',
      connected: true,
      auth_type: server.auth
    })
  }

  return rows
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
