import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { createCronTriggerController, type CronTriggerController } from '@work4you/shared'
import type * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { LIBRARY_PAGE_MAX_W, PAGE_HEADER_TOP, PAGE_INSET_X } from '@/app/layout-constants'
import { PageTitle } from '@/app/page-title'
import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Codicon } from '@/components/ui/codicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, FieldHint } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SearchField } from '@/components/ui/search-field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ResponsiveTabs } from '@/components/ui/tab-dropdown'
import { Textarea } from '@/components/ui/textarea'
import { type Translations, useI18n } from '@/i18n'
import { localizeAutomationBlueprints } from '@/lib/blueprint-i18n'
import { AlertTriangle } from '@/lib/icons'
import { requestModelOptions } from '@/lib/model-options'
import { displayModelName } from '@/lib/model-status-label'
import { asText } from '@/lib/text'
import { cn } from '@/lib/utils'
import { $activeConnectionId } from '@/store/connections'
import { $cronFocusJobId, $cronJobs, invalidateCronJobsRequests, setCronFocusJobId } from '@/store/cron'
import { $changeEventsAvailable, $cronChangeTick } from '@/store/live-sync'
import { notify, notifyError } from '@/store/notifications'
import { $activeGatewayProfile, $profileScope, ALL_PROFILES } from '@/store/profile'
import {
  type AutomationBlueprint,
  createCronJob,
  type CronDeliveryTarget,
  type CronJob,
  deleteCronJob,
  getAutomationBlueprints,
  getCronDeliveryTargets,
  getCronJobRuns,
  instantiateAutomationBlueprint,
  pauseCronJob,
  resumeCronJob,
  type SessionInfo,
  updateCronJob
} from '@/work4you'

import { useRefreshHotkey } from '../hooks/use-refresh-hotkey'
import { openSession } from '../open-session'
import {
  PanelAction,
  PanelBlock,
  PanelDetail,
  PanelMeta,
  PanelPill,
  type PanelPillTone,
  PanelSectionLabel
} from '../overlays/panel'
import { CRON_NEW_ROUTE, CRON_ROUTE } from '../routes'
import type { SetStatusbarItemGroup } from '../shell/statusbar-controls'

import { mutateAndRefreshCronJobs, refreshCronJobs, triggerAndRefreshCronJobs } from './cron-actions'
import {
  cronEditorUpdates,
  jobIsScriptOnly,
  parseCronDeliveryTargets,
  toggleCronDeliveryTarget,
  validateCronEditor
} from './cron-job-model'
import { jobState, jobTitle } from './job-state'
import {
  MineEmpty,
  RoutineCardGrid,
  type RoutineCardModel,
  routineDotClass,
  TemplateBrowser,
  type TemplateCardModel
} from './routine-board'
import { RoutineCreateDialog, type RoutineCreateValues } from './routine-create-dialog'
import { SCHEDULE_OPTIONS, scheduleOptionForExpr, scheduleSummary } from './schedule'

const DEFAULT_DELIVER = 'local'

// Radix <SelectItem> rejects empty-string values, so the "no override" row in
// the model picker carries this sentinel and is mapped back to '' on save.
const MODEL_DEFAULT_VALUE = '__default__'

function cronProfileForScope(scope: string): string {
  return scope === ALL_PROFILES ? 'all' : scope
}

const STATE_TONE: Record<string, PanelPillTone> = {
  enabled: 'good',
  scheduled: 'good',
  running: 'good',
  paused: 'warn',
  disabled: 'muted',
  error: 'bad',
  completed: 'muted'
}

const truncate = (value: string, max = 80): string => (value.length > max ? `${value.slice(0, max)}…` : value)

function jobName(job: CronJob): string {
  return asText(job.name).trim()
}

function jobPrompt(job: CronJob): string {
  return asText(job.prompt)
}

function jobScheduleDisplay(job: CronJob): string {
  return asText(job.schedule_display) || asText(job.schedule?.display) || asText(job.schedule?.expr) || '—'
}

function jobScheduleExpr(job: CronJob): string {
  return asText(job.schedule?.expr) || asText(job.schedule_display) || ''
}

function jobDeliver(job: CronJob): string {
  return asText(job.deliver) || DEFAULT_DELIVER
}

function jobModel(job: CronJob): string {
  const raw = asText(job.model).trim()

  return raw ? displayModelName(raw) : ''
}

function jobProvider(job: CronJob): string {
  return asText(job.provider).trim()
}

function formatTime(iso?: null | string): string {
  if (!iso) {
    return '—'
  }

  const date = new Date(iso)

  if (Number.isNaN(date.valueOf())) {
    return iso
  }

  return date.toLocaleString()
}

function matchesQuery(job: CronJob, q: string): boolean {
  if (!q) {
    return true
  }

  const needle = q.toLowerCase()

  return [jobTitle(job), jobPrompt(job), jobScheduleDisplay(job), jobScheduleExpr(job), jobDeliver(job)].some(value =>
    value.toLowerCase().includes(needle)
  )
}

interface CronViewProps extends React.ComponentProps<'section'> {
  setStatusbarItemGroup?: SetStatusbarItemGroup
}

export function CronView({ setStatusbarItemGroup: _setStatusbarItemGroup, className, ...props }: CronViewProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const openRun = useCallback((sessionId: string) => openSession(sessionId, navigate), [navigate])
  const c = t.cron
  // Source of truth is the shared atom (also fed by the controller poll), so the
  // sidebar and this page never drift — a delete here clears the sidebar row
  // immediately. `loading` only gates the first paint before the atom is filled.
  const jobs = useStore($cronJobs)
  const [loading, setLoading] = useState(jobs.length === 0)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'jobs' | 'templates'>('jobs')
  const [busyJobTokens, setBusyJobTokens] = useState<ReadonlyMap<string, symbol>>(() => new Map())
  const [triggeringJobKeys, setTriggeringJobKeys] = useState<ReadonlySet<string>>(() => new Set())
  const triggerControllerRef = useRef<CronTriggerController | null>(null)

  // eslint-disable-next-line no-restricted-syntax -- controller mount identity, not an atom mirror
  useEffect(() => {
    const controller = createCronTriggerController((key, running) => {
      if (triggerControllerRef.current !== controller) {
        return
      }

      setTriggeringJobKeys(current => {
        const next = new Set(current)

        if (running) {
          next.add(key)
        } else {
          next.delete(key)
        }

        return next
      })
    })

    triggerControllerRef.current = controller

    return () => {
      triggerControllerRef.current = null
    }
  }, [])

  // Drill-in: a selected job replaces the gallery. Null keeps the card grid.
  const [selectedJobId, setSelectedJobId] = useState<null | string>(null)
  const focusJobId = useStore($cronFocusJobId)

  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [pendingDelete, setPendingDelete] = useState<CronJob | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Jobs live per-profile on disk and the list endpoint aggregates 'all' by
  // default — scope the fetch to the sidebar's profile scope so this page
  // and the sidebar (which share the $cronJobs atom) agree on what's shown.
  const profileScope = useStore($profileScope)
  const profile = cronProfileForScope(profileScope)

  const refresh = useCallback(async () => {
    const { refreshError, stale } = await refreshCronJobs(profile)

    if (stale) {
      return
    }

    if (refreshError) {
      notifyError(refreshError, c.failedLoad)
    }

    setLoading(false)
  }, [c, profile])

  useRefreshHotkey(refresh)

  useEffect(() => {
    void refresh()
    // Fence the previous profile's request before the next profile effect, and
    // fence every pending completion when the page unmounts.

    return () => invalidateCronJobsRequests()
  }, [refresh])

  // Sidebar → "open this job": resolve the focus id (or name) to a job, select
  // it, then clear the one-shot focus so re-opening cron normally doesn't
  // re-trigger it.
  useEffect(() => {
    if (!focusJobId) {
      return
    }

    const match = jobs.find(job => job.id === focusJobId || jobName(job) === focusJobId)

    if (match) {
      setSelectedJobId(match.id)
    }

    setCronFocusJobId(null)
  }, [focusJobId, jobs])

  const visibleJobs = useMemo(
    () => jobs.filter(job => matchesQuery(job, query.trim())).sort((a, b) => jobTitle(a).localeCompare(jobTitle(b))),
    [jobs, query]
  )

  // Blueprint recipes render in the same list rail, below the jobs — clicking
  // one opens the create dialog pre-seeded to that recipe. Same query key as
  // the dialog's "Start from" dropdown, so the catalog is fetched once.
  const blueprintsQuery = useQuery({
    queryKey: ['cron-blueprints'],
    queryFn: async () => (await getAutomationBlueprints()).blueprints
  })

  const localizedBlueprints = useMemo(
    () => localizeAutomationBlueprints(blueprintsQuery.data ?? [], c.blueprints.catalog),
    [blueprintsQuery.data, c.blueprints.catalog]
  )

  const visibleBlueprints = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return needle
      ? localizedBlueprints.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(needle))
      : localizedBlueprints
  }, [localizedBlueprints, query])

  // Detail is an explicit open. Search filtering must not dismiss it, so the
  // lookup is the full job list rather than the visible gallery.
  const selectedJob = useMemo(
    () => (selectedJobId ? (jobs.find(job => job.id === selectedJobId) ?? null) : null),
    [jobs, selectedJobId]
  )

  useEffect(() => {
    if (selectedJobId && !jobs.some(job => job.id === selectedJobId)) {
      setSelectedJobId(null)
    }
  }, [jobs, selectedJobId])

  const routineCards = useMemo<RoutineCardModel[]>(
    () =>
      visibleJobs.map(job => {
        const state = jobState(job)
        const deliver = jobDeliver(job)

        const paused = state === 'paused'

        return {
          busy: busyJobTokens.has(job.id) || triggeringJobKeys.has(`${profile}:${job.id}`),
          deliver: c.deliveryLabels[deliver] ?? deliver,
          dotClassName: routineDotClass(state),
          id: job.id,
          pauseIcon: paused ? 'play' : 'debug-pause',
          pauseLabel: paused ? c.resumeTitle : c.pauseTitle,
          prompt: jobPrompt(job),
          schedule: jobScheduleDisplay(job),
          stateLabel: c.states[state] ?? state,
          title: jobTitle(job),
          tone: STATE_TONE[state] ?? 'muted'
        }
      }),
    [busyJobTokens, c, profile, triggeringJobKeys, visibleJobs]
  )

  const templateCards = useMemo<TemplateCardModel[]>(
    () =>
      visibleBlueprints.map(item => ({
        category: item.category,
        description: item.description,
        key: item.key,
        title: item.title
      })),
    [visibleBlueprints]
  )

  const openCreate = useCallback(
    (blueprintKey?: string) => {
      navigate(blueprintKey ? `${CRON_NEW_ROUTE}?blueprint=${encodeURIComponent(blueprintKey)}` : CRON_NEW_ROUTE)
    },
    [navigate]
  )

  const templateStatus = blueprintsQuery.isLoading
    ? 'loading'
    : blueprintsQuery.isError
      ? 'error'
      : (blueprintsQuery.data?.length ?? 0) === 0
        ? 'empty'
        : 'ready'

  const searchHints = useMemo(() => {
    const source = tab === 'jobs' ? jobs.map(jobTitle) : localizedBlueprints.map(item => item.title)

    return source
      .filter(Boolean)
      .slice(0, 5)
      .map(title => t.common.tryHint(title))
  }, [jobs, localizedBlueprints, t, tab])

  function beginJobBusy(jobId: string): symbol {
    const token = Symbol(jobId)

    setBusyJobTokens(current => new Map(current).set(jobId, token))

    return token
  }

  function endJobBusy(jobId: string, token: symbol): void {
    setBusyJobTokens(current => {
      if (current.get(jobId) !== token) {
        return current
      }

      const next = new Map(current)

      next.delete(jobId)

      return next
    })
  }

  async function handlePauseResume(job: CronJob) {
    const busyToken = beginJobBusy(job.id)

    try {
      const isPaused = jobState(job) === 'paused'

      const { refreshError, stale } = await mutateAndRefreshCronJobs(profile, () =>
        isPaused ? resumeCronJob(job.id) : pauseCronJob(job.id)
      )

      if (stale) {
        return
      }

      if (refreshError) {
        notifyError(refreshError, c.failedLoad)
      }

      notify({
        kind: 'success',
        title: isPaused ? c.resumed : c.paused,
        message: truncate(jobTitle(job), 60)
      })
    } catch (err) {
      notifyError(err, c.failedUpdate)
    } finally {
      endJobBusy(job.id, busyToken)
    }
  }

  async function handleTrigger(job: CronJob) {
    const viewProfile = profile
    const key = `${viewProfile}:${job.id}`
    const controller = triggerControllerRef.current

    if (!controller) {
      return
    }

    try {
      const run = await controller.run(
        key,
        () => triggerAndRefreshCronJobs(job.id, viewProfile),
        () => notify({ kind: 'info', title: c.triggerNow, message: truncate(jobTitle(job), 60) })
      )

      if (
        triggerControllerRef.current !== controller ||
        cronProfileForScope($profileScope.get()) !== viewProfile ||
        !run.started ||
        !run.value
      ) {
        return
      }

      const { refreshError, stale } = run.value

      if (stale) {
        return
      }

      if (refreshError) {
        notifyError(refreshError, c.failedLoad)
      }

      notify({ kind: 'success', title: c.triggered, message: truncate(jobTitle(job), 60) })
    } catch (err) {
      if (triggerControllerRef.current === controller && cronProfileForScope($profileScope.get()) === viewProfile) {
        notifyError(err, c.failedTrigger)
      }
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return
    }

    setDeleting(true)

    try {
      const { refreshError, stale } = await mutateAndRefreshCronJobs(profile, () => deleteCronJob(pendingDelete.id))

      if (stale) {
        return
      }

      if (refreshError) {
        notifyError(refreshError, c.failedLoad)
      }

      notify({ kind: 'success', title: c.deleted, message: truncate(jobTitle(pendingDelete), 60) })
      setSelectedJobId(current => (current === pendingDelete.id ? null : current))
      setPendingDelete(null)
    } catch (err) {
      notifyError(err, c.failedDelete)
    } finally {
      setDeleting(false)
    }
  }

  async function handleEditorSave(values: EditorValues) {
    if (editor.mode === 'edit') {
      const scriptOnlyJob = jobIsScriptOnly(editor.job)

      const {
        value: updated,
        refreshError,
        stale
      } = await mutateAndRefreshCronJobs(profile, () =>
        updateCronJob(editor.job.id, cronEditorUpdates(values, { scriptOnlyJob }))
      )

      if (stale || !updated) {
        return
      }

      if (refreshError) {
        notifyError(refreshError, c.failedLoad)
      }

      notify({ kind: 'success', title: c.updated, message: truncate(jobTitle(updated), 60) })
    }

    setEditor({ mode: 'closed' })
  }

  return (
    <section
      {...props}
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-(--ui-chat-surface-background) pb-4',
        PAGE_INSET_X,
        className
      )}
    >
      {selectedJob ? (
        // The detail keeps the tighter offset under the title bar: its own
        // header is the "Routines ›" breadcrumb, not the page title.
        <div className="flex min-h-0 flex-1 flex-col pt-[calc(var(--titlebar-height)+0.75rem)]">
          <CronJobDetail
            busy={busyJobTokens.has(selectedJob.id) || triggeringJobKeys.has(`${profile}:${selectedJob.id}`)}
            c={c}
            deleteLabel={t.common.delete}
            job={selectedJob}
            onBack={() => setSelectedJobId(null)}
            onDelete={() => setPendingDelete(selectedJob)}
            onEdit={() => setEditor({ mode: 'edit', job: selectedJob })}
            onOpenSession={openRun}
            onPauseResume={() => void handlePauseResume(selectedJob)}
            onTrigger={() => void handleTrigger(selectedJob)}
          />
        </div>
      ) : (
        <>
          <header className={cn('mx-auto mb-4 w-full shrink-0', LIBRARY_PAGE_MAX_W, PAGE_HEADER_TOP)}>
            <PageTitle>{c.title}</PageTitle>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ResponsiveTabs
                align="start"
                onChange={id => setTab(id === 'templates' ? 'templates' : 'jobs')}
                tabs={[
                  { id: 'jobs', label: c.tabs.jobs },
                  { id: 'templates', label: c.tabs.blueprints }
                ]}
                value={tab}
                wideClassName="justify-start"
              />
              <div className="flex items-center gap-3">
                <SearchField
                  aria-label={c.search}
                  hints={searchHints}
                  onChange={setQuery}
                  placeholder={c.search}
                  recede={false}
                  value={query}
                />
                <Button onClick={() => openCreate()} size="sm">
                  {c.newCron}
                </Button>
              </div>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto pb-6">
            <div className={cn('mx-auto flex min-h-full w-full flex-col', LIBRARY_PAGE_MAX_W)}>
              {tab === 'jobs' ? (
                loading && jobs.length === 0 ? (
                  <PageLoader className="flex-1" label={c.loading} />
                ) : jobs.length === 0 && !query.trim() ? (
                  <MineEmpty
                    description={c.emptyDescNew}
                    failedLabel={c.blueprints.failedLoad}
                    onOpenTemplate={openCreate}
                    status={templateStatus === 'empty' ? 'ready' : templateStatus}
                    templates={templateCards}
                    title={c.emptyTitleNew}
                  />
                ) : routineCards.length === 0 ? (
                  <EmptyState description={c.emptyDescSearch} title={c.emptyTitleSearch} />
                ) : (
                  <RoutineCardGrid
                    deleteLabel={t.common.delete}
                    editLabel={c.edit}
                    jobs={routineCards}
                    menuLabel={c.actionsTitle}
                    onDelete={id => {
                      const target = jobs.find(item => item.id === id)

                      if (target) {
                        setPendingDelete(target)
                      }
                    }}
                    onEdit={id => {
                      const target = jobs.find(item => item.id === id)

                      if (target) {
                        setEditor({ mode: 'edit', job: target })
                      }
                    }}
                    onOpen={setSelectedJobId}
                    onPause={id => {
                      const target = jobs.find(item => item.id === id)

                      if (target) {
                        void handlePauseResume(target)
                      }
                    }}
                    onTrigger={id => {
                      const target = jobs.find(item => item.id === id)

                      if (target) {
                        void handleTrigger(target)
                      }
                    }}
                    triggerLabel={c.triggerNow}
                  />
                )
              ) : (
                <TemplateBrowser
                  emptyDescription={c.blueprints.emptyDesc}
                  emptyTitle={c.blueprints.emptyTitle}
                  failedLabel={c.blueprints.failedLoad}
                  loadingLabel={c.blueprints.loading}
                  onOpen={openCreate}
                  searchDescription={c.emptyDescSearch}
                  searchTitle={c.emptyTitleSearch}
                  status={templateStatus}
                  templates={templateCards}
                />
              )}
            </div>
          </div>
        </>
      )}

      <CronEditorDialog editor={editor} onClose={() => setEditor({ mode: 'closed' })} onSave={handleEditorSave} />

      <Dialog onOpenChange={open => !open && !deleting && setPendingDelete(null)} open={pendingDelete !== null}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{c.deleteTitle}</DialogTitle>
            <DialogDescription>
              {pendingDelete ? (
                <>
                  {c.deleteDescPrefix}
                  <span className="font-medium text-foreground">{truncate(jobTitle(pendingDelete), 60)}</span>
                  {c.deleteDescSuffix}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleting} onClick={() => setPendingDelete(null)} variant="outline">
              {t.common.cancel}
            </Button>
            <Button disabled={deleting} onClick={() => void handleConfirmDelete()} variant="destructive">
              {deleting ? c.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function CronJobDetail({
  busy,
  c,
  deleteLabel,
  job,
  onBack,
  onDelete,
  onEdit,
  onOpenSession,
  onPauseResume,
  onTrigger
}: {
  busy: boolean
  c: Translations['cron']
  deleteLabel: string
  job: CronJob
  onBack: () => void
  onDelete: () => void
  onEdit: () => void
  onOpenSession?: (sessionId: string) => void
  onPauseResume: () => void
  onTrigger: () => void
}) {
  const state = jobState(job)
  const isPaused = state === 'paused'
  const deliver = jobDeliver(job)
  const prompt = jobPrompt(job)
  const modelOverride = jobModel(job)
  const title = jobTitle(job)

  return (
    <PanelDetail>
      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <Button className="shrink-0" onClick={onBack} size="inline" type="button" variant="text">
              {c.title}
            </Button>
            <span aria-hidden className="text-muted-foreground">
              /
            </span>
            <span className="truncate font-medium text-foreground">{title}</span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-0.5">
            <PanelAction disabled={busy} icon={isPaused ? 'play' : 'debug-pause'} onClick={onPauseResume}>
              {isPaused ? c.resumeTitle : c.pauseTitle}
            </PanelAction>
            <PanelAction disabled={busy} icon="edit" onClick={onEdit}>
              {c.edit}
            </PanelAction>
            <PanelAction disabled={busy} icon="trash" onClick={onDelete}>
              {deleteLabel}
            </PanelAction>
            <PanelAction disabled={busy} icon="zap" onClick={onTrigger} primary>
              {c.triggerNow}
            </PanelAction>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-[0.95rem] font-semibold tracking-tight text-foreground">{title}</h2>
          <PanelPill tone={STATE_TONE[state] ?? 'muted'}>{c.states[state] ?? state}</PanelPill>
        </div>

        <PanelMeta
          rows={[
            { label: c.frequencyLabel, value: jobScheduleDisplay(job) },
            { label: c.last.replace(/:$/, ''), value: formatTime(job.last_run_at) },
            { label: c.next.replace(/:$/, ''), value: formatTime(job.next_run_at) },
            { label: c.deliverLabel, value: c.deliveryLabels[deliver] ?? deliver },
            ...(modelOverride ? [{ label: c.modelLabel, value: modelOverride }] : [])
          ]}
        />

        {job.last_error ? (
          <div className="flex items-start gap-1.5 rounded bg-destructive/10 p-2 text-[0.7rem] text-destructive">
            <AlertTriangle className="mt-px size-3 shrink-0" />
            <span className="min-w-0 break-words">{job.last_error}</span>
          </div>
        ) : null}
      </header>

      {prompt ? (
        <section className="space-y-1.5">
          <PanelSectionLabel>{c.promptLabel}</PanelSectionLabel>
          <PanelBlock>{prompt}</PanelBlock>
        </section>
      ) : null}

      <CronJobRuns c={c} jobId={job.id} onOpenSession={onOpenSession} />
    </PanelDetail>
  )
}

function formatRunTime(seconds?: null | number): string {
  if (!seconds) {
    return '—'
  }

  const date = new Date(seconds * 1000)

  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString()
}

// Runs are produced by the background scheduler tick. cron.changed /
// sessions.changed broadcasts re-load immediately on event-capable backends
// (the tick dep below), so the poll drops to a slow backstop there; older
// backends keep the legacy cadence.
const RUNS_POLL_INTERVAL_MS = 8000
const RUNS_BACKSTOP_INTERVAL_MS = 60_000

function CronJobRuns({
  c,
  jobId,
  onOpenSession
}: {
  c: Translations['cron']
  jobId: string
  onOpenSession?: (sessionId: string) => void
}) {
  const [runs, setRuns] = useState<null | SessionInfo[]>(null)
  const changeEventsAvailable = useStore($changeEventsAvailable)
  const cronChangeTick = useStore($cronChangeTick)

  useEffect(() => {
    let cancelled = false

    const load = () =>
      getCronJobRuns(jobId)
        .then(result => {
          if (!cancelled) {
            setRuns(result)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRuns(prev => prev ?? [])
          }
        })

    void load()

    const intervalId = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') {
          void load()
        }
      },
      changeEventsAvailable ? RUNS_BACKSTOP_INTERVAL_MS : RUNS_POLL_INTERVAL_MS
    )

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // cronChangeTick: a fired run moves jobs.json bookkeeping → reload now.
  }, [changeEventsAvailable, cronChangeTick, jobId])

  return (
    <div>
      <PanelSectionLabel className="mb-1.5">
        {c.runHistory}
        {runs && runs.length > 0 ? ` · ${runs.length}` : ''}
      </PanelSectionLabel>
      {runs === null ? (
        <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
          <Codicon name="loading" size="0.75rem" spinning />
        </div>
      ) : runs.length === 0 ? (
        <div className="py-1 text-xs text-muted-foreground">{c.noRuns}</div>
      ) : (
        <div className="flex flex-col gap-px">
          {runs.map(run => (
            <button
              className="row-hover flex items-center justify-between gap-3 rounded-md px-2 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              key={run.id}
              onClick={() => onOpenSession?.(run.id)}
              type="button"
            >
              <span className="truncate text-foreground/85">{run.title?.trim() || run.preview?.trim() || run.id}</span>
              <span className="shrink-0 text-[0.62rem] text-muted-foreground/55 tabular-nums">
                {formatRunTime(run.last_active || run.started_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Label a cron delivery target: 'local' → localized "This desktop", known
// platforms → their delivery label, anything else → the backend name. Configured
// platforms without a cron home channel get a "set a home channel first" hint.
function deliverTargetLabel(target: CronDeliveryTarget, c: Translations['cron']): string {
  const base = target.id === 'local' ? c.deliveryLabels.local : (c.deliveryLabels[target.id] ?? target.name)

  return target.id !== 'local' && !target.home_target_set ? `${base} — ${c.deliverNeedsHomeChannel}` : base
}

// The delivery-target checkbox group, shared by the manual cron editor and the
// blueprint form. The scheduler accepts comma-separated targets, so users can
// keep results local while also sending them to connected platforms. Preserve
// selected targets missing from discovery so editing never drops a saved route.
export function DeliverCheckboxes({
  c,
  id,
  onChange,
  targets,
  value
}: {
  c: Translations['cron']
  id: string
  onChange: (next: string) => void
  targets: CronDeliveryTarget[]
  value: string
}) {
  const selected = parseCronDeliveryTargets(value)
  const knownIds = new Set(targets.map(target => target.id))

  const options = [
    ...targets,
    ...selected
      .filter(target => !knownIds.has(target))
      .map(target => ({ home_env_var: null, home_target_set: true, id: target, name: target }))
  ]

  return (
    <div
      aria-labelledby={`${id}-label`}
      className="grid gap-2 rounded-md border border-input px-3 py-2.5"
      id={id}
      role="group"
    >
      {options.map((target, index) => {
        const checked = selected.includes(target.id)
        const checkboxId = `${id}-${index}`

        return (
          <label className="flex items-center gap-2 text-sm" htmlFor={checkboxId} key={target.id}>
            <Checkbox
              checked={checked}
              id={checkboxId}
              onCheckedChange={next => onChange(toggleCronDeliveryTarget(value, target.id, next === true))}
            />
            <span>{deliverTargetLabel(target, c)}</span>
          </label>
        )
      })}
    </div>
  )
}

function CronEditorDialog({
  editor,
  onClose,
  onSave
}: {
  editor: EditorState
  onClose: () => void
  onSave: (values: EditorValues) => Promise<void>
}) {
  const { t } = useI18n()
  const c = t.cron
  const open = editor.mode !== 'closed'
  const isEdit = editor.mode === 'edit'
  const initial = isEdit ? editor.job : null
  const scriptOnlyJob = initial ? jobIsScriptOnly(initial) : false

  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [schedule, setSchedule] = useState('')
  const [schedulePreset, setSchedulePreset] = useState('daily')
  const [deliver, setDeliver] = useState(DEFAULT_DELIVER)
  // Per-job model override, encoded as `${providerSlug}:${model}` (split on the
  // first ':' when saving). MODEL_DEFAULT_VALUE = follow the global default.
  const [modelChoice, setModelChoice] = useState(MODEL_DEFAULT_VALUE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const modelOptions = useQuery({
    queryKey: ['model-options', 'global'],
    queryFn: () => requestModelOptions({}),
    enabled: open && !scriptOnlyJob
  })

  // Single source of truth for where a cron can deliver (local + configured
  // gateways) — same endpoint the dashboard uses, so no dialog offers a platform
  // that isn't connected. Shared by the manual editor and the blueprint form.
  const deliveryTargets = useQuery({
    queryKey: ['cron-delivery-targets'],
    queryFn: () => getCronDeliveryTargets(),
    enabled: open
  })

  useEffect(() => {
    if (!open) {
      return
    }

    setName(initial ? jobName(initial) : '')
    setPrompt(initial ? jobPrompt(initial) : '')
    setSchedule(initial ? jobScheduleExpr(initial) : (SCHEDULE_OPTIONS[0].expr ?? ''))
    setSchedulePreset(initial ? scheduleOptionForExpr(jobScheduleExpr(initial)).value : 'daily')
    setDeliver(initial ? jobDeliver(initial) : DEFAULT_DELIVER)
    setModelChoice(initial && jobModel(initial) ? `${jobProvider(initial)}:${jobModel(initial)}` : MODEL_DEFAULT_VALUE)
    setError(null)
    setSaving(false)
  }, [editor, initial, open])

  const selectedScheduleOption =
    SCHEDULE_OPTIONS.find(candidate => candidate.value === schedulePreset) ?? SCHEDULE_OPTIONS[0]

  function handleSchedulePresetChange(nextPreset: string) {
    setSchedulePreset(nextPreset)
    setError(null)

    const option = SCHEDULE_OPTIONS.find(candidate => candidate.value === nextPreset)

    if (option?.expr) {
      setSchedule(option.expr)
    } else if (scheduleOptionForExpr(schedule).value !== 'custom') {
      setSchedule('')
    }
  }

  const scheduleHint = scheduleSummary(selectedScheduleOption, schedule, c)

  // Configured providers with at least one available model — mirrors the chat
  // model picker's gate so only actually-selectable models are offered.
  const modelProviders = (modelOptions.data?.providers ?? []).filter(
    provider => provider.authenticated !== false && (provider.models ?? []).length > 0
  )

  // A previously pinned model that has since left the catalog (provider
  // removed / model retired) would render Radix's blank trigger. Keep the
  // stored pin visible and re-selectable rather than silently dropping it.
  const modelChoiceKnown =
    modelChoice === MODEL_DEFAULT_VALUE ||
    modelProviders.some(provider => (provider.models ?? []).some(model => `${provider.slug}:${model}` === modelChoice))

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const validationError = validateCronEditor({
      prompt,
      schedule,
      scriptOnlyJob
    })

    if (validationError) {
      setError(
        validationError === 'schedule'
          ? c.scheduleRequired
          : validationError === 'prompt'
            ? c.promptRequired
            : c.promptScheduleRequired
      )

      return
    }

    // Decode `${providerSlug}:${model}` — the model half may itself contain
    // ':' (e.g. openrouter 'anthropic/claude-sonnet-4:beta'), so split once.
    const overrideIndex = modelChoice === MODEL_DEFAULT_VALUE ? -1 : modelChoice.indexOf(':')
    const overrideProvider = overrideIndex >= 0 ? modelChoice.slice(0, overrideIndex) : ''
    const overrideModel = overrideIndex >= 0 ? modelChoice.slice(overrideIndex + 1) : ''

    setSaving(true)
    setError(null)

    try {
      await onSave({
        deliver,
        model: overrideModel,
        name: name.trim(),
        prompt: prompt.trim(),
        provider: overrideProvider,
        schedule: schedule.trim()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : c.failedSave)
    } finally {
      setSaving(false)
    }
  }

  const fields = (
    <>
      <DialogHeader>
        <DialogTitle>{c.editTitle}</DialogTitle>
        <DialogDescription>{c.editDesc}</DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        {scriptOnlyJob && initial && (
          <FieldHint>
            {c.scriptOnlyEditHint} <span className="font-mono">{initial.id}</span>
          </FieldHint>
        )}

        <Field htmlFor="cron-name" label={c.nameLabel} optional optionalLabel={c.optional}>
          <Input
            autoFocus
            id="cron-name"
            onChange={event => setName(event.target.value)}
            placeholder={c.namePlaceholder}
            value={name}
          />
        </Field>

        <Field htmlFor="cron-prompt" label={c.promptLabel} optional={scriptOnlyJob} optionalLabel={c.optional}>
          <Textarea
            className="min-h-24 font-mono"
            id="cron-prompt"
            onChange={event => setPrompt(event.target.value)}
            placeholder={c.promptPlaceholder}
            value={prompt}
          />
        </Field>

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field htmlFor="cron-frequency" label={c.frequencyLabel}>
            <Select onValueChange={handleSchedulePresetChange} value={schedulePreset}>
              <SelectTrigger className="h-9 rounded-md" id="cron-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {c.scheduleLabels[option.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field htmlFor="cron-deliver" label={c.deliverLabel}>
            <DeliverCheckboxes
              c={c}
              id="cron-deliver"
              onChange={setDeliver}
              targets={deliveryTargets.data ?? []}
              value={deliver}
            />
          </Field>
        </div>

        {!scriptOnlyJob && (
          <Field htmlFor="cron-model" label={c.modelLabel} optional optionalLabel={c.optional}>
            <Select onValueChange={setModelChoice} value={modelChoice}>
              <SelectTrigger className="h-9 rounded-md" id="cron-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MODEL_DEFAULT_VALUE}>{c.modelDefault}</SelectItem>
                {!modelChoiceKnown && (
                  <SelectItem value={modelChoice}>
                    {displayModelName(modelChoice.slice(modelChoice.indexOf(':') + 1))}
                  </SelectItem>
                )}
                {modelProviders.map(provider => (
                  <SelectGroup key={provider.slug}>
                    <SelectLabel>{provider.name}</SelectLabel>
                    {(provider.models ?? []).map(model => (
                      <SelectItem key={`${provider.slug}:${model}`} value={`${provider.slug}:${model}`}>
                        {displayModelName(model)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {schedulePreset === 'custom' ? (
          <Field htmlFor="cron-schedule" label={c.customScheduleLabel}>
            <Input
              className="font-mono"
              id="cron-schedule"
              onChange={event => setSchedule(event.target.value)}
              placeholder={c.customPlaceholder}
              value={schedule}
            />
            <FieldHint>{c.customHint}</FieldHint>
          </Field>
        ) : (
          <div className="rounded-md bg-(--ui-bg-quinary) px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">{scheduleHint}</span>
              <span className="font-mono text-muted-foreground">{schedule}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button disabled={saving} onClick={onClose} type="button" variant="outline">
            {t.common.cancel}
          </Button>
          <Button disabled={saving} type="submit">
            {saving ? t.common.saving : c.saveChanges}
          </Button>
        </DialogFooter>
      </form>
    </>
  )

  return (
    <Dialog onOpenChange={value => !value && !saving && onClose()} open={open}>
      <DialogContent className="max-w-lg">{fields}</DialogContent>
    </Dialog>
  )
}

type EditorState = { job: CronJob; mode: 'edit' } | { mode: 'closed' }

interface EditorValues {
  deliver: string
  /** Per-job model override ('' = follow the global default). */
  model: string
  name: string
  prompt: string
  /** Provider slug for the model override ('' = none). */
  provider: string
  schedule: string
}

export function CronCreatePage({ className, ...props }: React.ComponentProps<'section'>) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const c = t.cron
  const profileScope = useStore($profileScope)
  const activeProfile = useStore($activeGatewayProfile)
  const connectionId = useStore($activeConnectionId)
  const profile = cronProfileForScope(profileScope)

  const isCurrent = () =>
    activeProfile === $activeGatewayProfile.get() &&
    connectionId === $activeConnectionId.get() &&
    profileScope === $profileScope.get()

  const blueprintKey = params.get('blueprint')?.trim() || undefined

  async function handleSave(values: RoutineCreateValues) {
    const {
      value: created,
      refreshError,
      stale
    } = await mutateAndRefreshCronJobs(profile, () =>
      createCronJob({
        prompt: values.prompt,
        schedule: values.schedule,
        name: values.name || undefined,
        deliver: values.deliver || DEFAULT_DELIVER,
        ...(values.workdir ? { workdir: values.workdir } : {}),
        ...(values.model.trim() ? { model: values.model.trim(), provider: values.provider.trim() || undefined } : {})
      })
    )

    if (stale || !created || !isCurrent()) {
      return
    }

    if (refreshError) {
      notifyError(refreshError, c.failedLoad)
    }

    notify({ kind: 'success', title: c.created, message: truncate(jobTitle(created), 60) })
    navigate(CRON_ROUTE)
  }

  async function handleBlueprintCreate(blueprint: AutomationBlueprint, values: Record<string, string>) {
    const writableProfile = profileScope === ALL_PROFILES ? 'default' : profileScope

    const {
      value: job,
      refreshError,
      stale
    } = await mutateAndRefreshCronJobs(profile, () =>
      instantiateAutomationBlueprint({ blueprint: blueprint.key, values }, writableProfile)
    )

    if (stale || !job || !isCurrent()) {
      return
    }

    if (refreshError) {
      notifyError(refreshError, c.failedLoad)
    }

    notify({ kind: 'success', title: c.blueprints.scheduled, message: asText(job.schedule_display) || blueprint.title })
    navigate(CRON_ROUTE)
  }

  return (
    <>
      <CronView {...props} className={className} />
      <RoutineCreateDialog
        blueprintKey={blueprintKey}
        key={`${connectionId}:${activeProfile}:${profileScope}:${blueprintKey ?? 'custom'}`}
        onBlueprintCreate={handleBlueprintCreate}
        onClose={() => navigate(CRON_ROUTE)}
        onSave={handleSave}
      />
    </>
  )
}
