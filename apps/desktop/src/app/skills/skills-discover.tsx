import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { PageLoader } from '@/components/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { $hubActions, $hubInstalledOverride, HUB_SOURCES_KEY, installHubSkill } from '@/store/hub-actions'
import { notify, notifyError } from '@/store/notifications'
import type { SkillHubResult } from '@/types/work4you'
import { getSkillHubSources, previewSkillHub, type ProfileScope, profileScopeKey, searchSkillsHub } from '@/work4you'

import { useDebounced } from '../hooks/use-debounced'
import { PanelEmpty } from '../overlays/panel'

import { CapabilitiesSection } from './capabilities-section'

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_LIMIT = 50

/** The hub REST routes take the profile NAME; a roster scope carries it inside. */
function profileName(scope: ProfileScope | undefined): null | string {
  if (!scope) {
    return null
  }

  if (typeof scope === 'string') {
    return scope.trim() || null
  }

  return (scope.profile ?? '').trim() || null
}

/**
 * Skills → Discover: the skill hub rendered in-app. Featured skills from the
 * official index until the page search field has a query, then the hub's
 * search results. Installs go through the same store pipeline the rest of
 * the app uses (background action, tailed log, Skills-list refresh), so an
 * installed skill shows up in the Installed view without a reload.
 */
export function SkillsDiscover({
  installedNames,
  profile,
  query
}: {
  installedNames: ReadonlySet<string>
  profile?: ProfileScope
  query: string
}) {
  const { t } = useI18n()
  const h = t.skills.hub
  const scopeKey = profileScopeKey(profile)
  const name = profileName(profile)
  const needle = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS)
  const searching = needle.length > 0
  const actions = useStore($hubActions)
  const overrides = useStore($hubInstalledOverride)
  const [previewing, setPreviewing] = useState<null | string>(null)

  const sources = useQuery({
    queryKey: [...HUB_SOURCES_KEY, scopeKey],
    queryFn: () => getSkillHubSources(name),
    staleTime: 60_000
  })

  const search = useQuery({
    queryKey: ['skill-hub-search', scopeKey, needle],
    queryFn: () => searchSkillsHub(needle, 'all', SEARCH_LIMIT, name),
    enabled: searching,
    staleTime: 60_000
  })

  const results: SkillHubResult[] = searching ? (search.data?.results ?? []) : (sources.data?.featured ?? [])
  const installedMap = (searching ? search.data?.installed : sources.data?.installed) ?? {}
  const loading = searching ? search.isLoading : sources.isLoading
  const error = searching ? search.error : sources.error

  const isInstalled = (result: SkillHubResult) =>
    overrides[result.identifier] ?? (installedNames.has(result.name) || Boolean(installedMap[result.identifier]))

  const install = (result: SkillHubResult) => {
    notify({ kind: 'success', title: h.installStarted(result.name), message: h.actionLog })
    void installHubSkill(result.identifier, profile).catch(err => notifyError(err, h.actionFailed))
  }

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <PageLoader className="min-h-24" label={searching ? h.searching : h.connectingHubs} />
      ) : error ? (
        <PanelEmpty
          description={error instanceof Error ? error.message : undefined}
          icon="error"
          title={searching ? h.searchFailed : h.loadFailed}
        />
      ) : results.length === 0 ? (
        <PanelEmpty icon="search" title={h.noResults} />
      ) : (
        <CapabilitiesSection count={results.length} label={searching ? h.search : h.featured}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {results.map(result => (
              <li key={result.identifier}>
                <HubSkillCard
                  installed={isInstalled(result)}
                  installing={actions[result.identifier]?.running ?? false}
                  onInstall={() => install(result)}
                  onPreview={() => setPreviewing(result.identifier)}
                  result={result}
                />
              </li>
            ))}
          </ul>
        </CapabilitiesSection>
      )}
      <HubPreviewDialog identifier={previewing} onClose={() => setPreviewing(null)} profile={name} />
    </div>
  )
}

function HubSkillCard({
  installed,
  installing,
  onInstall,
  onPreview,
  result
}: {
  installed: boolean
  installing: boolean
  onInstall: () => void
  onPreview: () => void
  result: SkillHubResult
}) {
  const { t } = useI18n()
  const h = t.skills.hub
  const trust = h.trust[result.trust_level as keyof typeof h.trust]

  return (
    <div className="flex items-start gap-3 rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-(--ui-stroke-tertiary) text-(--ui-text-secondary)">
        <Codicon name="zap" size="1rem" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{result.name}</span>
          {trust && (
            <Badge className="normal-case" variant="muted">
              {trust}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{result.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button onClick={onPreview} size="xs" variant="text">
          {h.preview}
        </Button>
        {installed ? (
          <span className="px-1 text-[0.72rem] text-(--ui-text-tertiary)">{h.installed}</span>
        ) : (
          <Button disabled={installing} onClick={onInstall} size="xs" variant="text">
            {installing ? h.installing : h.install}
          </Button>
        )}
      </div>
    </div>
  )
}

function HubPreviewDialog({
  identifier,
  onClose,
  profile
}: {
  identifier: null | string
  onClose: () => void
  profile: null | string
}) {
  const { t } = useI18n()
  const h = t.skills.hub

  const preview = useQuery({
    queryKey: ['skill-hub-preview', profile ?? '', identifier],
    queryFn: () => previewSkillHub(identifier ?? '', profile),
    enabled: identifier !== null,
    staleTime: 60_000
  })

  return (
    <Dialog
      onOpenChange={open => {
        if (!open) {
          onClose()
        }
      }}
      open={identifier !== null}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{preview.data?.name ?? identifier ?? ''}</DialogTitle>
        </DialogHeader>
        {preview.isLoading ? (
          <PageLoader className="min-h-24" label={t.common.loading} />
        ) : preview.error ? (
          <p className="text-xs text-muted-foreground">{h.previewFailed}</p>
        ) : (
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-(--ui-bg-tertiary) p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
            {preview.data?.skill_md || h.noReadme}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  )
}
