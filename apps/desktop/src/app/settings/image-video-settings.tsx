import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useI18n } from '@/i18n'
import { SETTINGS_IMAGE_VIDEO_TOOLSETS } from '@/lib/desktop-toolsets'
import { asText } from '@/lib/text'
import { notifyError } from '@/store/notifications'
import { $settingsScopeOverride } from '@/store/settings-scope'
import type { ToolsetInfo } from '@/types/work4you'
import { getToolsets, type ProfileScope, setToolsetEnabled } from '@/work4you'

import { toolsetDisplayLabel } from './helpers'
import { EmptyState, SectionHeading, SettingsContent, SettingsGroup, SettingsSkeleton, ToggleRow } from './primitives'
import { SettingsProfileScope } from './profile-scope'
import { ToolsetConfigPanel } from './toolset-config-panel'

export function ImageVideoSettings() {
  // Shared "Applies to" scope (null → the app's active profile). Remount the
  // inner page per scope so the toolset query and pending toggle reset when
  // the target profile changes — same guarantee ConfigSettings uses.
  const scopeProfile = useStore($settingsScopeOverride)

  return <ImageVideoSettingsInner key={scopeProfile ?? '__active__'} scopeProfile={scopeProfile} />
}

function ImageVideoSettingsInner({ scopeProfile }: { scopeProfile: ProfileScope }) {
  const { t } = useI18n()
  const [pending, setPending] = useState<string | null>(null)

  const toolsetsQuery = useQuery({
    queryFn: () => getToolsets(scopeProfile),
    queryKey: ['settings-image-video-toolsets', scopeProfile]
  })

  const rows = SETTINGS_IMAGE_VIDEO_TOOLSETS.map(name =>
    (toolsetsQuery.data ?? []).find(ts => ts.name === name)
  ).filter((ts): ts is ToolsetInfo => Boolean(ts))

  async function handleToggle(toolset: ToolsetInfo, enabled: boolean) {
    setPending(toolset.name)

    try {
      await setToolsetEnabled(toolset.name, enabled, scopeProfile)
      await toolsetsQuery.refetch()
    } catch (err) {
      notifyError(err, t.skills.failedToUpdate(toolsetDisplayLabel(toolset)))
    } finally {
      setPending(null)
    }
  }

  if (toolsetsQuery.isLoading) {
    return (
      <SettingsSkeleton
        sections={[
          { heading: true, rows: 2 },
          { heading: true, rows: 2 }
        ]}
      />
    )
  }

  if (toolsetsQuery.isError) {
    return (
      <SettingsContent>
        <SectionHeading title={t.settings.sections.image_video ?? 'Image & Video'} variant="page" />
        <SettingsProfileScope className="mb-5" />
        <EmptyState title={t.settings.config.failedLoad} />
      </SettingsContent>
    )
  }

  return (
    <SettingsContent>
      <SectionHeading title={t.settings.sections.image_video ?? 'Image & Video'} variant="page" />
      <SettingsProfileScope className="mb-5" />
      {rows.length === 0 ? (
        <EmptyState description={t.settings.config.emptyDesc} title={t.settings.config.emptyTitle} />
      ) : (
        rows.map(toolset => {
          const label = toolsetDisplayLabel(toolset)
          const description = asText(toolset.description) || undefined

          return (
            <div key={toolset.name}>
              <SettingsGroup title={label}>
                <ToggleRow
                  checked={toolset.enabled}
                  description={description}
                  disabled={pending === toolset.name}
                  label={label}
                  onChange={enabled => void handleToggle(toolset, enabled)}
                />
              </SettingsGroup>
              <div className="mb-6">
                <ToolsetConfigPanel
                  key={`${toolset.name}:${scopeProfile ?? '__active__'}`}
                  onConfiguredChange={() => void toolsetsQuery.refetch()}
                  profile={scopeProfile}
                  toolset={toolset.name}
                />
              </div>
            </div>
          )
        })
      )}
    </SettingsContent>
  )
}
