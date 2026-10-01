import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $profiles, normalizeProfileKey, profileLabel, refreshProfiles } from '@/store/profile'
import {
  $settingsScopeEditsNonDefault,
  $settingsScopeOverride,
  $settingsScopeProfile,
  setSettingsScope
} from '@/store/settings-scope'
import type { ProfileInfo } from '@/types/work4you'

// Settings-chip label: the WorkBots title when the backend reports one, else
// the app-wide profileLabel (display_name → slug). Scoped to this selector on
// purpose — the profile rail and Profiles page keep naming profiles by
// display_name.
export function settingsScopeLabel(profile: Pick<ProfileInfo, 'bot_title' | 'display_name' | 'name'>): string {
  return (profile.bot_title ?? '').trim() || profileLabel(profile)
}

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

/** Shared "Editing profile" selector for the config-backed Settings pages
 *  (Model, Chat, Safety, Memory & Context, Voice, Image & Video) and the
 *  Channels page. Backed by one nanostore ($settingsScopeOverride) so the
 *  selection persists across pages; the pages send the matching concrete key
 *  ($settingsRequestProfile) on every request. Capabilities has its own
 *  selector. Hidden with fewer than two profiles, so single-profile users
 *  never see it.
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
  const selected = useStore($settingsScopeProfile)
  const editingNonDefault = useStore($settingsScopeEditsNonDefault)
  const profiles = useStore($profiles)
  const centered = align === 'center'
  // The note names the edit target with the same presentation label as its
  // chip (bot title → display_name → slug); the slug alone can name a bot the
  // user has never seen called that.
  const selectedProfile = profiles.find(profile => normalizeProfileKey(profile.name) === selected)
  const selectedName = selectedProfile ? settingsScopeLabel(selectedProfile) : selected

  // Refresh lazily so a profile created elsewhere shows up; the cached list
  // paints immediately. Best-effort — a failure keeps the cached roster.
  useEffect(() => {
    void refreshProfiles().catch(() => undefined)
  }, [])

  if (profiles.length < 2) {
    return null
  }

  return (
    <div className={cn(centered ? 'flex w-full flex-col items-center gap-2 text-center' : 'grid gap-2', className)}>
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
            label={settingsScopeLabel(profile)}
            onSelect={() => setSettingsScope(profile.name)}
          />
        ))}
      </div>
      {/* Always names the edit target. Loud (accented) when that target is not
          the default profile — the "edited the bot's config thinking it was
          mine" misdirect — whether it got there by an explicit chip pick or by
          following the active profile; quiet otherwise. */}
      <p
        className={cn(
          'text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height)',
          editingNonDefault ? 'font-medium text-(--ui-accent)' : 'text-(--ui-text-tertiary)',
          centered && 'max-w-xl'
        )}
        data-scope-loud={editingNonDefault ? 'true' : undefined}
        data-scope-override={override !== null ? 'true' : undefined}
        role="status"
      >
        {scope.editsProfile(selectedName)}
      </p>
    </div>
  )
}
