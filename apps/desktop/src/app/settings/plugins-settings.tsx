import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { CapabilitiesSection } from '@/app/skills/capabilities-section'
import { type CapabilitiesCategory, CapabilitiesToolbar } from '@/app/skills/capabilities-toolbar'
import { $pluginsCategory, $pluginsView } from '@/app/skills/store'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { $pluginRecords, type PluginRecord, setPluginEnabled } from '@/contrib/plugins-store'
import { discoverRuntimePlugins } from '@/contrib/runtime-loader'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { normalize } from '@/lib/text'
import {
  $agentPluginBusy,
  $agentPlugins,
  $agentPluginsError,
  $agentPluginsStatus,
  agentPluginCategory,
  type AgentPluginRow,
  isAgentPluginInstalled,
  isDesktopRelevantPlugin,
  loadAgentPlugins,
  toggleAgentPlugin
} from '@/store/agent-plugins'
import { openPluginInstallRequest } from '@/store/plugin-install-request'
import { $activeGatewayProfile } from '@/store/profile'
import { $gatewayState } from '@/store/session'
import { getProfiles, type ProfileScope } from '@/work4you'

import { ListStripMenu } from '../master-detail'

import { prettyName } from './helpers'
import { PluginDiscoverCard } from './plugin-discover-card'
import { PluginListRow } from './plugin-list-row'
import { EmptyState, ListRowSkeleton, Pill, SectionHeading, SettingsContent } from './primitives'
import { settingsScopeLabel } from './profile-scope'
import { ProfileScopeSelect } from './profile-scope-select'
import { useDeepLinkHighlight } from './use-deep-link-highlight'

const KIND_ORDER: Record<PluginRecord['kind'], number> = { disk: 0, runtime: 1, bundled: 2 }

// User-installed plugins first — mirrors `work4you plugins list --user`.
const SOURCE_ORDER: Record<string, number> = { user: 0, git: 0, project: 1, entrypoint: 2, bundled: 3 }

// The desktop (renderer) inventory is its own category in the filter.
const DESKTOP_CATEGORY = 'desktop'

const agentPluginRowKey = (row: AgentPluginRow) =>
  row.key ?? [row.name, row.source, row.version, row.description].join('\0')

/** Deep-link anchor for a plugin row (`?tab=plugins&plugin=<id>`). */
export const pluginElementId = (target: string) => `plugin-${target}`

function reveal(file: string) {
  void window.work4youDesktop?.revealPath?.(file)?.catch(() => undefined)
}

function scopeProfileName(scope: ProfileScope | undefined): string | null {
  if (!scope) {
    return null
  }

  if (typeof scope === 'string') {
    return scope.trim() || null
  }

  return (scope.profile ?? '').trim() || null
}

const matchesAgentRow = (row: AgentPluginRow, needle: string) =>
  !needle ||
  row.name.toLowerCase().includes(needle) ||
  (row.key ?? '').toLowerCase().includes(needle) ||
  row.description.toLowerCase().includes(needle)

const matchesRecord = (record: PluginRecord, needle: string) =>
  !needle ||
  record.name.toLowerCase().includes(needle) ||
  record.id.toLowerCase().includes(needle) ||
  (record.description ?? '').toLowerCase().includes(needle)

// Category order in the filter and in Discover: Desktop, General, then the
// registry dirs alphabetically.
const categoryRank = (id: string) => (id === DESKTOP_CATEGORY ? 0 : id === 'general' ? 1 : 2)

const compareCategories = (a: string, b: string) => categoryRank(a) - categoryRank(b) || a.localeCompare(b)

function AgentPluginRowView({ row, profile }: { row: AgentPluginRow; profile: string | null }) {
  const { t } = useI18n()
  const p = t.settings.plugins
  const { requestGateway } = useGatewayRequest()
  const busy = useStore($agentPluginBusy)
  const key = row.key

  // Pre-contract-v6 backends return rows without a canonical key. Name-addressed
  // toggles silently flip every same-named plugin across category dirs
  // (image_gen/fal vs video_gen/fal), so keyless rows are read-only — the
  // backend-contract skew toast tells the user to update.
  const toggle = (
    <Switch
      aria-label={`${row.status === 'enabled' ? p.disable : p.enable} ${row.name}`}
      checked={row.status === 'enabled'}
      disabled={!key || busy === key}
      onCheckedChange={on => {
        if (!key) {
          return
        }

        triggerHaptic('selection')
        void toggleAgentPlugin(requestGateway, key, on, p.agent.toggleFailed(row.name), profile)
      }}
      size="xs"
    />
  )

  return (
    <PluginListRow
      controls={key ? toggle : <Tip label={p.agent.updateBackendToManage}>{toggle}</Tip>}
      description={row.description || (row.version ? `v${row.version}` : undefined)}
      id={pluginElementId(key ?? row.name)}
      name={row.name}
      tags={
        <>
          <Pill>{p.agent.sources[row.source] ?? row.source}</Pill>
          {row.portable && <Pill tone="primary">{p.agent.portable}</Pill>}
        </>
      }
    />
  )
}

// A bundled plugin nobody enabled yet. Enabling it is the same toggle the
// Installed switch sends; once the backend confirms, the row is installed and
// moves over on its own.
function AgentPluginDiscoverView({ row, profile }: { row: AgentPluginRow; profile: string | null }) {
  const { t } = useI18n()
  const p = t.settings.plugins
  const { requestGateway } = useGatewayRequest()
  const busy = useStore($agentPluginBusy)
  const key = row.key

  const action = (
    <Button
      disabled={!key || busy === key}
      onClick={() => {
        if (!key) {
          return
        }

        triggerHaptic('selection')
        void toggleAgentPlugin(requestGateway, key, true, p.agent.toggleFailed(row.name), profile)
      }}
      size="xs"
      variant="text"
    >
      {busy === key ? p.enabling : p.enable}
    </Button>
  )

  return (
    <PluginDiscoverCard
      action={key ? action : <Tip label={p.agent.updateBackendToManage}>{action}</Tip>}
      description={row.description || (row.version ? `v${row.version}` : undefined)}
      id={pluginElementId(key ?? row.name)}
      name={row.name}
      tags={<Pill>{p.agent.sources[row.source] ?? row.source}</Pill>}
    />
  )
}

function DesktopPluginRow({ record }: { record: PluginRecord }) {
  const { t } = useI18n()
  const p = t.settings.plugins

  return (
    <PluginListRow
      controls={
        <>
          {record.file && (
            <Tip label={p.reveal}>
              <Button onClick={() => reveal(record.file!)} size="icon" variant="ghost">
                <Codicon name="folder-opened" size="0.85rem" />
              </Button>
            </Tip>
          )}
          <Switch
            aria-label={`${record.status === 'disabled' ? p.enable : p.disable} ${record.name}`}
            checked={record.status !== 'disabled'}
            onCheckedChange={on => {
              triggerHaptic('selection')
              void setPluginEnabled(record.id, on)
            }}
            size="xs"
          />
        </>
      }
      description={
        record.status === 'error' ? (
          <span className="text-(--ui-danger,#f87171)">{record.error}</span>
        ) : (
          (record.description ?? record.file ?? record.id)
        )
      }
      id={pluginElementId(record.id)}
      name={record.name}
      tags={
        <>
          <Pill>{p.kinds[record.kind]}</Pill>
          {record.status === 'error' && <Pill tone="primary">{p.failed}</Pill>}
        </>
      }
    />
  )
}

// "Add → Install plugin": asks for the repository, then hands it to the
// install flow (PluginInstallModal), which inspects the repo before anything
// is written — the same path the work4you://plugin/install deeplink takes.
function PluginInstallPrompt({ onOpenChange, open }: { onOpenChange: (open: boolean) => void; open: boolean }) {
  const { t } = useI18n()
  const m = t.settings.plugins.installModal
  const [repo, setRepo] = useState('')
  const value = repo.trim()

  const submit = () => {
    if (!value) {
      return
    }

    openPluginInstallRequest({ repo: value })
    setRepo('')
    onOpenChange(false)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{m.title}</DialogTitle>
          <DialogDescription>{m.description}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={event => {
            event.preventDefault()
            submit()
          }}
        >
          <label className="text-xs text-(--ui-text-tertiary)" htmlFor="plugin-install-repo">
            {m.repoLabel}
          </label>
          <Input
            autoFocus
            id="plugin-install-repo"
            onChange={event => setRepo(event.target.value)}
            placeholder={m.repoPlaceholder}
            spellCheck={false}
            value={repo}
          />
        </form>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {t.common.cancel}
          </Button>
          <Button disabled={!value} onClick={submit}>
            {m.install}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PluginsSettings({
  embedded = false,
  profile,
  query: externalQuery
}: {
  embedded?: boolean
  profile?: ProfileScope
  query?: string
} = {}) {
  const { t } = useI18n()
  const p = t.settings.plugins
  const { requestGateway } = useGatewayRequest()
  const gatewayState = useStore($gatewayState)
  const records = useStore($pluginRecords)
  const agentRows = useStore($agentPlugins)
  const agentStatus = useStore($agentPluginsStatus)
  const agentError = useStore($agentPluginsError)
  // The Capabilities toolbar owns the view and the category (app/skills/store.ts).
  const view = useStore($pluginsView)
  const category = useStore($pluginsCategory)
  const [localQuery, setLocalQuery] = useState('')
  const [installOpen, setInstallOpen] = useState(false)
  const query = externalQuery ?? localQuery
  const needle = normalize(query)

  // Which profile's plugins we list/toggle (not a multi-profile bind).
  // Defaults to the app-wide active profile; overriding it here lets the user
  // manage ANY profile's plugins without switching the whole app. On
  // Capabilities the page selector owns that choice, so this one stays hidden.
  // null = the active profile — the RPC is sent without a profile param so
  // older backends keep working unchanged.
  const activeProfile = useStore($activeGatewayProfile)
  const [scopeOverride, setScopeOverride] = useState<null | string>(null)
  const embeddedName = embedded ? scopeProfileName(profile) : null
  const scopeProfile = embedded ? (embeddedName ?? activeProfile ?? null) : (scopeOverride ?? activeProfile ?? null)

  const requestProfile = embedded
    ? embeddedName && embeddedName !== activeProfile
      ? embeddedName
      : null
    : scopeOverride && scopeOverride !== activeProfile
      ? scopeOverride
      : null

  const { data: profilesData } = useQuery({
    enabled: !embedded,
    queryKey: ['agent-plugins-profiles'],
    queryFn: getProfiles,
    staleTime: 60_000
  })

  const profiles = profilesData?.profiles ?? []

  // An app-wide profile switch retargets the default scope — drop the
  // override so the list reloads for the profile the user just switched to.
  useEffect(() => {
    setScopeOverride(null)
  }, [activeProfile])

  useEffect(() => {
    if (gatewayState !== 'open') {
      return
    }

    void loadAgentPlugins(requestGateway, requestProfile)
  }, [gatewayState, requestGateway, requestProfile])

  // Deep-link from settings search (?plugin=<id or key>): rows render as soon
  // as their store hydrates, so "ready" is simply target-present; the polling
  // in the hook rides out the async list loads (agent rows arrive via RPC).
  useDeepLinkHighlight({
    param: 'plugin',
    ready: () => true,
    elementId: pluginElementId
  })

  // Desktop (renderer) plugins are always installed: bundled with the app or
  // dropped into its folder. Search only narrows them.
  const desktopRows = Object.values(records)
    .filter(record => matchesRecord(record, needle))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name))

  const relevantRows = agentRows.filter(isDesktopRelevantPlugin).filter(row => matchesAgentRow(row, needle))

  const installedRows = relevantRows
    .filter(isAgentPluginInstalled)
    .sort((a, b) => (SOURCE_ORDER[a.source] ?? 9) - (SOURCE_ORDER[b.source] ?? 9) || a.name.localeCompare(b.name))

  const discoverRows = relevantRows
    .filter(row => !isAgentPluginInstalled(row))
    .sort((a, b) => compareCategories(agentPluginCategory(a), agentPluginCategory(b)) || a.name.localeCompare(b.name))

  const categoryLabel = (id: string) =>
    id === DESKTOP_CATEGORY ? p.categoryDesktop : id === 'general' ? p.categoryGeneral : prettyName(id)

  // The filter lists the categories of the current view, with their counts.
  const counts = new Map<string, number>()

  if (view === 'mine') {
    if (desktopRows.length) {
      counts.set(DESKTOP_CATEGORY, desktopRows.length)
    }

    for (const row of installedRows) {
      const id = agentPluginCategory(row)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  } else {
    for (const row of discoverRows) {
      const id = agentPluginCategory(row)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }

  const categories: CapabilitiesCategory[] = [...counts]
    .sort(([a], [b]) => compareCategories(a, b))
    .map(([id, count]) => ({ id, label: categoryLabel(id), count }))

  // A category picked in one view may not exist in the other (or after a
  // reload): fall back to "all" rather than filtering everything away.
  const categoryKnown = category === 'all' || categories.some(entry => entry.id === category)

  useEffect(() => {
    if (agentStatus === 'ready' && !categoryKnown) {
      $pluginsCategory.set('all')
    }
  }, [agentStatus, categoryKnown])

  const inCategory = (id: string) => !categoryKnown || category === 'all' || category === id

  const visibleInstalled = installedRows.filter(row => inCategory(agentPluginCategory(row)))
  const visibleDiscover = discoverRows.filter(row => inCategory(agentPluginCategory(row)))

  const agentBody = (rows: AgentPluginRow[], emptyTitle: string, render: (rows: AgentPluginRow[]) => ReactNode) =>
    agentStatus === 'loading' || agentStatus === 'idle' ? (
      <div>
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    ) : agentStatus === 'error' ? (
      <EmptyState description={agentError ?? undefined} title={p.agent.loadFailed} />
    ) : rows.length === 0 ? (
      needle ? (
        <p className="px-1 py-3 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
          {p.agent.noMatches}
        </p>
      ) : (
        <EmptyState className="min-h-32" title={emptyTitle} />
      )
    ) : (
      render(rows)
    )

  const toolbar = (
    <CapabilitiesToolbar
      addItems={[{ label: p.installModal.title, onSelect: () => setInstallOpen(true) }]}
      categories={categories}
      category={categoryKnown ? category : 'all'}
      menu={
        <ListStripMenu
          items={[{ label: p.reloadDesktop, onSelect: () => void discoverRuntimePlugins() }]}
          label={t.skills.tabPlugins}
        />
      }
      mineLabel={t.skills.viewInstalled}
      onCategoryChange={value => $pluginsCategory.set(value)}
      onViewChange={next => $pluginsView.set(next)}
      view={view}
    />
  )

  // Discover groups by category; Installed keeps the Desktop / Agent split.
  const discoverGroups = new Map<string, AgentPluginRow[]>()

  for (const row of visibleDiscover) {
    const id = agentPluginCategory(row)
    discoverGroups.set(id, [...(discoverGroups.get(id) ?? []), row])
  }

  const body =
    view === 'discover' ? (
      agentBody(visibleDiscover, p.discoverEmpty, rows =>
        [...discoverGroups].map(([id, group]) => (
          <CapabilitiesSection key={id} label={categoryLabel(id)}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.map(row => (
                <AgentPluginDiscoverView key={agentPluginRowKey(row)} profile={requestProfile} row={row} />
              ))}
            </div>
          </CapabilitiesSection>
        ))
      )
    ) : (
      <>
        {inCategory(DESKTOP_CATEGORY) && !(needle && desktopRows.length === 0) && (
          <CapabilitiesSection count={desktopRows.length} label={p.title}>
            {desktopRows.length === 0 ? (
              <EmptyState className="min-h-32" title={p.empty} />
            ) : (
              <div>
                {desktopRows.map(record => (
                  <DesktopPluginRow key={record.id} record={record} />
                ))}
              </div>
            )}
          </CapabilitiesSection>
        )}
        {(category === 'all' || category !== DESKTOP_CATEGORY || !categoryKnown) && (
          <CapabilitiesSection
            count={agentStatus === 'ready' ? visibleInstalled.length : undefined}
            label={p.agent.title}
          >
            {agentBody(visibleInstalled, p.agent.empty, rows => (
              <div>
                {rows.map(row => (
                  <AgentPluginRowView key={agentPluginRowKey(row)} profile={requestProfile} row={row} />
                ))}
              </div>
            ))}
          </CapabilitiesSection>
        )}
      </>
    )

  return (
    <SettingsContent>
      {!embedded && <SectionHeading title={t.settings.nav.plugins} variant="page" />}

      {!embedded && profiles.length > 1 && (
        <ProfileScopeSelect
          className="mb-2"
          label={t.skills.configuringProfile}
          onChange={name => setScopeOverride(name === activeProfile ? null : name)}
          options={profiles.map(entry => ({
            key: entry.name,
            label: settingsScopeLabel(entry),
            profile: entry.name,
            value: entry.name
          }))}
          value={scopeProfile ?? ''}
        />
      )}

      {externalQuery === undefined && (
        <input
          className="mb-2 w-full rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) px-3 py-1.5 text-[length:var(--conversation-caption-font-size)] outline-none placeholder:text-(--ui-text-tertiary) focus:border-(--ui-stroke-secondary)"
          onChange={event => setLocalQuery(event.target.value)}
          placeholder={p.agent.search}
          spellCheck={false}
          value={localQuery}
        />
      )}

      <div className="flex flex-col gap-4">
        {toolbar}
        {body}
      </div>

      <PluginInstallPrompt onOpenChange={setInstallOpen} open={installOpen} />
    </SettingsContent>
  )
}
