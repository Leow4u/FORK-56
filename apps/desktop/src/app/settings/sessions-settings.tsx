import { useCallback, useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { notifyError } from '@/store/notifications'
import type { Work4YouConfigRecord } from '@/types/work4you'
import { getWork4YouConfigRecord, saveWork4YouConfig } from '@/work4you'

import { ListRow, ToggleRow } from './primitives'

const DEFAULT_AUTO_ARCHIVE_DAYS = 3

// Opt-in retention: soft-hide chats untouched for N days. The policy itself
// (last-activity sweep, pin exemption) lives in the backend
// (sessions.auto_archive in config.yaml + SessionDB.maybe_auto_archive); this
// just toggles the config keys, so CLI / gateway / Desktop all honour one
// setting. Pins are exempt on the backend, so pinned chats survive regardless.
// Archive and unarchive of a single chat live on the chat list.
export function AutoArchiveSetting() {
  const { t } = useI18n()
  const s = t.settings.sessions
  const [config, setConfig] = useState<Work4YouConfigRecord | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [days, setDays] = useState(DEFAULT_AUTO_ARCHIVE_DAYS)

  useEffect(() => {
    // Config REST is only reachable through the Electron bridge; skip in
    // non-Electron contexts (tests/storybook) rather than throwing.
    if (!window.work4youDesktop) {
      return
    }

    let alive = true

    void getWork4YouConfigRecord()
      .then(record => {
        if (!alive) {
          return
        }

        const sessions = (record.sessions ?? {}) as Record<string, unknown>
        const parsedDays = Number(sessions.auto_archive_days)
        setConfig(record)
        setEnabled(Boolean(sessions.auto_archive))
        setDays(Number.isFinite(parsedDays) && parsedDays > 0 ? Math.round(parsedDays) : DEFAULT_AUTO_ARCHIVE_DAYS)
      })
      .catch(() => {
        // Leave the control unmounted if config can't be read.
      })

    return () => {
      alive = false
    }
  }, [])

  const persist = useCallback(
    async (autoArchive: boolean, archiveDays: number) => {
      if (!config) {
        return
      }

      const sessions = {
        ...((config.sessions ?? {}) as Record<string, unknown>),
        auto_archive: autoArchive,
        auto_archive_days: archiveDays
      }

      const updated = { ...config, sessions }
      setConfig(updated)

      try {
        await saveWork4YouConfig(updated)
      } catch (err) {
        notifyError(err, s.autoArchiveFailed)
      }
    },
    [config, s.autoArchiveFailed]
  )

  if (!config) {
    return null
  }

  return (
    <>
      <ToggleRow
        checked={enabled}
        description={s.autoArchiveDesc}
        label={s.autoArchiveTitle}
        onChange={on => {
          setEnabled(on)
          void persist(on, days)
        }}
      />
      {enabled && (
        <ListRow
          action={
            <div className="flex items-center gap-2">
              <Input
                aria-label={s.autoArchiveDaysLabel}
                className="w-20"
                min={1}
                onBlur={() => void persist(true, days)}
                onChange={e => setDays(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                type="number"
                value={days}
              />
              <span className="text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
                {s.autoArchiveDaysUnit}
              </span>
            </div>
          }
          title={s.autoArchiveDaysLabel}
        />
      )}
    </>
  )
}
