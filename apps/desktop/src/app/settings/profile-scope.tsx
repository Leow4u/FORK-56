import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $activeGatewayProfile, $profiles, normalizeProfileKey, refreshProfiles } from '@/store/profile'
import { $settingsScopeOverride, setSettingsScope } from '@/store/settings-scope'

// The same chip affordance the Gateway page used for per-profile connection
// overrides. That one stayed local to gateway-settings (and its `null` chip
// meant "all profiles"). Here every chip is a concrete profile whose config
// this page is *editing* — not a multi-bind of channels onto several homes.
export function ScopeChip({ active, label, onSelect }: { active: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      aria-checked={active}
      className={cn(
        'rounded-full border px-3 py-1 text-[length:var(--conversation-caption-font-size)] transition',
        active
          ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary) text-(--ui-text-primary)'
          : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)'
      )}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      {label}
    </button>
  )
}

/** Shared "which profile am I editing" selector for the config-backed settings
 *  pages (Model, Workspace, Safety, Memory & Context, Voice, Tools & Keys)
 *  and the Messaging overlay. Backed by one nanostore ($settingsScopeOverride)
 *  so the selection persists across pages. Hidden with fewer than two
 *  profiles, so single-profile users never see it and every request keeps its
 *  unscoped default shape. */
export function SettingsProfileScope({ className }: { className?: string }) {
  const { t } = useI18n()
  const scope = t.settings.profileScope
  const override = useStore($settingsScopeOverride)
  const active = useStore($activeGatewayProfile)
  const profiles = useStore($profiles)

  // Refresh lazily so a profile created elsewhere shows up; the cached list
  // paints immediately. Best-effort — a failure keeps the cached roster.
  useEffect(() => {
    void refreshProfiles().catch(() => undefined)
  }, [])

  if (profiles.length < 2) {
    return null
  }

  const selected = normalizeProfileKey(override ?? active)

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="text-[length:var(--conversation-caption-font-size)] font-medium text-(--ui-text-secondary)">
        {scope.appliesTo}
      </div>
      <div aria-label={scope.appliesTo} className="flex flex-wrap gap-1.5" role="radiogroup">
        {profiles.map(profile => (
          <ScopeChip
            active={normalizeProfileKey(profile.name) === selected}
            key={profile.name}
            label={profile.name}
            onSelect={() => setSettingsScope(profile.name)}
          />
        ))}
      </div>
      <p className="text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
        {scope.editsProfile(selected)}
      </p>
    </div>
  )
}
