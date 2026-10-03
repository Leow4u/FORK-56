import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $profiles, DEFAULT_PROFILE_LABEL, normalizeProfileKey, profileLabel, refreshProfiles } from '@/store/profile'
import {
  $settingsScopeEditsNonDefault,
  $settingsScopeOverride,
  $settingsScopeProfile,
  setSettingsScope
} from '@/store/settings-scope'
import type { ProfileInfo } from '@/types/work4you'

import { ProfileScopeSelect } from './profile-scope-select'

// Settings-selector label: the WorkBots title when the backend reports one,
// else the app-wide profileLabel (display_name → slug), except that the
// DEFAULT profile without a display name of its own reads as the product name
// — a user never sees "default", a "Default" that merely spells the slug, or a
// "(default)" suffix as the thing they are editing.
// Scoped to the settings selectors on purpose — the profile rail and Profiles
// page keep naming profiles by display_name.
export function settingsScopeLabel(
  profile: Pick<ProfileInfo, 'bot_title' | 'display_name' | 'name'> & Partial<Pick<ProfileInfo, 'is_default'>>
): string {
  const title = (profile.bot_title ?? '').trim()

  if (title) {
    return title
  }

  const label = profileLabel(profile)
  const spellsSlug = label.toLowerCase() === profile.name.trim().toLowerCase()

  return profile.is_default && spellsSlug ? DEFAULT_PROFILE_LABEL : label
}

/** Shared "Configuring:" selector for the config-backed Settings pages
 *  (Model, Chat, Safety, Memory & Context, Voice, Image & Video) and the
 *  Channels page. Backed by one nanostore ($settingsScopeOverride) so the
 *  selection persists across pages; the pages send the matching concrete key
 *  ($settingsRequestProfile) on every request. Capabilities has its own
 *  selector (same dropdown, roster-aware options). Hidden with fewer than two
 *  profiles, so single-profile users never see it.
 *
 *  The note names the edit target only when it is NOT the default profile —
 *  the "edited the bot's config thinking it was mine" misdirect — whether it
 *  got there by an explicit pick or by following the active profile. */
export function SettingsProfileScope({ className }: { className?: string }) {
  const { t } = useI18n()
  const scope = t.settings.profileScope
  const override = useStore($settingsScopeOverride)
  const selected = useStore($settingsScopeProfile)
  const editingNonDefault = useStore($settingsScopeEditsNonDefault)
  const profiles = useStore($profiles)
  // The note names the edit target with the same presentation label as its
  // option (bot title → display_name → product name → slug); the slug alone
  // can name a bot the user has never seen called that.
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

  const options = profiles.map(profile => ({
    key: profile.name,
    label: settingsScopeLabel(profile),
    profile: profile.name,
    value: normalizeProfileKey(profile.name)
  }))

  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <ProfileScopeSelect
        label={t.skills.configuringProfile}
        onChange={value =>
          setSettingsScope(profiles.find(profile => normalizeProfileKey(profile.name) === value)?.name ?? value)
        }
        options={options}
        value={selected}
      />
      {editingNonDefault ? (
        <p
          className="text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) font-medium text-(--ui-accent)"
          data-scope-loud="true"
          data-scope-override={override !== null ? 'true' : undefined}
          role="status"
        >
          {scope.editsProfile(selectedName)}
        </p>
      ) : null}
    </div>
  )
}
