import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import {
  completeComposioConnect,
  DIRECTORY_SECTION_IDS,
  DIRECTORY_SECTION_LABELS,
  type DirectoryApp,
  directoryAppDescription,
  directoryAppLogoUrl,
  filterDirectoryApps,
  groupDirectorySections,
  isTrustedComposioLogoUrl
} from '@work4you/shared'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { type CodeEditorApi } from '@/components/chat/code-editor'
import { JsonDocumentEditor } from '@/components/chat/json-document-editor'
import { LogTail } from '@/components/chat/log-tail'
import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { ErrorBanner } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { TextTab } from '@/components/ui/text-tab'
import { Textarea } from '@/components/ui/textarea'
import { Tip } from '@/components/ui/tooltip'
import { type Translations, useI18n } from '@/i18n'
import { useComposioLogoSrc } from '@/lib/composio-logo'
import { compactNumber } from '@/lib/format'
import { brandFor, brandGlyphStyle } from '@/lib/mcp-brands'
import { estimateServerTokens, serverUsageCount } from '@/lib/mcp-cost'
import { completeMcpDesktopOAuth } from '@/lib/mcp-dashboard-oauth'
import {
  mcpCatalogPrimaryAction,
  type McpDirectoryFilter
} from '@/lib/mcp-directory-filter'
import { type McpImportEntry, parseMcpImport } from '@/lib/mcp-import'
import { NEEDS_AUTH_RE, PROBE_TTL_MS, probeCache, probeKey, serverFingerprint } from '@/lib/mcp-probe-cache'
import { getServers, isServerShape, type McpServers, normalizeEntry } from '@/lib/mcp-servers'
import { countEnabledTools, isToolEnabled, toggleToolInServer } from '@/lib/mcp-tool-filter'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { $activeGatewayProfile, normalizeProfileKey } from '@/store/profile'
import { $activeSessionId } from '@/store/session'
import {
  authMcpServer,
  authorizeConnector,
  bootstrapConnectors,
  disconnectConnector,
  getActionStatus,
  getConnectorsDirectory,
  getLogs,
  getMcpCatalog,
  getMcpOAuthFlow,
  getUsageAnalytics,
  installMcpCatalogEntry,
  type McpCatalogEntry,
  type McpTestResult,
  type ProfileScope,
  profileScopeKey,
  saveMcpServers,
  testMcpServer,
  waitConnector,
  type Work4YouGateway
} from '@/work4you'

import { useWork4YouConfigRecord, work4youConfigCacheWriter } from '../hooks/use-config-record'
import { useOnProfileSwitch } from '../hooks/use-on-profile-switch'
import { DetailPane, ICON_BUTTON } from '../master-detail'
import { PanelEmpty } from '../overlays/panel'
import { prettyName } from '../settings/helpers'
import { useDeepLinkHighlight } from '../settings/use-deep-link-highlight'

// The editor always speaks the ecosystem's mcp.json document format — names
// are the JSON keys, transport is inferred from `command` vs `url` — so any
// README's "add this to your mcp.json" snippet pastes verbatim. Storage stays
// the config.yaml `mcp_servers` map (CLI/TUI untouched).
const STARTER_ENTRY = { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'] }

const pretty = (value: unknown) => JSON.stringify(value, null, 2)
const wrapDoc = (entries: McpServers) => pretty({ mcpServers: entries })

/** Accepts `{"mcpServers": {...}}` (ecosystem), a bare name→config map, or throws. */
function parseServersDoc(raw: string): McpServers {
  const parsed = JSON.parse(raw) as unknown

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object')
  }

  const doc = parsed as Record<string, unknown>

  if (isServerShape(doc)) {
    throw new Error('Wrap the server in {"mcpServers": {"name": …}} so it has a name')
  }

  const wrapper = doc.mcpServers ?? doc.mcp_servers

  const map =
    wrapper && typeof wrapper === 'object' && !Array.isArray(wrapper) ? (wrapper as McpServers) : (doc as McpServers)

  return Object.fromEntries(Object.entries(map).map(([name, entry]) => [name, normalizeEntry(entry)]))
}

// The runtime gate is `enabled: false` — the same flag `work4you mcp` and the
// agent's MCP loader read.
const serverEnabled = (server: Record<string, unknown>) => server.enabled !== false

// Shared cache for the Work4You-approved catalog — feeds both description enrichment
// and the Catalog install view; invalidated after an install.
const MCP_CATALOG_KEY = ['mcp-catalog'] as const

function catalogDescription(
  catalog: readonly McpCatalogEntry[],
  serverName: string,
  server: Record<string, unknown>
): null | string {
  const lower = serverName.toLowerCase()

  const match = catalog.find(
    entry =>
      entry.name.toLowerCase() === lower ||
      (entry.url && entry.url === server.url) ||
      (entry.command && entry.command === server.command)
  )

  return match?.description ?? null
}

type Probe = McpTestResult | 'probing'

// Per-server cost/usage overlay inputs: `tokens` is the approximate per-call
// schema cost from the probe (null = no estimate — older backend or no probe
// yet), `uses` is the 30-day analytics call count (null = analytics
// unavailable, so usage is simply omitted).
interface ServerCost {
  tokens: null | number
  uses: null | number
}

// 30-day per-tool call counts for the MCP fleet — same shape and TTL rules as
// the Toolsets tab's toolCallsCache (skills/index.tsx), but a 30-day window
// keyed by the Capabilities scope profile. Purely cosmetic: a failed analytics
// fetch caches nothing and the overlay omits usage.
const MCP_USAGE_TTL_MS = 10 * 60_000
const mcpUsageCache = new Map<string, { at: number; value: Record<string, number> }>()

async function loadMcpUsage(scopeKey: string, scopeProfile: ProfileScope): Promise<null | Record<string, number>> {
  const cached = mcpUsageCache.get(scopeKey)

  if (cached && Date.now() - cached.at < MCP_USAGE_TTL_MS) {
    return cached.value
  }

  try {
    const analytics = await getUsageAnalytics(30, scopeProfile)
    const value = Object.fromEntries((analytics.tools ?? []).map(entry => [entry.tool, entry.count]))
    mcpUsageCache.set(scopeKey, { at: Date.now(), value })

    return value
  } catch {
    // Analytics unavailable — degrade to "no usage shown", never an error UI.
    return null
  }
}

type ServerStatus = 'off' | 'probing' | 'ok' | 'needs-auth' | 'error' | 'unknown'

function statusOf(server: Record<string, unknown>, probe: Probe | undefined): ServerStatus {
  if (!serverEnabled(server)) {
    return 'off'
  }

  if (probe === 'probing') {
    return 'probing'
  }

  if (!probe) {
    return 'unknown'
  }

  if (probe.ok) {
    return 'ok'
  }

  return NEEDS_AUTH_RE.test(probe.error ?? '') ? 'needs-auth' : 'error'
}

const STATUS_DOT: Record<ServerStatus, string> = {
  ok: 'bg-emerald-500',
  error: 'bg-red-500',
  'needs-auth': 'bg-amber-500',
  probing: 'animate-pulse bg-foreground/40',
  off: 'bg-foreground/20',
  unknown: 'bg-foreground/20'
}

// "12 tools enabled" / "25 tools, 1 prompts, 103 resources enabled" — only
// the capabilities the server actually has. When a `server` config is passed,
// the tool count reflects the per-tool include/exclude filter (what's actually
// registered), not the raw discovered count. The optional `cost` appends the
// overlay — "…, ~4.2k tok, 3 uses/30d" — with each half omitted when unknown.
function capabilitySummary(
  m: Translations['settings']['mcp'],
  probe: McpTestResult,
  server?: Record<string, unknown>,
  cost?: ServerCost
): string {
  const toolCount = server
    ? countEnabledTools(
        server,
        probe.tools.map(tool => tool.name)
      )
    : probe.tools.length

  const parts = [m.capabilitySummary(toolCount, probe.prompts ?? 0, probe.resources ?? 0)]

  if (cost && cost.tokens !== null && cost.tokens > 0) {
    parts.push(m.costTokens(compactNumber(cost.tokens)))
  }

  if (cost && cost.uses !== null) {
    parts.push(m.usage30d(compactNumber(cost.uses)))
  }

  return parts.join(', ')
}

function statusLine(
  m: Translations['settings']['mcp'],
  status: ServerStatus,
  probe: Probe | undefined,
  server?: Record<string, unknown>,
  cost?: ServerCost
): string {
  switch (status) {
    case 'ok':
      return capabilitySummary(m, probe as McpTestResult, server, cost)

    case 'probing':
      return m.statusConnecting

    case 'needs-auth':
      return m.statusNeedsAuth

    case 'error':
      return m.statusError

    case 'off':
      return m.statusOff

    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Cursor → server-block mapping. A tolerant character walker (not JSON.parse —
// it must work mid-edit) that finds each server's key+object range inside the
// mcpServers container, so the editor cursor selects a server and the block
// can be highlighted.
// ---------------------------------------------------------------------------

interface ServerBlock {
  from: number
  name: string
  to: number
}

function scanServerBlocks(text: string): ServerBlock[] {
  const skipString = (index: number): number => {
    let i = index + 1

    while (i < text.length) {
      if (text[i] === '\\') {
        i += 2
      } else if (text[i] === '"') {
        return i + 1
      } else {
        i++
      }
    }

    return i
  }

  // Container: the object after "mcpServers"/"mcp_servers", else the doc root.
  let start = -1
  const wrapper = /"mcpServers"|"mcp_servers"/.exec(text)

  if (wrapper) {
    let i = wrapper.index + wrapper[0].length

    while (i < text.length && text[i] !== '{') {
      i++
    }

    start = i
  } else {
    start = text.indexOf('{')
  }

  if (start < 0 || text[start] !== '{') {
    return []
  }

  const blocks: ServerBlock[] = []
  let i = start + 1

  while (i < text.length) {
    const ch = text[i]

    if (ch === '}') {
      break
    }

    if (ch !== '"') {
      i++

      continue
    }

    const keyStart = i
    const keyEnd = skipString(i)
    const name = text.slice(keyStart + 1, keyEnd - 1)
    i = keyEnd

    while (i < text.length && text[i] !== ':') {
      i++
    }

    i++

    while (i < text.length && /\s/.test(text[i])) {
      i++
    }

    if (text[i] === '{') {
      let depth = 0
      let j = i

      while (j < text.length) {
        const c = text[j]

        if (c === '"') {
          j = skipString(j)

          continue
        }

        if (c === '{') {
          depth++
        } else if (c === '}') {
          depth--

          if (depth === 0) {
            j++

            break
          }
        }

        j++
      }

      blocks.push({ from: keyStart, name, to: j })
      i = j
    } else {
      // Non-object value — skip to the next sibling.
      while (i < text.length && text[i] !== ',' && text[i] !== '}') {
        if (text[i] === '"') {
          i = skipString(i)

          continue
        }

        i++
      }
    }
  }

  return blocks
}

export function McpTab({
  gateway,
  profile,
  query = ''
}: {
  gateway: Work4YouGateway | null
  profile?: ProfileScope
  query?: string
}) {
  const { t } = useI18n()
  const m = t.settings.mcp
  const activeSessionId = useStore($activeSessionId)

  // The profile this tab configures: the Capabilities profile-scope selector's
  // choice (`profile`) when set, otherwise the app-wide active profile. Every
  // fetch/save below is scoped to it, and it keys the config/catalog/probe
  // caches so switching the selector refetches and never shows another
  // profile's servers (AGENTS.md scope-in-key). When no override is passed this
  // resolves to $activeGatewayProfile, so behavior is identical to before.
  const appProfile = useStore($activeGatewayProfile)
  const scopeProfileKey = profile != null ? profileScopeKey(profile) : normalizeProfileKey(appProfile)

  // Shared config cache (see use-config-record): revisiting the tab paints the
  // cached record instantly; mutations write through `setConfig` and stay
  // visible to the other settings surfaces.
  const {
    data: config,
    isLoading: configLoading,
    isError: configFailed,
    error: configError,
    refetch: refetchConfig,
    dataUpdatedAt: configUpdatedAt,
    errorUpdatedAt: configErroredAt
  } = useWork4YouConfigRecord(profile)

  const setConfig = work4youConfigCacheWriter(profile)

  // True from a profile switch until the config query resettles for the new
  // profile. Until then `config` (and thus `servers`) still holds profile A's
  // data, so any persist would write A's server list into B — block mutations.
  const [profilePending, setProfilePending] = useState(false)
  const staleConfigStamp = useRef<null | number>(null)
  const staleErrorStamp = useRef<null | number>(null)

  const [saving, setSaving] = useState(false)
  const [probes, setProbes] = useState<Record<string, Probe>>({})
  const probesRef = useRef(probes)
  probesRef.current = probes

  // 30-day per-tool call counts (registry names). null = analytics unavailable
  // or not loaded yet — the cost overlay then omits usage entirely.
  const [toolCalls30d, setToolCalls30d] = useState<null | Record<string, number>>(null)

  // Blocks the browser until an OAuth flow lands a token; also reset on profile
  // switch, so declared up here alongside the other per-profile view state.
  const [authing, setAuthing] = useState<null | string>(null)

  // Master document draft. `docVersion` remounts the editor when the draft is
  // regenerated programmatically (list-side mutations); `dirty` guards user
  // edits from being clobbered by those regenerations.
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [docVersion, setDocVersion] = useState(0)
  const [logSource, setLogSource] = useState<'stdio' | 'agent'>('stdio')
  const [directoryFilter, setDirectoryFilter] = useState<McpDirectoryFilter>('discover')
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [connectingSlug, setConnectingSlug] = useState<null | string>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [selectedName, setSelectedName] = useState<null | string>(null)

  // The mcp.json editor still highlights the selected server block when
  // Administration is open. Directory selection is explicit so collapsing
  // that pane does not bounce the user back to the catalog.
  const editorApi = useRef<CodeEditorApi | null>(null)
  const [cursor, setCursor] = useState(0)
  const blocks = useMemo(() => scanServerBlocks(draft), [draft])

  const activeBlock = useMemo(
    () => blocks.find(block => cursor >= block.from && cursor <= block.to) ?? null,
    [blocks, cursor]
  )

  const selected = selectedName

  const syncEditorCursor = (name: string) => {
    const block = blocks.find(b => b.name === name)

    if (block) {
      editorApi.current?.setCursor(block.from + 1)
      setCursor(block.from + 1)
    }
  }

  const focusServer = (name: string) => {
    setSelectedName(name)
    syncEditorCursor(name)
  }

  const clearSelection = () => {
    setSelectedName(null)
    setCursor(0)
  }

  const servers = useMemo(() => getServers(config ?? null), [config])

  // Config/document order, not alphabetical — the list mirrors mcp.json.
  const names = useMemo(() => Object.keys(servers), [servers])

  // Key by the SCOPED profile — installed/enabled badges are per-profile, so
  // sharing one cache across profiles would flash the previous profile's state
  // on switch. When no selector override is set this is the active profile,
  // identical to before.
  const catalogQuery = useQuery({
    queryKey: [...MCP_CATALOG_KEY, scopeProfileKey],
    queryFn: () => getMcpCatalog(profile ?? undefined),
    staleTime: 5 * 60_000
  })

  const directoryQuery = useQuery({
    queryKey: ['connectors-directory', scopeProfileKey],
    queryFn: () => getConnectorsDirectory(profile ?? undefined),
    staleTime: 30_000
  })

  const catalog = useMemo(() => catalogQuery.data?.entries ?? [], [catalogQuery.data])

  const nativeCatalogByName = useMemo(() => {
    const map = new Map<string, McpCatalogEntry>()

    for (const entry of catalog) {
      map.set(entry.name.toLowerCase(), entry)
    }

    return map
  }, [catalog])

  const directoryApps = useMemo(() => {
    const rows: DirectoryApp[] = (directoryQuery.data?.apps ?? []).map(app => ({
      ...app,
      source: app.source === 'composio' ? 'composio' : 'native'
    }))

    const known = new Set(rows.map(app => app.id))

    for (const serverName of names) {
      if (serverName === 'work4you_apps' || known.has(serverName)) {
        continue
      }

      rows.push({
        id: serverName,
        name: serverName,
        description: catalogDescription(catalog, serverName, servers[serverName]) ?? '',
        section: 'other',
        popular: false,
        source: 'custom',
        connected: true,
        auth_type: typeof servers[serverName]?.auth === 'string' ? String(servers[serverName].auth) : undefined
      })
    }

    return filterDirectoryApps(rows, {
      filter: directoryFilter,
      query,
      section: sectionFilter === 'all' ? null : sectionFilter
    })
  }, [catalog, directoryFilter, directoryQuery.data, names, query, sectionFilter, servers])

  const directoryGroups = useMemo(() => groupDirectorySections(directoryApps), [directoryApps])

  const resetDraft = (entries: McpServers) => {
    setDraft(wrapDoc(entries))
    setDirty(false)
    setDocVersion(version => version + 1)
  }

  // Mirror a list-side mutation into a dirty draft without losing the user's
  // other edits. Unparseable drafts are left alone — save resolves the race.
  const patchDraft = (mutate: (doc: McpServers) => McpServers) => {
    try {
      setDraft(wrapDoc(mutate(parseServersDoc(draft))))
      setDocVersion(version => version + 1)
    } catch {
      // Draft is mid-edit / invalid JSON; the user's text wins until save.
    }
  }

  // Seed the editor draft from config exactly once, the first time it lands.
  // Background refetches thereafter update the list but must not clobber an
  // in-progress edit — the draft is the user's until they save or reset.
  const draftSeeded = useRef(false)

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    // profilePending: config still holds the PREVIOUS profile's record right
    // after a switch — seeding from it would latch the wrong profile's doc.
    if (!config || profilePending) {
      return
    }

    if (!draftSeeded.current) {
      draftSeeded.current = true
      resetDraft(getServers(config))

      return
    }

    if (dirty || names.length === 0) {
      return
    }

    // Heal the early-boot race: the first config snapshot can land before the
    // backend has mcp_servers assembled, seeding (and latching) an empty doc
    // while later refetches fill the list — saving would then wipe the real
    // servers. A PRISTINE empty draft reseeds when servers arrive; any user
    // edit (dirty) still always wins.
    try {
      if (Object.keys(parseServersDoc(draft)).length === 0) {
        resetDraft(servers)
      }
    } catch {
      // Mid-edit / invalid JSON — the user's text wins.
    }
  }, [config, dirty, draft, names, profilePending, servers])

  // Bumped on every profile switch. Async probe/auth completions capture the
  // epoch at call time and bail if it changed, so a slow profile-A request can't
  // write its result into profile B's state after the user switched.
  const profileEpoch = useRef(0)

  // A profile switch invalidates the config query (see store/profile.ts), which
  // refetches the new backend's mcp.json. Reset ALL per-profile view state — the
  // draft (incl. a dirty one, so profile A's edits can't be saved into B), its
  // seed latch, probes, and cursor — so everything reseeds for the new profile.
  // The probe cache is already profile-keyed, so this just forces a re-probe.
  useOnProfileSwitch(() => {
    profileEpoch.current += 1
    draftSeeded.current = false
    setProbes({})
    setToolCalls30d(null)
    setCursor(0)
    setSelectedName(null)
    setDirectoryFilter('discover')
    setSectionFilter('all')
    setAdminOpen(false)
    setAuthing(null)
    setDirty(false)
    setDraft('')
    setDocVersion(version => version + 1)
    // Mark stale until the config query replaces profile A's data — guards
    // sidebar mutations from persisting A's server list into B mid-refetch.
    staleConfigStamp.current = configUpdatedAt
    staleErrorStamp.current = configErroredAt
    setProfilePending(true)
  })

  // Clear once the config query settles for the new profile: dataUpdatedAt bumps
  // on a fresh success, errorUpdatedAt on a fresh failure. Releasing on error too
  // means a failed refetch surfaces the retry UI instead of leaving mutations
  // silently no-op forever.
  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    if (
      profilePending &&
      staleConfigStamp.current !== null &&
      (configUpdatedAt !== staleConfigStamp.current || configErroredAt !== staleErrorStamp.current)
    ) {
      setProfilePending(false)
      staleConfigStamp.current = null
      staleErrorStamp.current = null
    }
  }, [profilePending, configUpdatedAt, configErroredAt])

  useDeepLinkHighlight({
    block: 'nearest',
    elementId: serverName => `mcp-server-${serverName}`,
    onResolve: focusServer,
    param: 'server',
    ready: serverName => blocks.some(block => block.name === serverName)
  })

  const runProbe = async (serverName: string) => {
    const epoch = profileEpoch.current
    const key = probeKey(serverName, servers[serverName], scopeProfileKey)
    setProbes(current => ({ ...current, [serverName]: 'probing' }))

    try {
      const result = await testMcpServer(serverName, profile ?? undefined)

      // Drop the result if the profile changed mid-probe — it belongs to A.
      if (profileEpoch.current !== epoch) {
        return
      }

      probeCache.set(key, { at: Date.now(), result })
      setProbes(current => ({ ...current, [serverName]: result }))
    } catch (err) {
      if (profileEpoch.current !== epoch) {
        return
      }

      const result = { ok: false, error: err instanceof Error ? err.message : String(err), tools: [] }
      probeCache.set(key, { at: Date.now(), result })
      setProbes(current => ({ ...current, [serverName]: result }))
    }
  }

  // First-class OAuth: opens the system browser, blocks until the flow lands a
  // token (verified on disk — a friendly tools/list is not proof), then the
  // auth result doubles as the probe (it carries the tool list).
  const authenticate = async (serverName: string) => {
    const epoch = profileEpoch.current
    setAuthing(serverName)
    setProbes(current => ({ ...current, [serverName]: 'probing' }))

    try {
      const flow = await completeMcpDesktopOAuth({
        serverName,
        start: name => authMcpServer(name, profile ?? undefined),
        status: flowId => getMcpOAuthFlow(flowId, profile ?? undefined),
        openExternal: url => window.work4youDesktop.openExternal(url)
      })

      const result: McpTestResult = { ok: true, tools: flow.tools ?? [] }

      // Bail if the user switched profiles mid-flow — this result is profile A's.
      if (profileEpoch.current !== epoch) {
        return
      }

      setProbes(current => ({ ...current, [serverName]: result }))
      // Cache under the POST-auth fingerprint (auth: oauth) on success — that's
      // the config the mount effect will read back, so it hits this entry.
      const probedConfig = result.ok ? { ...servers[serverName], auth: 'oauth' } : servers[serverName]
      probeCache.set(probeKey(serverName, probedConfig, scopeProfileKey), { at: Date.now(), result })

      if (result.ok) {
        // The endpoint persisted `auth: oauth` — mirror it locally.
        const nextServers = { ...servers, [serverName]: { ...servers[serverName], auth: 'oauth' } }
        setConfig(current => (current ? { ...current, mcp_servers: nextServers } : current))

        // Mirror `auth: oauth` into the editor too. If we only reset a clean
        // draft, a dirty draft keeps the pre-auth text and the next Save would
        // drop the freshly-persisted auth field — so patch the dirty draft in
        // place instead of clobbering the user's other edits.
        if (dirty) {
          patchDraft(doc => (doc[serverName] ? { ...doc, [serverName]: { ...doc[serverName], auth: 'oauth' } } : doc))
        } else {
          resetDraft(nextServers)
        }

        notify({
          kind: 'success',
          title: m.authenticatedTitle,
          message: m.authenticatedMessage(serverName, result.tools.length)
        })
        void silentReload()
      } else if (result.error) {
        notifyError(new Error(result.error), serverName)
      }
    } catch (err) {
      if (profileEpoch.current !== epoch) {
        return
      }

      setProbes(current => ({
        ...current,
        [serverName]: { ok: false, error: err instanceof Error ? err.message : String(err), tools: [] }
      }))
      notifyError(err, serverName)
    } finally {
      if (profileEpoch.current === epoch) {
        setAuthing(null)
      }
    }
  }

  // It should just know: probe enabled servers as config arrives — but through
  // the cache, so revisiting the page doesn't respawn/reconnect the fleet.
  useEffect(() => {
    for (const [serverName, server] of Object.entries(servers)) {
      if (!serverEnabled(server) || probesRef.current[serverName] !== undefined) {
        continue
      }

      const cached = probeCache.get(probeKey(serverName, server, scopeProfileKey))

      if (cached && Date.now() - cached.at < PROBE_TTL_MS) {
        setProbes(current => ({ ...current, [serverName]: cached.result }))
      } else {
        void runProbe(serverName)
      }
    }
    // Re-run only when the server set changes; runProbe is recreated every
    // render and adding it would re-probe the fleet on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers])

  // Cosmetic 30-day usage counts for the cost overlay — cached module-wide per
  // scope profile, epoch-guarded like the probes so a slow profile-A fetch
  // can't paint into profile B.
  useEffect(() => {
    const epoch = profileEpoch.current

    void loadMcpUsage(scopeProfileKey, profile ?? appProfile ?? null).then(value => {
      if (profileEpoch.current === epoch) {
        setToolCalls30d(value)
      }
    })
  }, [scopeProfileKey, profile, appProfile])

  // Overlay inputs for one server: token estimate from its (successful) probe,
  // 30-day uses from analytics. Both halves degrade to null independently.
  const costFor = (serverName: string, server: Record<string, unknown>): ServerCost => {
    const probe = probes[serverName]

    return {
      tokens: probe && probe !== 'probing' && probe.ok ? estimateServerTokens(server, probe.tools) : null,
      uses: toolCalls30d ? serverUsageCount(serverName, toolCalls30d) : null
    }
  }

  // Config writes reach live sessions immediately — no manual "Reload MCP".
  const silentReload = async () => {
    if (!gateway) {
      return
    }

    try {
      await gateway.request('reload.mcp', { confirm: true, session_id: activeSessionId ?? undefined })
    } catch (err) {
      notifyError(err, m.reloadFailed)
    }
  }

  // Whole-map replace (NOT saveWork4YouConfig, which deep-merges and so can never
  // delete a server, drop `enabled: false`, or remove a nested field). Only
  // after the replace lands do we write the cache through + reload live sessions.
  // Returns false when the profile switched mid-save: the write hit profile A's
  // backend (correct), but the client-side cache/editor now belong to B, so the
  // caller must skip its post-await writes.
  const persist = async (nextServers: McpServers): Promise<boolean> => {
    const epoch = profileEpoch.current
    await saveMcpServers(nextServers, profile ?? undefined)

    if (profileEpoch.current !== epoch) {
      return false
    }

    setConfig(current => ({ ...current, mcp_servers: nextServers }))
    void silentReload()

    return true
  }

  // A catalog install wrote a new server into config.yaml on the backend —
  // refresh the catalog (installed state) and the config, then RECONCILE THE
  // EDITOR DRAFT with the fresh servers. Without this a dirty draft (or even a
  // clean one the seed never refreshes) would omit the new server, and the next
  // whole-map Save would silently drop it.
  const onCatalogInstalled = async (installedName?: string) => {
    void catalogQuery.refetch()
    void directoryQuery.refetch()
    const { data } = await refetchConfig()
    const nextServers = getServers(data ?? null)

    if (dirty) {
      // Keep the user's in-progress edits (doc wins), add any server the install
      // introduced that the draft doesn't have yet.
      patchDraft(doc => ({ ...nextServers, ...doc }))
    } else {
      resetDraft(nextServers)
    }

    void silentReload()

    if (installedName) {
      setSelectedName(installedName)
    }
  }

  const withEnabled = (server: Record<string, unknown>, enabled: boolean) => {
    const next = { ...server }

    if (enabled) {
      delete next.enabled
    } else {
      next.enabled = false
    }

    return next
  }

  const setServerEnabled = async (serverName: string, enabled: boolean) => {
    if (profilePending) {
      return
    }

    const next = withEnabled(servers[serverName], enabled)

    try {
      if (!(await persist({ ...servers, [serverName]: next }))) {
        return
      }

      if (dirty) {
        patchDraft(doc => (doc[serverName] ? { ...doc, [serverName]: withEnabled(doc[serverName], enabled) } : doc))
      } else {
        resetDraft({ ...servers, [serverName]: next })
      }

      if (enabled) {
        void runProbe(serverName)
      }
    } catch (err) {
      notifyError(err, m.saveFailed)
    }
  }

  // Per-tool gating writes the server's `tools.include`/`tools.exclude` and
  // persists like any other config change (immediate reload of live sessions).
  // The probe still lists every discovered tool; the filter decides which ones
  // the agent actually registers.
  const toggleTool = async (serverName: string, toolName: string) => {
    const base = servers[serverName]

    if (!base || profilePending) {
      return
    }

    const next = toggleToolInServer(base, toolName)

    try {
      if (!(await persist({ ...servers, [serverName]: next }))) {
        return
      }

      if (dirty) {
        patchDraft(doc =>
          doc[serverName] ? { ...doc, [serverName]: toggleToolInServer(doc[serverName], toolName) } : doc
        )
      } else {
        resetDraft({ ...servers, [serverName]: next })
      }
    } catch (err) {
      notifyError(err, m.saveFailed)
    }
  }

  const removeServer = async (serverName: string) => {
    if (profilePending) {
      return
    }

    setSaving(true)

    try {
      const next = { ...servers }
      delete next[serverName]

      if (!(await persist(next))) {
        return
      }

      if (dirty) {
        patchDraft(doc => {
          const patched = { ...doc }
          delete patched[serverName]

          return patched
        })
      } else {
        resetDraft(next)
      }

      setCursor(0)
      setSelectedName(null)
    } catch (err) {
      notifyError(err, m.removeFailed)
    } finally {
      setSaving(false)
    }
  }

  // "+" seeds a starter entry into the document (unique key) and marks it
  // dirty — naming happens in the editor, like every other mcp.json.
  const addServer = () => {
    if (profilePending) {
      return
    }

    let base: McpServers

    try {
      base = parseServersDoc(draft)
    } catch {
      base = { ...servers }
    }

    let key = 'my-server'

    for (let i = 2; key in base; i++) {
      key = `my-server-${i}`
    }

    const nextDraft = wrapDoc({ ...base, [key]: STARTER_ENTRY })
    setDraft(nextDraft)
    setDirty(true)
    setDocVersion(version => version + 1)
    setAdminOpen(true)
    setSelectedName(key)

    // Focus the fresh block once the editor remounts with the new doc.
    const from = nextDraft.indexOf(`"${key}"`)

    if (from >= 0) {
      requestAnimationFrame(() => {
        editorApi.current?.setCursor(from + 1)
        setCursor(from + 1)
      })
    }
  }

  // Paste-anything import: merge parsed entries into the draft exactly like
  // addServer seeds its starter — dirty draft, unique keys, focus the first
  // new block. Saving stays an explicit step, so the user can fix placeholder
  // env values (YOUR_KEY, …) in the editor first.
  const importServers = (entries: McpImportEntry[]) => {
    if (profilePending || entries.length === 0) {
      return
    }

    let base: McpServers

    try {
      base = parseServersDoc(draft)
    } catch {
      base = { ...servers }
    }

    let firstKey: null | string = null

    for (const entry of entries) {
      let key = entry.name

      for (let i = 2; key in base; i++) {
        key = `${entry.name}-${i}`
      }

      base = { ...base, [key]: entry.config }
      firstKey ??= key
    }

    const nextDraft = wrapDoc(base)
    setDraft(nextDraft)
    setDirty(true)
    setDocVersion(version => version + 1)
    setAdminOpen(true)

    if (firstKey) {
      setSelectedName(firstKey)
      const from = nextDraft.indexOf(`"${firstKey}"`)

      if (from >= 0) {
        requestAnimationFrame(() => {
          editorApi.current?.setCursor(from + 1)
          setCursor(from + 1)
        })
      }
    }
  }

  const saveDoc = async () => {
    if (profilePending) {
      return
    }

    let entries: McpServers

    try {
      entries = parseServersDoc(draft)
    } catch (err) {
      notifyError(err, m.invalidJson)

      return
    }

    setSaving(true)

    const prevServers = servers

    try {
      if (!(await persist(entries))) {
        return
      }

      resetDraft(entries)
      // Keep only probes for servers that survived AND kept the same config;
      // removed OR edited entries drop their probe so the mount effect re-probes
      // the new shape (the cache also misses on the changed fingerprint).
      setProbes(current =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([name]) =>
              name in entries && serverFingerprint(entries[name]) === serverFingerprint(prevServers[name] ?? {})
          )
        )
      )
      notify({ kind: 'success', title: m.savedTitle, message: m.savedMessage('mcp.json') })
    } catch (err) {
      notifyError(err, m.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Cached data paints instantly; a spinner only ever shows on the first-ever
  // load, and a failed load gets a real retry — never a silent blank pane.
  if (configFailed && !config) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center p-6">
        <ErrorBanner className="max-w-sm">
          <span className="flex flex-col gap-2">
            {configError instanceof Error ? configError.message : m.failedLoad}
            <Button className="self-start" onClick={() => void refetchConfig()} size="xs" variant="text">
              {m.reload}
            </Button>
          </span>
        </ErrorBanner>
      </div>
    )
  }

  if (!config) {
    return <PageLoader className="min-h-24" label={configLoading ? m.loading : t.skills.loading} />
  }

  // Selection may reference an unsaved block (freshly pasted) — fall back to
  // the draft's parsed entry so the config pane can still describe it.
  const savedEntry = selected ? servers[selected] : undefined

  const draftEntry = (() => {
    if (!selected || savedEntry) {
      return undefined
    }

    try {
      return parseServersDoc(draft)[selected]
    } catch {
      return undefined
    }
  })()

  const activeEntry = savedEntry ?? draftEntry

  const connectComposioApp = async (app: DirectoryApp) => {
    if (app.needs_login) {
      notify({
        kind: 'error',
        title: 'Sign in required',
        message: 'Sign in to Work4You to connect this app.'
      })

      return
    }

    setConnectingSlug(app.id)

    try {
      await bootstrapConnectors(profile ?? undefined)

      const ok = await completeComposioConnect({
        authorize: () => authorizeConnector(app.id, profile ?? undefined),
        wait: () => waitConnector(app.id, profile ?? undefined),
        open: url => window.work4youDesktop.openExternal(url)
      })

      if (ok) {
        notify({ kind: 'success', title: `${app.name} connected`, message: 'Available in new sessions.' })
      }

      await directoryQuery.refetch()
    } catch (err) {
      notifyError(err, m.catalogInstallFailed(app.name))
    } finally {
      setConnectingSlug(null)
    }
  }

  const disconnectComposioApp = async (app: DirectoryApp) => {
    setConnectingSlug(app.id)

    try {
      await disconnectConnector(app.id, profile ?? undefined)
      await directoryQuery.refetch()
    } catch (err) {
      notifyError(err, m.removeFailed)
    } finally {
      setConnectingSlug(null)
    }
  }

  const directoryEmpty =
    !selected && directoryApps.length === 0 && !directoryQuery.isLoading && !catalogQuery.isLoading

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-(--ui-stroke-quaternary) px-3">
        {!selected ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {(
              [
                ['discover', 'Discover'],
                ['all', t.skills.all],
                ['connected', t.settings.providers.connected],
                ['available', 'Available']
              ] as const
            ).map(([id, label]) => (
              <TextTab
                active={directoryFilter === id}
                className="h-5 px-0.5 text-[0.65rem]"
                key={id}
                onClick={() => setDirectoryFilter(id)}
              >
                {label}
              </TextTab>
            ))}
            <select
              aria-label="Category"
              className="h-5 max-w-[9rem] truncate bg-transparent text-[0.65rem] text-(--ui-text-secondary)"
              onChange={event => setSectionFilter(event.currentTarget.value)}
              value={sectionFilter}
            >
              <option value="all">All categories</option>
              {DIRECTORY_SECTION_IDS.map(id => (
                <option key={id} value={id}>
                  {DIRECTORY_SECTION_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <McpImportButton disabled={profilePending} onImport={importServers} />
        <Button disabled={profilePending} onClick={addServer} size="xs" variant="text">
          {m.newServer}
        </Button>
        <TextTab active={adminOpen} className="h-5 px-0.5 text-[0.65rem]" onClick={() => setAdminOpen(open => !open)}>
          {t.settings.sections.advanced}
        </TextTab>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {selected && activeEntry ? (
          <ServerConfig
            authing={authing === selected}
            cost={costFor(selected, activeEntry)}
            description={catalogDescription(catalog, selected, activeEntry)}
            entry={activeEntry}
            name={selected}
            onAuthenticate={() => void authenticate(selected)}
            onBack={clearSelection}
            onProbe={() => void runProbe(selected)}
            onRemove={() => void removeServer(selected)}
            onToggle={checked => void setServerEnabled(selected, checked)}
            onToggleTool={toolName => void toggleTool(selected, toolName)}
            probe={probes[selected]}
            saved={savedEntry !== undefined}
            saving={saving}
          />
        ) : (
          <div className="h-full overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]">
            {directoryEmpty ? (
              <PanelEmpty
                action={
                  <Button onClick={addServer} size="sm">
                    {m.newServer}
                  </Button>
                }
                description={
                  query.trim() ? t.skills.noSkillsDesc : directoryFilter === 'available' ? m.catalogEmpty : m.emptyDesc
                }
                icon="plug"
                title={
                  query.trim() ? t.skills.noSkillsTitle : directoryFilter === 'available' ? m.tabCatalog : m.emptyTitle
                }
              />
            ) : (
              <div className="flex flex-col gap-4">
                {directoryQuery.isLoading ? <PageLoader className="min-h-24" label={m.catalogLoading} /> : null}
                {directoryGroups.map(group => (
                  <section className="flex flex-col gap-2" key={group.id}>
                    <h2 className="px-0.5 text-[0.72rem] font-medium text-(--ui-text-tertiary)">{group.label}</h2>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {group.apps.map(app => {
                        const server = servers[app.id]

                        if ((app.source === 'native' || app.source === 'custom') && server) {
                          const status = statusOf(server, probes[app.id])
                          const cost = costFor(app.id, server)

                          return (
                            <ConnectorCard
                              description={app.description || catalogDescription(catalog, app.id, server)}
                              displayName={app.name}
                              key={`${group.id}-${app.id}`}
                              logo={directoryAppLogoUrl(app)}
                              name={app.id}
                              onSelect={() => focusServer(app.id)}
                              status={status}
                              trailing={
                                <>
                                  <ServerIconActions
                                    className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100"
                                    onProbe={() => void runProbe(app.id)}
                                    onRemove={() => void removeServer(app.id)}
                                    probing={status === 'probing'}
                                    saving={saving}
                                  />
                                  <ServerSwitch
                                    disabled={saving}
                                    enabled={serverEnabled(server)}
                                    name={app.id}
                                    onToggle={checked => void setServerEnabled(app.id, checked)}
                                  />
                                </>
                              }
                              unused={
                                serverEnabled(server) &&
                                status === 'ok' &&
                                cost.tokens !== null &&
                                cost.tokens > 0 &&
                                cost.uses === 0
                              }
                            />
                          )
                        }

                        if (app.source === 'composio') {
                          const busy = connectingSlug === app.id

                          return (
                            <ConnectorCard
                              description={directoryAppDescription(app)}
                              displayName={app.name}
                              key={`${group.id}-${app.id}`}
                              logo={directoryAppLogoUrl(app)}
                              name={app.id}
                              status={app.connected ? 'ok' : 'unknown'}
                              trailing={
                                app.connected ? (
                                  <Button
                                    disabled={busy}
                                    onClick={() => void disconnectComposioApp(app)}
                                    size="xs"
                                    variant="text"
                                  >
                                    {busy ? m.catalogInstalling : 'Disconnect'}
                                  </Button>
                                ) : (
                                  <Button
                                    disabled={busy}
                                    onClick={() => void connectComposioApp(app)}
                                    size="xs"
                                    variant="text"
                                  >
                                    {busy ? m.waitingForBrowser : t.common.connect}
                                  </Button>
                                )
                              }
                            />
                          )
                        }

                        const catalogEntry = nativeCatalogByName.get(app.id.toLowerCase())

                        if (!catalogEntry) {
                          return (
                            <ConnectorCard
                              description={app.description}
                              displayName={app.name}
                              key={`${group.id}-${app.id}`}
                              logo={directoryAppLogoUrl(app)}
                              name={app.id}
                              status="unknown"
                            />
                          )
                        }

                        return (
                          <CatalogInstallCard
                            entry={catalogEntry}
                            key={`${group.id}-${app.id}`}
                            onInstalled={onCatalogInstalled}
                            profile={profile}
                          />
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-col overflow-hidden border-t border-(--ui-stroke-quaternary)',
          adminOpen ? 'h-[min(42vh,22rem)] shrink-0' : 'hidden'
        )}
      >
        <JsonDocumentEditor
          apiRef={editorApi}
          disabled={saving}
          filePath="mcp.json"
          header={
            <>
              mcp.json
              {dirty && <span aria-hidden className="size-1.5 rounded-full bg-current/60" />}
            </>
          }
          highlight={activeBlock ? { from: activeBlock.from, to: activeBlock.to } : null}
          initialValue={draft}
          onChange={next => {
            setDraft(next)
            setDirty(true)
          }}
          onCursorChange={next => {
            setCursor(next)

            // Directory selection is explicit. Only the open Advanced editor
            // may retarget it — a hidden remount must not bounce the catalog.
            if (!adminOpen) {
              return
            }

            const block = blocks.find(b => next >= b.from && next <= b.to)

            if (block) {
              setSelectedName(block.name)
            }
          }}
          onFormatJsonError={error => notifyError(new Error(error), m.invalidJson)}
          onSave={() => void saveDoc()}
          remountKey={`${docVersion}-${adminOpen ? 'open' : 'shut'}`}
          trailing={
            <Button disabled={saving || !dirty} onClick={() => void saveDoc()} size="xs">
              {saving ? t.common.saving : t.common.save}
            </Button>
          }
        />
        <DetailPane
          actions={
            <span className="flex items-center gap-1.5">
              {(['stdio', 'agent'] as const).map(kind => (
                <TextTab
                  active={logSource === kind}
                  className="h-5 px-0.5 text-[0.65rem]"
                  key={kind}
                  onClick={() => setLogSource(kind)}
                >
                  {kind}
                </TextTab>
              ))}
            </span>
          }
          defaultHeight={120}
          id="mcp-logs"
          title={
            <span className="text-[0.68rem] font-normal text-muted-foreground/60">
              {selected && savedEntry ? selected : m.allServers}
            </span>
          }
        >
          <McpLogs emptyLabel={m.noOutput} server={selected && savedEntry ? selected : null} source={logSource} />
        </DetailPane>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Left column: one server's config (mirrors the block under the cursor).
// ---------------------------------------------------------------------------

function ServerConfig({
  authing,
  cost,
  description,
  entry,
  name,
  onAuthenticate,
  onBack,
  onProbe,
  onRemove,
  onToggle,
  onToggleTool,
  probe,
  saved,
  saving
}: {
  authing: boolean
  cost?: ServerCost
  description: null | string
  entry: Record<string, unknown>
  name: string
  onAuthenticate: () => void
  onBack: () => void
  onProbe: () => void
  onRemove: () => void
  onToggle: (checked: boolean) => void
  onToggleTool: (toolName: string) => void
  probe: Probe | undefined
  saved: boolean
  saving: boolean
}) {
  const { t } = useI18n()
  const m = t.settings.mcp
  const status = statusOf(entry, probe)

  // OAuth is only offered to servers that are actually OAuth-shaped. A server
  // with `headers` uses API-key/bearer auth — a 401 there means a bad key, NOT
  // "log in with OAuth"; routing it through the browser flow would wrongly
  // rewrite its config to `auth: oauth`. So: explicit `auth: oauth` can re-auth
  // on failure; an auth-less HTTP server may try OAuth on a 401; header servers
  // never do.
  const hasHeaderAuth = !!entry.headers && typeof entry.headers === 'object'

  const canAuth =
    typeof entry.url === 'string' &&
    !hasHeaderAuth &&
    (entry.auth === 'oauth' ? status === 'needs-auth' || status === 'error' : !entry.auth && status === 'needs-auth')

  const summary = probe && probe !== 'probing' && probe.ok ? capabilitySummary(m, probe, entry, cost) : null

  return (
    // p-2 matches the list view's container so flipping list ⇄ config keeps
    // content anchored at the same origin.
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable]"
      id={`mcp-server-${name}`}
    >
      {/* Geometry cloned from McpRow so nothing jumps when flipping list ⇄
          config: items-start with per-element top margins that reproduce the
          row's h-11 centering exactly (h-5 controls → mt-3, size-6 avatar →
          mt-2.5, h-4 switch → mt-3.5) no matter how tall the text column gets. */}
      <div className="flex items-start gap-2 pr-1.5">
        <Tip label={m.allServers}>
          <Button
            aria-label={m.allServers}
            className={cn('mt-3', ICON_BUTTON)}
            onClick={onBack}
            size="icon"
            variant="ghost"
          >
            <Codicon name="chevron-left" size="0.8125rem" />
          </Button>
        </Tip>
        <McpAvatar className="mt-2.5 size-6" name={name} status={status} />
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="min-w-0 truncate text-[0.9375rem] font-semibold tracking-tight">{prettyName(name)}</h3>
          <p className="mt-0.5 truncate text-[0.68rem] text-(--ui-text-tertiary)">
            {typeof entry.url === 'string' ? entry.url : [entry.command, ...((entry.args as string[]) ?? [])].join(' ')}
          </p>
          {summary && <p className="mt-0.5 text-[0.68rem] text-(--ui-text-tertiary)">{summary}</p>}
        </div>
        {saved && (
          // Direct row children (no wrapper): the icons↔switch gap must be the
          // row's own gap-2, byte-identical to McpRow.
          <>
            <ServerIconActions
              className="mt-3"
              onProbe={onProbe}
              onRemove={onRemove}
              probing={probe === 'probing'}
              saving={saving}
            />
            <ServerSwitch
              className="mt-3.5"
              disabled={saving}
              enabled={serverEnabled(entry)}
              name={name}
              onToggle={onToggle}
            />
          </>
        )}
      </div>

      {description && (
        <p className="mt-2 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
          {description}
        </p>
      )}

      {canAuth && saved && (
        <div className="mt-3 flex justify-end">
          <Button disabled={authing} onClick={onAuthenticate} size="xs">
            {authing ? m.waitingForBrowser : m.authenticate}
          </Button>
        </div>
      )}
      {!saved && <p className="mt-3 text-[0.68rem] text-muted-foreground/60">{m.unsavedConnect}</p>}

      {status === 'probing' && <PageLoader className="min-h-24" label={t.skills.loading} />}

      {/* No inline error dump — the status dot/line says "Error"/"Needs
          authentication", and the actual failure lands in the logs pane below
          (and the console). A big red block here just shouts the same thing. */}

      {probe && probe !== 'probing' && probe.ok && probe.tools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {/* Chip = a discovered tool; click to include/exclude it (struck
              through when excluded, so it won't register). The probe always
              lists every tool regardless of the filter. */}
          {probe.tools.map(tool => {
            const on = isToolEnabled(entry, tool.name)

            return (
              <button
                aria-pressed={on}
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-mono text-[0.65rem] text-(--ui-text-tertiary) hover:text-foreground',
                  saved ? 'cursor-pointer' : 'cursor-default',
                  on ? 'bg-(--ui-bg-quinary)' : 'line-through opacity-70'
                )}
                disabled={!saved}
                key={tool.name}
                onClick={() => onToggleTool(tool.name)}
                title={on ? m.disableTool(tool.name) : m.enableTool(tool.name)}
                type="button"
              >
                {tool.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// The enable toggle, shared by the row and the config header. It reflects the
// configured `enabled` flag ONLY — full-strength when on, dimmed when off — so
// "is this on?" reads instantly from config, never gated on a probe that can
// take seconds (stdio servers spawn `npx`). Whether it's actually *connected*
// is the status dot's job, not the switch's.
function ServerSwitch({
  className,
  disabled,
  enabled,
  name,
  onToggle
}: {
  className?: string
  disabled: boolean
  enabled: boolean
  name: string
  onToggle: (checked: boolean) => void
}) {
  return (
    <Switch
      aria-label={name}
      checked={enabled}
      className={cn('shrink-0 cursor-pointer', !enabled && 'opacity-60', className)}
      disabled={disabled}
      onCheckedChange={onToggle}
      size="xs"
      title={name}
    />
  )
}

// Refresh + delete, identical beside every toggle (rows and config header).
function ServerIconActions({
  className,
  onProbe,
  onRemove,
  probing,
  saving
}: {
  className?: string
  onProbe: () => void
  onRemove: () => void
  probing: boolean
  saving: boolean
}) {
  const { t } = useI18n()
  const m = t.settings.mcp

  return (
    <span className={cn('flex items-center gap-0.5', className)}>
      <Tip label={m.reload}>
        <Button
          aria-label={m.reload}
          className={ICON_BUTTON}
          disabled={probing}
          onClick={onProbe}
          size="icon"
          variant="ghost"
        >
          <Codicon name="refresh" size="0.8125rem" spinning={probing} />
        </Button>
      </Tip>
      <Tip label={m.remove}>
        <Button
          aria-label={m.remove}
          className={cn(ICON_BUTTON, 'hover:text-destructive')}
          disabled={saving}
          onClick={onRemove}
          size="icon"
          variant="ghost"
        >
          <Codicon name="trash" size="0.8125rem" />
        </Button>
      </Tip>
    </span>
  )
}

// Paste-anything import: a compact popover on the Servers header. Paste any
// README shape — mcp.json snippet, npx/docker command line, `claude mcp add`,
// a bare URL, or a Cursor deeplink — see the inferred name + config, then
// merge it into the editor draft (unsaved, like the "+" starter entry).
function McpImportButton({ disabled, onImport }: { disabled: boolean; onImport: (entries: McpImportEntry[]) => void }) {
  const { t } = useI18n()
  const m = t.settings.mcp
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const entries = useMemo(() => parseMcpImport(text), [text])

  const reset = () => {
    setText('')
  }

  const confirm = () => {
    if (!entries) {
      return
    }

    onImport(entries)
    setOpen(false)
    reset()
  }

  return (
    <Popover
      onOpenChange={next => {
        setOpen(next)

        if (!next) {
          reset()
        }
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button className="h-5 px-1 text-[0.68rem]" disabled={disabled} size="xs" variant="text">
          <Codicon name="clippy" size="0.75rem" />
          {m.importButton}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label={m.importButton}
            autoFocus
            className="max-h-40 min-h-20 font-mono text-[0.68rem]"
            onChange={event => setText(event.currentTarget.value)}
            placeholder={m.importPlaceholder}
            value={text}
          />
          {entries ? (
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {entries.map((entry, index) => (
                <div className="rounded-md bg-(--ui-bg-tertiary) px-2 py-1.5" key={`${entry.name}-${index}`}>
                  <span className="block truncate text-[0.72rem] font-medium text-foreground/85">{entry.name}</span>
                  <span className="block truncate font-mono text-[0.62rem] text-muted-foreground/60">
                    {typeof entry.config.url === 'string'
                      ? entry.config.url
                      : [entry.config.command, ...((entry.config.args as string[]) ?? [])].join(' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            text.trim() && <p className="px-0.5 text-[0.62rem] text-muted-foreground/60">{m.importNoMatch}</p>
          )}
          <div className="flex justify-end">
            <Button disabled={!entries} onClick={confirm} size="xs">
              {entries && entries.length > 1 ? m.importConfirmMany(entries.length) : m.importConfirm}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Small gray attribute chip (transport / auth / needs-build), matching the
// catalog's flat row treatment.
function CatalogTag({ children }: { children: string }) {
  return (
    <span className="rounded bg-(--ui-bg-tertiary) px-1.5 py-0.5 text-[0.6rem] text-(--ui-text-secondary)">
      {children}
    </span>
  )
}

const CATALOG_INSTALL_POLL_MS = 1500

// One native catalog card: Connect / Install plus the optional env prompt.
// Rendered inside the unified directory grid — never wraps its own grid.
function CatalogInstallCard({
  entry,
  onInstalled,
  profile
}: {
  entry: McpCatalogEntry
  onInstalled: (name?: string) => void
  profile?: ProfileScope
}) {
  const { t } = useI18n()
  const m = t.settings.mcp
  const [installing, setInstalling] = useState(false)
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({})
  const [envOpen, setEnvOpen] = useState(false)

  const install = async () => {
    const required = entry.required_env.filter(env => env.required)

    if (required.some(env => !envDraft[env.name]?.trim())) {
      if (!envOpen) {
        setEnvOpen(true)

        return
      }

      notify({ kind: 'error', title: m.catalogEnvPrompt(entry.name), message: m.catalogEnvRequired })

      return
    }

    setInstalling(true)

    try {
      const res = await installMcpCatalogEntry(entry.name, envDraft, profile ?? undefined)

      if (res.background && res.action) {
        for (;;) {
          const status = await getActionStatus(res.action, 1, profile ?? undefined)

          if (!status.running) {
            if (status.exit_code !== 0) {
              throw new Error(m.catalogInstallFailed(entry.name))
            }

            break
          }

          await new Promise(resolve => setTimeout(resolve, CATALOG_INSTALL_POLL_MS))
        }
      }

      notify({ kind: 'success', title: m.catalogInstallStarted(entry.name), message: '' })
      setEnvOpen(false)
      onInstalled(entry.name)
    } catch (err) {
      notifyError(err, m.catalogInstallFailed(entry.name))
    } finally {
      setInstalling(false)
    }
  }

  const action = mcpCatalogPrimaryAction(entry.auth_type)

  const actionLabel = installing
    ? m.catalogInstalling
    : entry.installed
      ? m.catalogInstalled
      : action === 'connect'
        ? t.common.connect
        : m.catalogInstall

  return (
    <ConnectorCard
      description={entry.description}
      logo={directoryAppLogoUrl({ id: entry.name, source: 'native' })}
      name={entry.name}
      status={entry.installed ? (entry.enabled ? 'ok' : 'off') : 'unknown'}
      trailing={
        <Button disabled={entry.installed || installing} onClick={() => void install()} size="xs" variant="text">
          {actionLabel}
        </Button>
      }
    >
      {entry.needs_install && !entry.installed ? (
        <span className="mt-1">
          <CatalogTag>{m.catalogNeedsInstall}</CatalogTag>
        </span>
      ) : null}
      {envOpen && entry.required_env.length > 0 && (
        <div className="mt-2 grid gap-2">
          {entry.required_env.map(env => (
            <label className="grid gap-1" key={env.name}>
              <span className="text-[0.62rem] text-muted-foreground">
                {env.prompt || env.name}
                {env.required ? ' *' : ''}
              </span>
              <Input
                className="h-7 text-xs"
                onChange={event => setEnvDraft(prev => ({ ...prev, [env.name]: event.currentTarget.value }))}
                type="password"
                value={envDraft[env.name] ?? ''}
              />
            </label>
          ))}
        </div>
      )}
    </ConnectorCard>
  )
}

const LOG_POLL_MS = 2000

const STDIO_MARKER_RE = /^===== \[.*\] starting MCP server '(.+)' =====$/

// Keep only the stdio-log sections belonging to one server. The shared file
// has no per-line tags — sections start at that server's session marker and
// run until the next marker (any server's).
function filterStdioSections(lines: string[], server: string): string[] {
  const out: string[] = []
  let inSection = false

  for (const line of lines) {
    const marker = STDIO_MARKER_RE.exec(line.trim())

    if (marker) {
      inSection = marker[1] === server
    }

    if (inSection) {
      out.push(line)
    }
  }

  return out
}

// The MCP output channel — Cursor's "MCP Logs" equivalent, pinned under the
// editor. Scope follows the cursor-selected server (all servers otherwise);
// source controls live in the pane header. Body is the app's tool-output
// surface: CodeCardBody typography + the floating hover-reveal copy button.
function McpLogs({
  emptyLabel,
  server,
  source
}: {
  emptyLabel: string
  server: null | string
  source: 'stdio' | 'agent'
}) {
  const [lines, setLines] = useState<null | string[]>(null)
  // A profile switch reroutes getLogs to the new backend; keying the effect on
  // the active profile tears down the old poll (its `cancelled` flag blocks a
  // late setLines) so profile A's logs never flash in B.
  const activeProfile = useStore($activeGatewayProfile)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const response =
          source === 'stdio'
            ? await getLogs({ file: 'mcp', lines: 500 })
            : await getLogs({ file: 'agent', lines: 300, search: server ?? 'mcp' })

        if (!cancelled) {
          setLines(source === 'stdio' && server ? filterStdioSections(response.lines, server) : response.lines)
        }
      } catch {
        // Backend momentarily unavailable — keep the last tail.
      }
    }

    setLines(null)
    void poll()
    const timer = window.setInterval(() => void poll(), LOG_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [server, source, activeProfile])

  return <LogTail emptyLabel={emptyLabel} lines={lines} />
}

// ---------------------------------------------------------------------------
// Avatars + list rows
// ---------------------------------------------------------------------------

// Catalog avatars (native MCP + Work4You Apps) use the official Composio CDN
// mark. Packaged Electron paints it from a main-process data URL because a
// file:// renderer cannot load logos.composio.dev as <img>. Custom MCP URLs
// still never hit a favicon service — a private host must not leak off-box.
function McpAvatar({
  className,
  logo,
  name,
  status
}: {
  className?: string
  logo?: string | null
  name: string
  status: ServerStatus
}) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const { failed: proxyFailed, src: resolved } = useComposioLogoSrc(failedLogo === logo ? null : logo)
  const remote = typeof logo === 'string' && isTrustedComposioLogoUrl(logo) && failedLogo !== logo
  const src = resolved && failedLogo !== resolved ? resolved : null
  const loading = remote && !src && !proxyFailed
  const brand = src || loading ? null : brandFor(name)

  return (
    <span
      className={cn(
        'relative inline-grid size-8 shrink-0 place-items-center rounded-md text-[length:var(--conversation-caption-font-size)] font-medium',
        (src || loading) && 'bg-white',
        !src && !loading && !brand && 'bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)',
        className
      )}
      style={
        !src && !loading && brand
          ? { backgroundColor: `color-mix(in srgb, ${brand.color} 16%, transparent)` }
          : undefined
      }
    >
      {src ? (
        <img
          alt=""
          className="size-5 object-contain"
          decoding="async"
          onError={() => setFailedLogo(typeof logo === 'string' ? logo : src)}
          referrerPolicy="no-referrer"
          src={src}
        />
      ) : loading ? null : brand ? (
        <brand.Icon aria-hidden className="size-4" style={brandGlyphStyle(brand)} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
      <span
        aria-hidden
        className={cn(
          'absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-(--ui-chat-surface-background)',
          STATUS_DOT[status]
        )}
      />
    </span>
  )
}

function ConnectorCard({
  children,
  description,
  displayName,
  logo,
  name,
  onSelect,
  status,
  trailing,
  unused
}: {
  children?: ReactNode
  description: null | string
  displayName?: string
  logo?: string | null
  name: string
  onSelect?: () => void
  status: ServerStatus
  trailing?: ReactNode
  unused?: boolean
}) {
  const { t } = useI18n()
  const m = t.settings.mcp

  const title = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate text-[0.82rem] font-medium text-foreground/85">
        {displayName ?? prettyName(name)}
      </span>
      {unused && (
        <span className="shrink-0 rounded bg-(--ui-bg-tertiary) px-1 py-px text-[0.58rem] font-normal text-muted-foreground/60">
          {m.unusedPill}
        </span>
      )}
    </span>
  )

  return (
    <div
      className="group/card flex min-h-[5.75rem] flex-col rounded-lg bg-(--ui-bg-secondary)/50 p-3 ring-1 ring-(--ui-stroke-quaternary)"
      id={`mcp-server-${name}`}
    >
      <div className="flex items-start gap-2.5">
        {onSelect ? (
          <button className="flex min-w-0 flex-1 items-start gap-2.5 text-left" onClick={onSelect} type="button">
            <McpAvatar className="mt-0.5" logo={logo} name={name} status={status} />
            <span className="min-w-0 flex-1">
              {title}
              {description ? (
                <span className="mt-0.5 line-clamp-2 text-[0.68rem] text-muted-foreground/70">{description}</span>
              ) : null}
            </span>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <McpAvatar className="mt-0.5" logo={logo} name={name} status={status} />
            <div className="min-w-0 flex-1">
              {title}
              {description ? (
                <p className="mt-0.5 line-clamp-2 text-[0.68rem] text-muted-foreground/70">{description}</p>
              ) : null}
              {children}
            </div>
          </div>
        )}
        {trailing ? <div className="flex shrink-0 items-center gap-0.5">{trailing}</div> : null}
      </div>
      {onSelect ? children : null}
    </div>
  )
}
