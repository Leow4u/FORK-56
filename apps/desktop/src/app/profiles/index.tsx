import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CodeEditor } from '@/components/chat/code-editor'
import { ModelPickerDialog } from '@/components/model-picker'
import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { moodForBackendState, ProfileFace } from '@/components/ui/profile-face'
import { ProfileStateDot } from '@/components/ui/profile-state-dot'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n'
import { AlertTriangle, Save } from '@/lib/icons'
import { displayModelName } from '@/lib/model-status-label'
import { normalize } from '@/lib/text'
import { notify, notifyError } from '@/store/notifications'
import {
  $activeGatewayProfile,
  $profileBackendStates,
  normalizeProfileKey,
  type ProfileBackendState,
  profileLabel,
  refreshProfiles,
  selectProfile
} from '@/store/profile'
import { runExportProfileFlow } from '@/store/profile-share'
import {
  describeProfileAuto,
  getProfileSoul,
  type ProfileInfo,
  updateProfileDescription,
  updateProfileModel,
  updateProfileSoul
} from '@/work4you'

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

type DetailTab = 'description' | 'export' | 'model' | 'persona'

interface ProfilesViewProps {
  initialProfile?: null | string
  onClose: () => void
}

export function ProfilesView({ initialProfile = null, onClose }: ProfilesViewProps) {
  const { t } = useI18n()
  const p = t.profiles
  const activeKey = normalizeProfileKey(useStore($activeGatewayProfile))
  const backendStates = useStore($profileBackendStates)
  const [profiles, setProfiles] = useState<null | ProfileInfo[]>(null)
  const [souls, setSouls] = useState<Record<string, string>>({})
  const [soulsReady, setSoulsReady] = useState<Record<string, boolean>>({})
  const [soulErrors, setSoulErrors] = useState<Record<string, string>>({})
  const [selectedName, setSelectedName] = useState<null | string>(initialProfile)
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
      notifyError(err, p.failedLoad, 'settings')
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

  const stateOf = (profile: ProfileInfo): ProfileBackendState =>
    backendStates[normalizeProfileKey(profile.name)] ?? 'asleep'

  const runningCount = profiles?.filter(profile => stateOf(profile) === 'running').length ?? 0

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
              <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
                {p.newProfile}
              </Button>
            }
            subtitle={`${p.count(profiles.length)} · ${p.runningSummary(runningCount, profiles.length)}`}
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
                  state={stateOf(profile)}
                />
              ))}
              <StateLegend />
            </PanelList>

            {selected ? (
              <ProfileDetail
                inUse={normalizeProfileKey(selected.name) === activeKey}
                key={selected.name}
                onChanged={refresh}
                onPersona={value => setSouls(current => ({ ...current, [selected.name]: value }))}
                persona={souls[selected.name] ?? ''}
                personaError={soulErrors[selected.name] ?? null}
                personaReady={soulsReady[selected.name] === true}
                profile={selected}
                state={stateOf(selected)}
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

function StateLegend() {
  const { t } = useI18n()
  const p = t.profiles
  const rows: ProfileBackendState[] = ['running', 'waking', 'asleep']

  return (
    <div className="mt-auto rounded-md bg-foreground/5 px-2.5 py-2 text-[0.65rem] leading-relaxed text-muted-foreground">
      <div className="font-medium text-foreground/80">{p.legend}</div>
      {rows.map(state => (
        <div className="flex items-center gap-2" key={state}>
          <span className="relative inline-block size-2.5 shrink-0">
            <ProfileStateDot className="inset-0 size-2.5 ring-0" state={state} />
          </span>
          <span>
            {p.state[state]} · {p.stateHint[state]}
          </span>
        </div>
      ))}
    </div>
  )
}

function ProfileRow({
  active,
  detail,
  inUse,
  menuItems,
  onSelect,
  profile,
  state
}: {
  active: boolean
  detail: string
  inUse: boolean
  menuItems: PanelMenuItem[]
  onSelect: () => void
  profile: ProfileInfo
  state: ProfileBackendState
}) {
  const { t } = useI18n()

  return (
    <PanelListRow
      active={active}
      detail={detail || undefined}
      lead={
        <span className="relative inline-flex">
          <ProfileFace mood={moodForBackendState(state)} name={profile.name} size={20} />
          <ProfileStateDot className="ring-1" state={state} />
        </span>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-(--ui-border) bg-foreground/[0.03] px-3 py-2">
      <span className="text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="truncate text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}

function ProfileDetail({
  inUse,
  onChanged,
  onPersona,
  persona,
  personaError,
  personaReady,
  profile,
  state
}: {
  inUse: boolean
  onChanged: () => Promise<void>
  onPersona: (value: string) => void
  persona: string
  personaError: null | string
  personaReady: boolean
  profile: ProfileInfo
  state: ProfileBackendState
}) {
  const { t } = useI18n()
  const p = t.profiles
  const modelName = profile.model ? displayModelName(profile.model) : ''
  const [tab, setTab] = useState<DetailTab>('persona')
  const label = profileLabel(profile)

  return (
    <PanelDetail
      className="flex flex-col overflow-hidden"
      contentClassName="flex min-h-0 flex-1 flex-col gap-4 space-y-0 overflow-hidden pb-4"
    >
      <header className="flex shrink-0 items-start gap-3">
        <span className="relative mt-0.5 inline-flex">
          <ProfileFace mood={moodForBackendState(state)} name={profile.name} size={36} />
          <ProfileStateDot className="size-2.5" label={p.state[state]} state={state} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{label}</h3>
            {label !== profile.name && (
              <span className="font-mono text-[0.65rem] text-muted-foreground/70">{profile.name}</span>
            )}
            {profile.is_default && <PanelPill tone="good">{p.defaultBadge}</PanelPill>}
            <div className="ms-auto flex shrink-0 items-center">
              {inUse ? (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{p.currentlyInUse}</span>
              ) : (
                <Button onClick={() => selectProfile(profile.name)} size="sm" type="button" variant="secondary">
                  {p.useProfile}
                </Button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground/75">
            <span>{p.state[state]}</span>
            {modelName ? (
              <>
                <span aria-hidden="true" className="mx-1.5 text-muted-foreground/40">
                  ·
                </span>
                <span>
                  {p.modelLabel}: {modelName}
                </span>
              </>
            ) : null}
            <span aria-hidden="true" className="mx-1.5 text-muted-foreground/40">
              ·
            </span>
            <span>
              {p.fileLabel}: {p.personaFile}
            </span>
          </p>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-3 gap-2">
        <InfoCard label={p.cards.model} value={modelName || p.notSet} />
        <InfoCard label={p.cards.skills} value={p.skillsInstalled(profile.skill_count)} />
        <InfoCard label={p.cards.credentials} value={profile.has_env ? p.cards.envSet : p.cards.envMissing} />
      </div>

      <Tabs className="shrink-0" onValueChange={value => setTab(value as DetailTab)} value={tab}>
        <TabsList aria-label={p.title} className="h-8">
          <TabsTrigger className="h-6 px-2.5 text-xs" value="persona">
            {p.tabs.persona}
          </TabsTrigger>
          <TabsTrigger className="h-6 px-2.5 text-xs" value="model">
            {p.tabs.model}
          </TabsTrigger>
          <TabsTrigger className="h-6 px-2.5 text-xs" value="description">
            {p.tabs.description}
          </TabsTrigger>
          <TabsTrigger className="h-6 px-2.5 text-xs" value="export">
            {p.tabs.export}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'persona' &&
        (personaError ? (
          <div className="flex shrink-0 items-start gap-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{personaError}</span>
          </div>
        ) : personaReady ? (
          <SoulEditor initial={persona} onPersona={onPersona} profileName={profile.name} />
        ) : (
          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 items-baseline gap-2">
              <h4 className="text-sm font-medium text-foreground">{p.personaTitle}</h4>
              <span className="text-[0.65rem] text-muted-foreground/70">{p.personaFile}</span>
            </div>
            <PageLoader className="min-h-44 flex-1" label={p.loadingSoul} />
          </section>
        ))}

      {tab === 'model' && <ModelSection onChanged={onChanged} profile={profile} />}
      {tab === 'description' && <DescriptionSection onChanged={onChanged} profile={profile} />}
      {tab === 'export' && <ExportSection profile={profile} />}
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
      notify({ category: 'settings', kind: 'success', title: p.soulSaved, message: profileName })
    } catch (err) {
      setError(err instanceof Error ? err.message : p.failedSaveSoul)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h4 className="text-sm font-medium text-foreground">{p.personaTitle}</h4>
          <span className="text-[0.65rem] text-muted-foreground/70">{p.personaFile}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty ? <span className="text-xs text-muted-foreground">{p.unsavedChanges}</span> : null}
          <Button disabled={!dirty || saving} onClick={() => void handleSave()} size="sm" type="button">
            <Save />
            {saving ? p.saving : t.common.save}
          </Button>
        </div>
      </div>

      <CodeEditor
        className="min-h-0 flex-1"
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

      <p className="shrink-0 text-[0.68rem] text-muted-foreground/70">{p.personaAppliesNote}</p>

      {error && (
        <div className="flex shrink-0 items-start gap-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  )
}

// The profile's main model, changed through the same picker the composer uses
// but written to THAT profile's config.yaml (PUT /api/profiles/{name}/model).
function ModelSection({ onChanged, profile }: { onChanged: () => Promise<void>; profile: ProfileInfo }) {
  const { t } = useI18n()
  const p = t.profiles
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const modelName = profile.model ? displayModelName(profile.model) : ''

  const choose = async (selection: { model: string; provider: string }) => {
    setPickerOpen(false)
    setSaving(true)

    try {
      await updateProfileModel(profile.name, selection)
      notify({ category: 'settings', kind: 'success', title: p.modelSaved, message: displayModelName(selection.model) })
      await onChanged()
    } catch (err) {
      notifyError(err, p.failedSaveModel, 'settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-(--ui-border) px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground/70">
            {p.modelLabel}
          </div>
          <div className="truncate text-sm font-medium text-foreground">{modelName || p.notSet}</div>
          {profile.provider ? <div className="text-[0.68rem] text-muted-foreground/70">{profile.provider}</div> : null}
        </div>
        <Button disabled={saving} onClick={() => setPickerOpen(true)} size="sm" type="button" variant="secondary">
          {saving ? p.saving : p.changeModel}
        </Button>
      </div>
      <p className="text-[0.68rem] text-muted-foreground/70">{p.modelHint}</p>
      <ModelPickerDialog
        currentModel={profile.model ?? ''}
        currentProvider={profile.provider ?? ''}
        onOpenChange={setPickerOpen}
        onSelect={selection => void choose(selection)}
        open={pickerOpen}
        profile={profile.name}
      />
    </section>
  )
}

// The one-or-two-sentence role description (profile.yaml). Typed text is saved
// as user-authored; "Generate with AI" asks the auxiliary describer, which
// persists its own result, so we just mirror it into the field.
function DescriptionSection({ onChanged, profile }: { onChanged: () => Promise<void>; profile: ProfileInfo }) {
  const { t } = useI18n()
  const p = t.profiles
  const [text, setText] = useState(profile.description ?? '')
  const [saved, setSaved] = useState(profile.description ?? '')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const dirty = text !== saved

  const save = async () => {
    setSaving(true)
    setError(null)

    try {
      await updateProfileDescription(profile.name, text.trim())
      setSaved(text)
      notify({ category: 'settings', kind: 'success', title: p.descriptionSaved, message: profileLabel(profile) })
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : p.failedSaveDescription)
    } finally {
      setSaving(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    setError(null)

    try {
      const result = await describeProfileAuto(profile.name, { overwrite: true })

      if (!result.ok || !result.description) {
        setError(result.reason || p.failedGenerate)

        return
      }

      setText(result.description)
      setSaved(result.description)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : p.failedGenerate)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-foreground">{p.tabs.description}</h4>
          <p className="text-[0.68rem] text-muted-foreground/70">{p.descriptionHint}</p>
        </div>
        <Button disabled={generating || saving} onClick={() => void generate()} size="sm" type="button" variant="ghost">
          <Codicon name="sparkle" size="0.8rem" />
          {generating ? p.generating : p.generateDescription}
        </Button>
        <Button disabled={!dirty || saving || generating} onClick={() => void save()} size="sm" type="button">
          <Save />
          {saving ? p.saving : t.common.save}
        </Button>
      </div>
      <label className="sr-only" htmlFor={`profile-description-${profile.name}`}>
        {p.tabs.description}
      </label>
      <Textarea
        className="min-h-24 text-xs leading-5"
        id={`profile-description-${profile.name}`}
        onChange={event => setText(event.target.value)}
        placeholder={p.descriptionHint}
        value={text}
      />
      {profile.description_auto && !dirty ? (
        <p className="text-[0.68rem] text-muted-foreground/70">{p.descriptionAuto}</p>
      ) : null}
      {error && (
        <div className="flex shrink-0 items-start gap-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  )
}

function ExportSection({ profile }: { profile: ProfileInfo }) {
  const { t } = useI18n()
  const p = t.profiles

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-(--ui-border) px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{p.exportTitle}</div>
          <p className="text-[0.68rem] text-muted-foreground/70">{p.exportHint}</p>
        </div>
        <Button onClick={() => void runExportProfileFlow(profile.name)} size="sm" type="button" variant="secondary">
          <Codicon name="package" size="0.8rem" />
          {p.exportProfile}
        </Button>
      </div>
    </section>
  )
}
