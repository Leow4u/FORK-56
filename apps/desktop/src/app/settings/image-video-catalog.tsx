import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { IMAGE_GEN_SUBSCRIPTION_PROVIDER } from '@/lib/desktop-toolsets'
import { Check, ChevronDown, Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import type { ToolsetModel, ToolsetModelsResponse } from '@/types/work4you'
import { getToolsetModels, type ProfileScope, selectToolsetModel } from '@/work4you'

import { resolveModelBrand } from './model-brand'
import { ModelBrandLogo } from './model-brand-logo'
import { modelMarks } from './model-mark'
import { Pill, SectionHeading } from './primitives'

function modelMeta(model: ToolsetModel): string {
  return [model.speed, model.strengths, model.price]
    .map(part => part.trim())
    .filter(Boolean)
    .join(' · ')
}

export function ImageVideoCatalog({
  label,
  profile,
  toolset
}: {
  label: string
  profile: ProfileScope
  toolset: string
}) {
  const { t } = useI18n()
  const copy = t.settings.toolsets
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const queryKey = ['settings-image-video-models', toolset, profile] as const

  const modelsQuery = useQuery({
    queryFn: () => getToolsetModels(toolset, IMAGE_GEN_SUBSCRIPTION_PROVIDER, profile),
    queryKey
  })

  const catalog = modelsQuery.data
  const models = catalog?.has_models ? catalog.models : []
  const selected = catalog?.current ?? catalog?.default ?? null
  const marks = modelMarks(models.map(model => model.display || model.id))
  const pinned = models.filter(model => model.id === selected)
  const collapsedRows = pinned.length > 0 ? pinned : models.slice(0, 1)
  const visible = open ? models : collapsedRows
  const moreCount = models.length - collapsedRows.length

  const pick = async (modelId: string) => {
    if (saving !== null || selected === modelId) {
      return
    }

    setSaving(modelId)

    try {
      await selectToolsetModel(toolset, modelId, IMAGE_GEN_SUBSCRIPTION_PROVIDER, profile)
      queryClient.setQueryData<ToolsetModelsResponse>(queryKey, current =>
        current ? { ...current, current: modelId } : current
      )
      notify({ kind: 'success', title: copy.modelSelectedTitle, message: copy.modelSelectedMessage(modelId) })
    } catch (err) {
      notifyError(err, copy.failedSelectModel(modelId))
    } finally {
      setSaving(null)
    }
  }

  if (modelsQuery.isLoading) {
    return (
      <section className="mb-6 last:mb-0">
        <SectionHeading title={label} variant="group" />
        <p className="px-1 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
          {copy.loadingModels}
        </p>
      </section>
    )
  }

  if (!catalog || models.length === 0) {
    return null
  }

  return (
    <section className="mb-6 last:mb-0">
      <SectionHeading
        aside={
          <span className="text-[length:var(--conversation-caption-font-size)] font-normal text-(--ui-text-tertiary)">
            {copy.modelCount(models.length)}
          </span>
        }
        title={label}
        variant="group"
      />
      <div
        aria-label={label}
        className="overflow-hidden rounded-xl border border-(--ui-stroke-secondary) bg-(--ui-bg-editor)"
        role="radiogroup"
      >
        {visible.map(model => {
          const name = model.display || model.id
          const isSelected = selected === model.id
          const meta = modelMeta(model)
          const brand = resolveModelBrand(model.id, name)
          const mark = marks[models.indexOf(model)] ?? ''

          return (
            <button
              aria-checked={isSelected}
              className={cn(
                'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-(--ui-stroke-secondary) px-4 py-2.5 text-left first:border-t-0',
                isSelected ? 'bg-(--ui-bg-tertiary)' : 'hover:bg-(--ui-control-hover-background)'
              )}
              disabled={saving !== null}
              key={model.id}
              onClick={() => void pick(model.id)}
              role="radio"
              type="button"
            >
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full border border-(--ui-stroke-secondary) bg-(--ui-bg-primary) text-foreground"
                data-brand={brand ?? undefined}
              >
                {brand ? <ModelBrandLogo brand={brand} /> : mark}
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 flex-wrap items-center gap-2 text-[length:var(--conversation-text-font-size)] font-medium text-foreground">
                  <span className="truncate">{name}</span>
                  {isSelected && (
                    <Pill tone="primary">
                      <Check className="size-3" />
                      {copy.modelInUse}
                    </Pill>
                  )}
                  {saving === model.id && <Loader2 className="size-3 animate-spin" />}
                </span>
                {meta && (
                  <span className="mt-0.5 block truncate text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
                    {meta}
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className={cn(
                  'grid size-4 place-items-center rounded-full border',
                  isSelected ? 'border-(--ui-accent) bg-(--ui-accent)' : 'border-(--ui-stroke-secondary)'
                )}
              >
                {isSelected && <span className="size-1.5 rounded-full bg-(--dt-primary-foreground)" />}
              </span>
            </button>
          )
        })}
      </div>
      {moreCount > 0 && (
        <Button
          aria-expanded={open}
          className="mt-2 px-1"
          onClick={() => setOpen(current => !current)}
          size="inline"
          type="button"
          variant="text"
        >
          {open ? t.settings.imageVideo.hideModels : t.settings.imageVideo.showModels(moreCount)}
          <ChevronDown className={cn('size-3.5 transition', open && 'rotate-180')} />
        </Button>
      )}
    </section>
  )
}
