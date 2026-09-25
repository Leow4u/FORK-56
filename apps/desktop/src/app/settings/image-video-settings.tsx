import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useI18n } from '@/i18n'
import { SETTINGS_IMAGE_VIDEO_TOOLSETS } from '@/lib/desktop-toolsets'
import { asText } from '@/lib/text'
import { notifyError } from '@/store/notifications'
import type { ToolsetInfo } from '@/types/work4you'
import { getToolsets, type ProfileScope, setToolsetEnabled } from '@/work4you'

import { toolsetDisplayLabel } from './helpers'
import { EmptyState, SectionHeading, SettingsContent, SettingsGroup, SettingsSkeleton, ToggleRow } from './primitives'
import { ToolsetConfigPanel } from './toolset-config-panel'

export function ImageVideoSettings() {
  // Edits the active profile. The profile chip lives on Capabilities.
  return <ImageVideoSettingsInner scopeProfile={null} />
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
        <EmptyState title={t.settings.config.failedLoad} />
      </SettingsContent>
    )
  }

  return (
    <SettingsContent>
      <SectionHeading title={t.settings.sections.image_video ?? 'Image & Video'} variant="page" />
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
