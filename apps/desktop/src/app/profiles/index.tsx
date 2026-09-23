import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CodeEditor } from '@/components/chat/code-editor'
import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { ProfileGlyph } from '@/components/ui/profile-glyph'
import { useI18n } from '@/i18n'
import { AlertTriangle, Save } from '@/lib/icons'
import { displayModelName } from '@/lib/model-status-label'
import { resolveProfileColor } from '@/lib/profile-color'
import { normalize } from '@/lib/text'
import { notify, notifyError } from '@/store/notifications'
import {
  $activeGatewayProfile,
  $profileColors,
  normalizeProfileKey,
  profileLabel,
  refreshProfiles,
  selectProfile
} from '@/store/profile'
import { getProfileSoul, type ProfileInfo, updateProfileSoul } from '@/work4you'

import { useRefreshHotkey } from '../hooks/use-refresh-hotkey'
import {
  Panel,
  PanelBody,
  PanelDetail,
  PanelEmpty,
  PanelHeader,
  PanelList,
  PanelListRow,
  type PanelMenuItem,
  PanelPill
} from '../overlays/panel'

import { CreateProfileDialog } from './create-profile-dialog'
import { DeleteProfileDialog } from './delete-profile-dialog'
import { personaLead } from './persona'
import { RenameProfileDialog } from './rename-profile-dialog'

// A short roster is scanned by eye. Search appears once the list is long enough
// that finding a name by scrolling stops being the faster path.
const PROFILE_SEARCH_MIN = 7

interface ProfilesViewProps {
  onClose: () => void
}

export function ProfilesView({ onClose }: ProfilesViewProps) {
  const { t } = useI18n()
  const p = t.profiles
  const activeKey = normalizeProfileKey(useStore($activeGatewayProfile))
  const [profiles, setProfiles] = useState<null | ProfileInfo[]>(null)
  const [souls, setSouls] = useState<Record<string, string>>({})
  const [soulsReady, setSoulsReady] = useState<Record<string, boolean>>({})
  const [soulErrors, setSoulErrors] = useState<Record<string, string>>({})
  const [selectedName, setSelectedName] = useState<null | string>(null)
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingRename, setPendingRename] = useState<null | ProfileInfo>(null)
  const [pendingDelete, setPendingDelete] = useState<null | ProfileInfo>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await refreshProfiles()
      setProfiles(list)
      setSelectedName(current => {
        if (current && list.some(p => p.name === current)) {
          return current
        }

        return list.find(p => p.is_default)?.name ?? list[0]?.name ?? null
      })
    } catch (err) {
      notifyError(err, p.failedLoad)
    }
  }, [p])

  useRefreshHotkey(refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const profileKey = profiles?.map(profile => profile.name).join('\0') ?? ''

  useEffect(() => {
    if (!profiles) {
      return
    }

    let cancelled = false

    for (const profile of profiles) {
      void getProfileSoul(profile.name)
        .then(soul => {
          if (cancelled) {
            return
          }

          setSouls(current => ({ ...current, [profile.name]: soul.content }))
          setSoulsReady(current => ({ ...current, [profile.name]: true }))
        })
        .catch((err: unknown) => {
          if (cancelled) {
            return
          }

          const message = err instanceof Error ? err.message : p.failedLoadSoul
          setSoulErrors(current => ({ ...current, [profile.name]: message }))
          setSoulsReady(current => ({ ...current, [profile.name]: true }))
        })
    }

    return () => {
      cancelled = true
    }
    // Reload when the roster changes, not when a draft edits one entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey])

  const selected = useMemo(() => {
    if (!profiles) {
      return null
    }

    return profiles.find(p => p.name === selectedName) ?? profiles[0] ?? null
  }, [profiles, selectedName])

  const visibleProfiles = useMemo(() => {
    const q = normalize(query)

    if (!profiles || !q) {
      return profiles ?? []
    }

    return profiles.filter(profile => {
      const label = profileLabel(profile).toLowerCase()
      const model = profile.model ? displayModelName(profile.model).toLowerCase() : ''

      return label.includes(q) || profile.name.toLowerCase().includes(q) || model.includes(q)
    })
  }, [profiles, query])

  // The shared Create/Rename dialogs own the createProfile / renameProfile /
  // updateProfileSoul calls; the panel just selects the resulting profile and
  // re-pulls the list.
  const selectAndRefresh = useCallback(
    async (name: string) => {
      setSelectedName(name)
      await refresh()
    },
    [refresh]
  )

  return (
    <Panel closeLabel={p.close} onClose={onClose}>
      {!profiles ? (
        <PageLoader label={p.loading} />
      ) : profiles.length === 0 ? (
        <PanelEmpty
          action={
            <Button onClick={() => setCreateOpen(true)} size="sm">
              {p.newProfile}
            </Button>
          }
          description={p.createDesc}
          icon="organization"
          title={p.noProfiles}
        />
      ) : (
        <>
          <PanelHeader
            actions={
              <Button onClick={() => setCreateOpen(true)} size="sm" type="button" variant="ghost">
                {p.newProfile}
              </Button>
            }
            title={p.title}
          />
          <PanelBody>
            <PanelList
              {...(profiles.length >= PROFILE_SEARCH_MIN
                ? {
                    onSearchChange: setQuery,
                    searchLabel: p.search,
                    searchPlaceholder: p.search,
                    searchValue: query
                  }
                : {})}
            >
              {visibleProfiles.map(profile => (
                <ProfileRow
                  active={selected?.name === profile.name}
                  detail={personaLead(souls[profile.name] ?? '')}
                  inUse={normalizeProfileKey(profile.name) === activeKey}
                  key={profile.name}
                  menuItems={
                    profile.is_default
                      ? // Renaming the default profile sets a presentation-only
                        // display name (the canonical id stays "default").
                        [{ icon: 'edit', label: p.renameMenu, onSelect: () => setPendingRename(profile) }]
                      : [
                          { icon: 'edit', label: p.renameMenu, onSelect: () => setPendingRename(profile) },
                          {
                            icon: 'trash',
                            label: t.common.delete,
                            onSelect: () => setPendingDelete(profile),
                            tone: 'danger'
                          }
                        ]
                  }
                  onSelect={() => setSelectedName(profile.name)}
                  profile={profile}
                />
              ))}
            </PanelList>

            {selected ? (
              <ProfileDetail
                inUse={normalizeProfileKey(selected.name) === activeKey}
                key={selected.name}
                onPersona={value => setSouls(current => ({ ...current, [selected.name]: value }))}
                persona={souls[selected.name] ?? ''}
                personaError={soulErrors[selected.name] ?? null}
                personaReady={soulsReady[selected.name] === true}
                profile={selected}
              />
            ) : (
              <PanelEmpty description={p.selectPrompt} icon="account" />
            )}
          </PanelBody>
        </>
      )}

      <RenameProfileDialog
        currentName={pendingRename?.name ?? ''}
        isDefault={pendingRename?.is_default ?? false}
        onClose={() => setPendingRename(null)}
        onRenamed={selectAndRefresh}
        open={pendingRename !== null}
      />

      <CreateProfileDialog
        onClose={() => setCreateOpen(false)}
        onCreated={selectAndRefresh}
        open={createOpen}
        profiles={profiles ?? []}
      />

      <DeleteProfileDialog
        onClose={() => setPendingDelete(null)}
        onDeleted={async () => {
          setSelectedName(null)
          await refresh()
        }}
        open={pendingDelete !== null}
        profile={pendingDelete}
      />
    </Panel>
  )
}

function ProfileRow({
  active,
  detail,
  inUse,
  menuItems,
  onSelect,
  profile
}: {
  active: boolean
  detail: string
  inUse: boolean
  menuItems: PanelMenuItem[]
  onSelect: () => void
  profile: ProfileInfo
}) {
  const { t } = useI18n()
  const colors = useStore($profileColors)

  return (
    <PanelListRow
      active={active}
      detail={detail || undefined}
      lead={
        <ProfileGlyph
          aria-hidden="true"
          color={resolveProfileColor(profile.name, colors)}
          isDefault={profile.is_default}
          name={profile.name}
          size="md"
        />
      }
      menuItems={menuItems}
      menuLabel={profileLabel(profile)}
      meta={inUse ? t.profiles.inUse : undefined}
      onSelect={onSelect}
      rowKey={profile.name}
      title={profileLabel(profile)}
    />
  )
}

function ProfileDetail({
  inUse,
  onPersona,
  persona,
  personaError,
  personaReady,
  profile
}: {
  inUse: boolean
  onPersona: (value: string) => void
  persona: string
  personaError: null | string
  personaReady: boolean
  profile: ProfileInfo
}) {
  const { t } = useI18n()
  const p = t.profiles
  const colors = useStore($profileColors)
  const lead = personaLead(persona)
  const modelName = profile.model ? displayModelName(profile.model) : ''

  return (
    <PanelDetail>
      <header className="flex items-start gap-3">
        <ProfileGlyph
          aria-hidden="true"
          className="mt-0.5"
          color={resolveProfileColor(profile.name, colors)}
          isDefault={profile.is_default}
          name={profile.name}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{profileLabel(profile)}</h3>
            {profile.is_default && <PanelPill tone="good">{p.defaultBadge}</PanelPill>}
            {!inUse && (
              <Button onClick={() => selectProfile(profile.name)} size="sm" type="button" variant="secondary">
                {p.useProfile}
              </Button>
            )}
          </div>
          {lead ? <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{lead}</p> : null}
          {modelName ? <p className="mt-2 text-xs text-muted-foreground/80">{modelName}</p> : null}
        </div>
      </header>

      {personaError ? (
        <div className="flex items-start gap-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{personaError}</span>
        </div>
      ) : personaReady ? (
        <SoulEditor initial={persona} onPersona={onPersona} profileName={profile.name} />
      ) : (
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h4 className="text-sm font-medium text-foreground">{p.personaTitle}</h4>
            <span className="text-[0.65rem] text-muted-foreground/70">{p.personaFile}</span>
          </div>
          <PageLoader className="min-h-44" label={p.loadingSoul} />
        </section>
      )}
    </PanelDetail>
  )
}

function SoulEditor({
  initial,
  onPersona,
  profileName
}: {
  initial: string
  onPersona: (value: string) => void
  profileName: string
}) {
  const { t } = useI18n()
  const p = t.profiles
  const [content, setContent] = useState(initial)
  const [original, setOriginal] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const dirty = content !== original

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      await updateProfileSoul(profileName, content)
      setOriginal(content)
      notify({ kind: 'success', title: p.soulSaved, message: profileName })
    } catch (err) {
      setError(err instanceof Error ? err.message : p.failedSaveSoul)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h4 className="text-sm font-medium text-foreground">{p.personaTitle}</h4>
        <span className="text-[0.65rem] text-muted-foreground/70">{p.personaFile}</span>
      </div>

      <CodeEditor
        filePath="SOUL.md"
        focusOnMount={false}
        initialValue={content}
        key={profileName}
        onChange={value => {
          setContent(value)
          onPersona(value)
        }}
        onSave={() => void handleSave()}
        placeholder={p.personaPlaceholder}
        prose
      />

      {error && (
        <div className="flex items-start gap-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {dirty && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{p.unsavedChanges}</span>
          <Button disabled={saving} onClick={() => void handleSave()} size="sm" type="button">
            <Save />
            {saving ? p.saving : t.common.save}
          </Button>
        </div>
      )}
    </section>
  )
}
