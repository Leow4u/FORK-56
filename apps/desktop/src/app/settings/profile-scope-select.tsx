import { ProfileFace } from '@/components/ui/profile-face'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface ProfileScopeOption {
  key: string
  label: string
  /** Profile name the face is drawn from; null → a text-only row. */
  profile: null | string
  value: string
}

/**
 * "Configuring: [face name ▾]" — the one-line profile picker for pages that
 * edit ONE profile's configuration. A dropdown rather than a chip row so it
 * reads the same with two profiles or ten, and so roster rows on
 * multi-connection desktops ("profile — device") fit without folding.
 *
 * Presentation only: `value` / `onChange` carry the canonical option value
 * (profile name, or `connectionId::profile`); the label is whatever the
 * caller resolved (bot title → display name → product name for the default
 * profile — see `settingsScopeLabel`).
 */
export function ProfileScopeSelect({
  className,
  label,
  onChange,
  options,
  value
}: {
  className?: string
  label: string
  onChange: (value: string) => void
  options: readonly ProfileScopeOption[]
  value: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)} data-slot="profile-scope-select">
      <span className="shrink-0 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
        {label}
      </span>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger aria-label={label} className="h-7 max-w-72 min-w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.key} value={option.value}>
              <span className="flex min-w-0 items-center gap-2">
                {option.profile != null && <ProfileFace name={option.profile} size={16} />}
                <span className="truncate">{option.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
