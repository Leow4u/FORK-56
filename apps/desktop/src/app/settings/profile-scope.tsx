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

/** Which profile a surface is editing. Settings config pages edit the active
 *  profile and do not show this chip. Messaging still uses it, because the
 *  choice changes which profile's platforms the agent serves. Capabilities
 *  has its own selector. Hidden with fewer than two profiles.
 *
 *  `align="center"` matches the Customize / Channels library header — label,
 *  chips, and helper sit in a centered column. Detail panes keep the default
 *  start alignment. */
export function SettingsProfileScope({
  align = 'start',
  className
}: {
  align?: 'center' | 'start'
  className?: string
}) {
  const { t } = useI18n()
  const scope = t.settings.profileScope
  const override = useStore($settingsScopeOverride)
  const active = useStore($activeGatewayProfile)
  const profiles = useStore($profiles)
  const centered = align === 'center'

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
    <div
      className={cn(
        centered ? 'flex w-full flex-col items-center gap-2 text-center' : 'grid gap-2',
        className
      )}
    >
      <div className="text-[length:var(--conversation-caption-font-size)] font-medium text-(--ui-text-secondary)">
        {scope.appliesTo}
      </div>
      <div
        aria-label={scope.appliesTo}
        className={cn('flex flex-wrap gap-1.5', centered && 'justify-center')}
        role="radiogroup"
      >
        {profiles.map(profile => (
          <ScopeChip
            active={normalizeProfileKey(profile.name) === selected}
            key={profile.name}
            label={profile.name}
            onSelect={() => setSettingsScope(profile.name)}
          />
        ))}
      </div>
      <p
        className={cn(
          'text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)',
          centered && 'max-w-xl'
        )}
      >
        {scope.editsProfile(selected)}
      </p>
    </div>
  )
}
