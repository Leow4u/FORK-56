import type { ComponentType, SVGProps } from 'react'

import { cn } from '@/lib/utils'

import type { EmailProviderPreset } from './email-presets'
import {
  EMAIL_PROVIDER_ICON_COLORS,
  EMAIL_PROVIDER_ICON_COMPONENTS
} from './email-provider-icons'

const CUSTOM = 'custom'

export type EmailProviderChoice = EmailProviderPreset['id'] | typeof CUSTOM

export function EmailProviderPicker({
  customLabel,
  label,
  onChange,
  presets,
  value
}: {
  customLabel: string
  label: string
  onChange: (id: EmailProviderChoice) => void
  presets: EmailProviderPreset[]
  value: EmailProviderChoice
}) {
  const entries: { Icon: ComponentType<SVGProps<SVGSVGElement>>; color: string; id: EmailProviderChoice; name: string }[] =
    [
      ...presets.map(preset => ({
        Icon: EMAIL_PROVIDER_ICON_COMPONENTS[preset.id],
        color: EMAIL_PROVIDER_ICON_COLORS[preset.id],
        id: preset.id as EmailProviderChoice,
        name: preset.label
      })),
      {
        Icon: EMAIL_PROVIDER_ICON_COMPONENTS.custom,
        color: EMAIL_PROVIDER_ICON_COLORS.custom,
        id: CUSTOM,
        name: customLabel
      }
    ]

  return (
    <div aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
      {entries.map(entry => {
        const selected = entry.id === value
        const Icon = entry.Icon

        return (
          <button
            aria-checked={selected}
            aria-label={entry.name}
            className={cn(
              'relative flex min-h-[5.25rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors',
              selected
                ? 'border-(--ui-text-tertiary) bg-(--ui-bg-quinary) shadow-sm'
                : 'border-(--ui-stroke-quaternary) hover:bg-(--ui-sidebar-surface-background)'
            )}
            key={entry.id}
            onClick={() => onChange(entry.id)}
            role="radio"
            type="button"
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute right-2 top-2 grid size-4 place-items-center rounded-full border-2',
                selected ? 'border-primary bg-primary' : 'border-(--ui-stroke-tertiary) bg-background'
              )}
            >
              {selected ? <span className="size-1.5 rounded-full bg-background" /> : null}
            </span>
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-lg border border-(--ui-stroke-quaternary) bg-white"
              style={{ color: entry.color }}
            >
              <Icon className="size-5" />
            </span>
            <span className="line-clamp-2 text-[0.6875rem] font-medium leading-4 text-foreground">{entry.name}</span>
          </button>
        )
      })}
    </div>
  )
}
