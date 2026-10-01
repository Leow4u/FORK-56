import { useQuery } from '@tanstack/react-query'

import { useI18n } from '@/i18n'
import { SETTINGS_IMAGE_VIDEO_TOOLSETS } from '@/lib/desktop-toolsets'
import type { ToolsetInfo } from '@/types/work4you'
import { getToolsets, type ProfileScope, setToolsetEnabled } from '@/work4you'

import { toolsetDisplayLabel } from './helpers'
import { ImageVideoCatalog } from './image-video-catalog'
import { EmptyState, SectionHeading, SettingsContent, SettingsSkeleton } from './primitives'

export function ImageVideoSettings() {
  // Edits the active profile. The profile chip lives on Capabilities.
  return <ImageVideoSettingsInner scopeProfile={null} />
}

function ImageVideoSettingsInner({ scopeProfile }: { scopeProfile: ProfileScope }) {
  const { t } = useI18n()

  const toolsetsQuery = useQuery({
    // Image and video stay on. This page has no off switch, so a toolset that
    // was disabled is turned back on through the existing toolset API.
    queryFn: async () => {
      const list = await getToolsets(scopeProfile)
      const disabled = SETTINGS_IMAGE_VIDEO_TOOLSETS.filter(name => list.some(ts => ts.name === name && !ts.enabled))

      if (disabled.length === 0) {
        return list
      }

      await Promise.all(disabled.map(name => setToolsetEnabled(name, true, scopeProfile)))

      return getToolsets(scopeProfile)
    },
    queryKey: ['settings-image-video-toolsets', scopeProfile]
  })

  const rows = SETTINGS_IMAGE_VIDEO_TOOLSETS.map(name =>
    (toolsetsQuery.data ?? []).find(ts => ts.name === name)
  ).filter((ts): ts is ToolsetInfo => Boolean(ts))

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
      <SectionHeading
        description={t.settings.imageVideo.intro}
        title={t.settings.sections.image_video ?? 'Image & Video'}
        variant="page"
      />
      {rows.length === 0 ? (
        <EmptyState description={t.settings.config.emptyDesc} title={t.settings.config.emptyTitle} />
      ) : (
        rows.map(toolset => (
          <ImageVideoCatalog
            key={toolset.name}
            label={toolsetDisplayLabel(toolset)}
            profile={scopeProfile}
            toolset={toolset.name}
          />
        ))
      )}
    </SettingsContent>
  )
}
