import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'
import { Loader2 } from '@/lib/icons'
import { displayModelName } from '@/lib/model-status-label'
import { menuReasoningEffort, visibleReasoningEfforts } from '@/lib/reasoning-effort'
import { cn } from '@/lib/utils'
import { setMainModelAssignment } from '@/store/cron-model-impact'
import { notifyError } from '@/store/notifications'
import { getGlobalModelInfo, getGlobalModelOptions, saveWork4YouConfig } from '@/work4you'
import type { ModelOptionProvider } from '@/work4you'

import { useWork4YouConfigRecord, work4youConfigCacheWriter } from '../hooks/use-config-record'
import { useOnProfileSwitch } from '../hooks/use-on-profile-switch'

import { CONTROL_TEXT } from './constants'
import { getNested, setNested } from './helpers'
import { ListRow, SettingsGroup, ToggleRow } from './primitives'

function unavailableModelsFor(providers: ModelOptionProvider[], slug: string): Set<string> {
  return new Set(providers.find(provider => provider.slug === slug)?.unavailable_models ?? [])
}

function settingsModelLabel(model: string): string {
  return displayModelName(model)
}

// Skeleton mirror of the Model settings DOM so the page keeps its shape while
// the catalog loads. Same containers/rhythm as the real render below.
export function ModelSettingsSkeleton() {
  return (
    <SettingsGroup>
      <div className="grid gap-1" data-slot="model-settings-skeleton">
        {[0, 1, 2].map(row => (
          <div className="grid gap-3 py-3 @xl:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)] @xl:items-center" key={row}>
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
            <Skeleton className="h-8 w-full @xl:w-56 @xl:justify-self-end" />
          </div>
        ))}
      </div>
    </SettingsGroup>
  )
}

// agent.service_tier stores "fast"/"priority"/"on" for fast; anything else is
// normal (mirrors tui_gateway _load_service_tier).
const isFastTier = (tier: unknown): boolean =>
  ['fast', 'priority', 'on'].includes(
    String(tier ?? '')
      .trim()
      .toLowerCase()
  )

// Radix <Select> renders a blank trigger when `value` matches no <SelectItem>.
// A custom model (e.g. one added via config that isn't in the provider's
// curated list) would vanish — surface the active value so it stays selectable.
export const withActive = (models: readonly string[], active: string): readonly string[] =>
  active && !models.includes(active) ? [active, ...models] : models

const isBlank = (value: unknown): boolean => value == null || (typeof value === 'string' && !value.trim())

interface ModelSettingsProps {
  /** Notified after the main model is applied, so live UI stores can sync. */
  onMainModelChanged?: (provider: string, model: string) => void
  /** Shared settings "Applies to" scope: a concrete profile to edit instead of
   *  the app's active one, or null to follow the active profile (default). */
  scopeProfile?: null | string
}

export function ModelSettings({ onMainModelChanged, scopeProfile = null }: ModelSettingsProps) {
  const { t } = useI18n()
  const m = t.settings.model
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mainModel, setMainModel] = useState<{ model: string; provider: string } | null>(null)
  const [providers, setProviders] = useState<ModelOptionProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  // agent.* defaults round-trip through the shared config cache (read → write
  // back the whole record), so a save here shows in the MCP/model surfaces.
  const { data: config } = useWork4YouConfigRecord(scopeProfile)
  const setConfig = useMemo(() => work4youConfigCacheWriter(scopeProfile), [scopeProfile])
  const [applying, setApplying] = useState(false)

  // Every profile-scoped async here captures this and bails before writing back,
  // so a request in flight when the user switches profiles can't paint profile
  // A's models into profile B (or fire onMainModelChanged for A).
  const profileEpoch = useRef(0)

  const refresh = useCallback(
    async ({ replaceSelection = false }: { replaceSelection?: boolean } = {}) => {
      const epoch = profileEpoch.current
      setLoading(true)
      setError('')

      try {
        const [modelInfo, modelOptions] = await Promise.all([
          getGlobalModelInfo(scopeProfile),
          getGlobalModelOptions(undefined, scopeProfile)
        ])

        if (profileEpoch.current !== epoch) {
          return
        }

        setMainModel({ model: modelInfo.model, provider: modelInfo.provider })
        setProviders(modelOptions.providers || [])

        if (replaceSelection) {
          setSelectedProvider(modelInfo.provider)
          setSelectedModel(modelInfo.model)
        } else {
          setSelectedProvider(prev => prev || modelInfo.provider)
          setSelectedModel(prev => prev || modelInfo.model)
        }
      } catch (err) {
        if (profileEpoch.current === epoch) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (profileEpoch.current === epoch) {
          setLoading(false)
        }
      }
    },
    [scopeProfile]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  // A profile switch swaps the backend under the mounted panel — reload for the
  // new profile (bumping the epoch first so any in-flight A request is discarded).
  useOnProfileSwitch(() => {
    profileEpoch.current += 1
    // The panel stays mounted across profile switches, so clear the previous
    // profile's draft selection before loading the new profile's source of
    // truth. Ordinary same-profile refreshes still preserve in-progress edits.
    setSelectedProvider('')
    setSelectedModel('')
    void refresh({ replaceSelection: true })
  })

  const selectedProviderRow = useMemo(
    () => providers.find(provider => provider.slug === selectedProvider),
    [providers, selectedProvider]
  )

  const modelChoices = withActive(selectedProviderRow?.models ?? [], selectedModel)

  // Capabilities of the APPLIED main model — gates the profile-default
  // reasoning/speed controls the same way the composer picker gates per-model
  // edits (reasoning defaults on, fast defaults off when unreported).
  const mainCaps = useMemo(() => {
    const row = providers.find(provider => provider.slug === mainModel?.provider)

    return mainModel ? row?.capabilities?.[mainModel.model] : undefined
  }, [providers, mainModel])

  const reasoningSupported = mainCaps?.reasoning ?? true
  const fastSupported = mainCaps?.fast ?? false

  // Hand-written `reasoning_effort: false`/`off` reaches us as boolean false
  // ("false" once stringified) — show it as Off, not an empty select.
  const rawEffort = String(getNested(config ?? {}, 'agent.reasoning_effort') ?? '')
    .trim()
    .toLowerCase()

  // Blank means the platform birth (High / Fast), not the old medium/off fallback.
  const effortValue = rawEffort === 'false' || rawEffort === 'disabled' ? 'none' : rawEffort || 'high'

  const tierRaw = String(getNested(config ?? {}, 'agent.service_tier') ?? '')
    .trim()
    .toLowerCase()

  const fastOn = tierRaw === '' || isFastTier(tierRaw)

  // Persist a single agent.* default by round-tripping the whole config record
  // (PUT /api/config replaces it) — optimistic, with rollback on failure.
  const writeAgentDefault = useCallback(
    async (key: string, value: string) => {
      if (!config) {
        return
      }

      const prev = config
      const next = setNested(config, key, value)
      setConfig(next)

      try {
        await saveWork4YouConfig(next, scopeProfile ?? undefined)
      } catch (err) {
        setConfig(prev)
        notifyError(err, m.defaultsFailed)
      }
    },
    [config, m.defaultsFailed, scopeProfile, setConfig]
  )

  // Persist the birth once when the saved profile never chose. Explicit
  // medium/normal values are non-blank and are not rewritten.
  useEffect(() => {
    if (!config) {
      return
    }

    const effort = getNested(config, 'agent.reasoning_effort')
    const tier = getNested(config, 'agent.service_tier')

    if (isBlank(effort)) {
      void writeAgentDefault('agent.reasoning_effort', 'high')
    } else if (isBlank(tier)) {
      void writeAgentDefault('agent.service_tier', 'fast')
    }
  }, [config, writeAgentDefault])

  const applyMainModel = useCallback(async () => {
    if (!selectedProvider || !selectedModel) {
      return
    }

    if (unavailableModelsFor(providers, selectedProvider).has(selectedModel)) {
      return
    }

    const epoch = profileEpoch.current
    setApplying(true)
    setError('')

    try {
      const result = await setMainModelAssignment(
        {
          model: selectedModel,
          provider: selectedProvider,
          ...(selectedProviderRow?.api_url ? { base_url: selectedProviderRow.api_url } : {})
        },
        scopeProfile
      )

      if (profileEpoch.current !== epoch) {
        return
      }

      const provider = result.provider || selectedProvider
      const model = result.model || selectedModel
      setMainModel({ provider, model })

      // Live UI stores mirror the ACTIVE profile's model; a scoped apply
      // changed a different profile and must not repaint them.
      if (scopeProfile == null) {
        onMainModelChanged?.(provider, model)
      }

      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApplying(false)
    }
  }, [onMainModelChanged, providers, refresh, scopeProfile, selectedModel, selectedProvider, selectedProviderRow])

  if (loading && !mainModel) {
    return <ModelSettingsSkeleton />
  }

  return (
    <div className="grid gap-6">
      <SettingsGroup>
        <ListRow
          action={
            modelChoices.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <Select onValueChange={setSelectedModel} value={selectedModel}>
                  <SelectTrigger className={cn('min-w-44', CONTROL_TEXT)}>
                    <SelectValue placeholder={m.model} />
                  </SelectTrigger>
                  <SelectContent>
                    {modelChoices.map(model => {
                      const locked = unavailableModelsFor(providers, selectedProvider).has(model)

                      return (
                        <SelectItem disabled={locked} key={model} value={model}>
                          {settingsModelLabel(model)}
                          {locked ? (
                            <Codicon
                              className="ml-1 opacity-80"
                              name="lock"
                              size="0.75rem"
                              title={t.modelPicker.proNeedsSubscription}
                            />
                          ) : null}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Button
                  disabled={
                    !selectedProvider ||
                    !selectedModel ||
                    applying ||
                    unavailableModelsFor(providers, selectedProvider).has(selectedModel)
                  }
                  onClick={() => void applyMainModel()}
                  size="sm"
                  variant="secondary"
                >
                  {applying && <Loader2 className="size-3.5 animate-spin" />}
                  {applying ? m.applying : t.common.apply}
                </Button>
              </div>
            ) : null
          }
          description={m.appliesDesc}
          title={m.model}
        />
        {config && mainModel && reasoningSupported && (
          <ListRow
            action={
              <Select
                onValueChange={value => void writeAgentDefault('agent.reasoning_effort', value)}
                value={menuReasoningEffort(effortValue, mainModel.model)}
              >
                <SelectTrigger className={cn('min-w-28', CONTROL_TEXT)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['none', ...visibleReasoningEfforts(mainModel.model)] as const).map(value => (
                    <SelectItem key={value} value={value}>
                      {value === 'none' ? m.reasoningOff : t.shell.modelOptions[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            title={m.reasoning}
          />
        )}
        {config && mainModel && fastSupported && (
          <ToggleRow
            checked={fastOn}
            label={t.shell.modelOptions.fast}
            onChange={checked => void writeAgentDefault('agent.service_tier', checked ? 'fast' : 'normal')}
          />
        )}
        {error && <div className="py-2 text-xs text-destructive">{error}</div>}
      </SettingsGroup>
    </div>
  )
}
