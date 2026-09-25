import { useStore } from '@nanostores/react'

import { useI18n } from '@/i18n'
import { $keepAwake, setKeepAwake } from '@/store/keep-awake'

import { SectionHeading, SettingsContent, SettingsGroup, ToggleRow } from './primitives'
import { QuickEntrySettings } from './quick-entry-settings'

/** Device preferences: this computer, not a profile's config.yaml. */
export function AppSettings() {
  const { t } = useI18n()
  const c = t.settings.config
  const keepAwake = useStore($keepAwake)

  return (
    <SettingsContent>
      <SectionHeading title={t.settings.nav.app} variant="page" />
      <SettingsGroup>
        <ToggleRow checked={keepAwake} description={c.keepAwakeDesc} label={c.keepAwakeTitle} onChange={setKeepAwake} />
        <QuickEntrySettings />
      </SettingsGroup>
    </SettingsContent>
  )
}
