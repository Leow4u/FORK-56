import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SearchField } from '@/components/ui/search-field'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { RefreshCw } from '@/lib/icons'
import { displayModelName } from '@/lib/model-status-label'
import { cn } from '@/lib/utils'
import {
  $visibleModels,
  effectiveVisibleKeys,
  modelVisibilityKey,
  setVisibleModels,
  toggleModelVisibility
} from '@/store/model-visibility'
import { getGlobalModelOptions } from '@/work4you'
import type { ModelOptionProvider } from '@/work4you'

import { useOnProfileSwitch } from '../hooks/use-on-profile-switch'

import { ProviderKeyRows } from './credential-key-ui'
import { useEnvCredentials } from './env-credentials'
import { settingsCatalogRows } from './model-catalog-rows'
import { SectionHeading, SettingsGroup } from './primitives'
import { buildProviderKeyGroups } from './providers-settings'

// Radix <Select> renders a blank trigger when `value` matches no <SelectItem>.
// Kept for callers that still surface a custom model outside the curated list.
export const withActive = (models: readonly string[], active: string): readonly string[] =>
  active && !models.includes(active) ? [active, ...models] : models

export function ModelSettingsSkeleton() {
  return (
    <SettingsGroup>
      <div className="grid gap-3 py-3" data-slot="model-settings-skeleton">
        <div className="h-7 w-full rounded bg-(--ui-bg-quaternary)" />
        {[0, 1, 2, 3].map(row => (
          <div className="flex items-center justify-between" key={row}>
            <div className="h-3.5 w-40 rounded bg-(--ui-bg-quaternary)" />
            <div className="h-5 w-8 rounded-full bg-(--ui-bg-quaternary)" />
          </div>
        ))}
      </div>
    </SettingsGroup>
  )
}

interface ModelSettingsProps {
  /** The composer still owns the live chat. This page no longer writes the
   *  profile model, so the callback stays on the shared settings props. */
  onMainModelChanged?: (provider: string, model: string) => void
  scopeProfile?: null | string
}

export function ModelSettings({ scopeProfile = null }: ModelSettingsProps) {
  const { t } = useI18n()
  const copy = t.settings.model
  const stored = useStore($visibleModels)
  const { rowProps, vars } = useEnvCredentials(scopeProfile)
  const [providers, setProviders] = useState<ModelOptionProvider[] | null>(null)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [openKey, setOpenKey] = useState<null | string>(null)

  const load = useCallback(
    async (refresh = false) => {
      const options = await getGlobalModelOptions(refresh ? { refresh: true } : undefined, scopeProfile)
      setProviders(options.providers ?? [])
    },
    [scopeProfile]
  )

  useEffect(() => {
    let cancelled = false

    void load().catch(() => {
      if (!cancelled) {
        setProviders([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [load])

  useOnProfileSwitch(() => {
    setProviders(null)
    setQuery('')
    setShowAll(false)
    void load().catch(() => setProviders([]))
  })

  const visible = useMemo(() => effectiveVisibleKeys(stored, providers ?? []), [providers, stored])

  const catalog = useMemo(
    () => settingsCatalogRows(providers ?? [], visible, { query, showAll }),
    [providers, query, showAll, visible]
  )

  const keyGroups = useMemo(() => (vars ? buildProviderKeyGroups(vars) : []), [vars])

  const toggle = (provider: ModelOptionProvider, model: string) => {
    setVisibleModels(toggleModelVisibility($visibleModels.get(), providers ?? [], provider.slug, model))
  }

  const refresh = async () => {
    if (refreshing) {
      return
    }

    setRefreshing(true)

    try {
      await load(true)
    } finally {
      setRefreshing(false)
    }
  }

  if (!providers) {
    return <ModelSettingsSkeleton />
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <SearchField
          aria-label={copy.searchModels}
          containerClassName="w-full"
          inputClassName="min-w-0 flex-1 [field-sizing:fixed]"
          onChange={setQuery}
          placeholder={copy.searchModels}
          recede={false}
          trailingAction={
            <Button
              aria-label={t.shell.modelMenu.refreshModels}
              disabled={refreshing}
              onClick={() => void refresh()}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            </Button>
          }
          value={query}
        />
        <div className="divide-y divide-(--ui-stroke-secondary) overflow-hidden rounded-xl border border-(--ui-stroke-secondary) bg-(--ui-bg-editor)">
          {catalog.rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
              {t.shell.modelMenu.noModels}
            </p>
          ) : (
            catalog.rows.map(({ family, provider }) => {
              const label = displayModelName(family.id)
              const checked = visible.has(modelVisibilityKey(provider.slug, family.id))

              return (
                <label
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[length:var(--conversation-text-font-size)] hover:bg-(--ui-control-hover-background)"
                  key={modelVisibilityKey(provider.slug, family.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <Switch
                    aria-label={label}
                    checked={checked}
                    onCheckedChange={() => toggle(provider, family.id)}
                    size="xs"
                  />
                </label>
              )
            })
          )}
        </div>
        {catalog.hasMore && !query ? (
          <Button
            className="justify-start px-1"
            onClick={() => setShowAll(true)}
            size="inline"
            type="button"
            variant="text"
          >
            {copy.viewAll}
          </Button>
        ) : null}
      </div>

      <div>
        <SectionHeading title={t.settings.nav.providerApiKeys} variant="group" />
        {vars && keyGroups.length === 0 ? (
          <p className="text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
            {t.settings.providers.noProviderKeys}
          </p>
        ) : (
          <div className="grid gap-2">
            {keyGroups.map(group => (
              <ProviderKeyRows
                expanded={openKey === group.name}
                group={group}
                key={group.name}
                onExpand={() => setOpenKey(group.name)}
                onToggle={() => setOpenKey(current => (current === group.name ? null : group.name))}
                rowProps={rowProps}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
