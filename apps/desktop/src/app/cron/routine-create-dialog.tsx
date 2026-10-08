import './routine-create.css'

import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldHint } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ProfileFace } from '@/components/ui/profile-face'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { blueprintOptionLabel, localizeAutomationBlueprints } from '@/lib/blueprint-i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { AlertTriangle, ChevronDown, Clock, SlidersHorizontal, X } from '@/lib/icons'
import { requestModelOptions } from '@/lib/model-options'
import { displayModelName } from '@/lib/model-status-label'
import { $activeConnectionId } from '@/store/connections'
import { $activeGatewayProfile, $profiles, $profileScope, ALL_PROFILES, profileLabel } from '@/store/profile'
import { $projectScope } from '@/store/project-scope'
import { $ownProfileProjectTree } from '@/store/projects'
import { type AutomationBlueprint, getAutomationBlueprints, getCronDeliveryTargets } from '@/work4you'

import { BlueprintSlotControl, blueprintSlotHelp, cleanBlueprintFieldError, initialBlueprintValues } from './blueprints'
import { validateCronEditor } from './cron-job-model'
import { cronProjectFolder } from './project-folder'
import { RoutineDeliveryPicker } from './routine-delivery-picker'
import { type RoutineProject, RoutineProjectPicker } from './routine-project-picker'
import { SCHEDULE_OPTIONS, scheduleOptionForExpr, scheduleSummary } from './schedule'

const DEFAULT_MODEL = '__default__'
const CUSTOM_TEMPLATE = 'custom'

export interface RoutineCreateValues {
  deliver: string
  model: string
  name: string
  prompt: string
  provider: string
  schedule: string
  workdir?: string
}

function initialProject(): RoutineProject | null {
  const projects = $ownProfileProjectTree.get()
  const path = cronProjectFolder($projectScope.get(), projects, isDesktopFsRemoteMode())
  const project = projects.find(item => item.id === $projectScope.get())

  return path && project ? { id: project.id, label: project.label, path } : null
}

export function RoutineCreateDialog({
  blueprintKey,
  onClose,
  onSave,
  onBlueprintCreate
}: {
  blueprintKey?: string
  onClose: () => void
  onSave: (values: RoutineCreateValues) => Promise<void>
  onBlueprintCreate: (blueprint: AutomationBlueprint, values: Record<string, string>) => Promise<void>
}) {
  const { t, locale } = useI18n()
  const c = t.cron
  const copy = c.create
  const activeProfile = useStore($activeGatewayProfile)
  const scope = useStore($profileScope)
  const connection = useStore($activeConnectionId)
  const profiles = useStore($profiles)
  const [template, setTemplate] = useState(blueprintKey || CUSTOM_TEMPLATE)
  const isBlueprint = template !== CUSTOM_TEMPLATE
  // Blueprint instantiation already targets default when the library browses all
  // profiles; manual creation targets the active backend. Show the actual owner.
  const owner = isBlueprint && scope === ALL_PROFILES ? 'default' : activeProfile
  const ownerInfo = profiles.find(profile => profile.name === owner)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [project, setProject] = useState(initialProject)
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [deliver, setDeliver] = useState('local')
  const [schedule, setSchedule] = useState('0 9 * * *')
  const [preset, setPreset] = useState('daily')
  const [advanced, setAdvanced] = useState(false)
  const [slots, setSlots] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const catalog = useQuery({
    queryKey: ['cron-blueprints', connection, activeProfile],
    queryFn: async () => (await getAutomationBlueprints()).blueprints
  })

  const blueprints = useMemo(
    () => localizeAutomationBlueprints(catalog.data ?? [], c.blueprints.catalog),
    [catalog.data, c.blueprints.catalog]
  )

  const blueprint = blueprints.find(item => item.key === template)

  const models = useQuery({
    queryKey: ['model-options', connection, activeProfile, 'global'],
    queryFn: () => requestModelOptions({}),
    enabled: !isBlueprint
  })

  const destinations = useQuery({
    queryKey: ['cron-delivery-targets', connection, owner],
    queryFn: () => getCronDeliveryTargets(owner),
    staleTime: 0
  })

  useEffect(() => {
    setSlots(blueprint ? initialBlueprintValues(blueprint) : {})
    setError(null)
  }, [blueprint])

  const providers = (models.data?.providers ?? []).filter(
    provider => provider.authenticated !== false && provider.models?.length
  )

  const modelIndex = model.indexOf(':')
  const modelLabel = model === DEFAULT_MODEL ? copy.defaultModel : displayModelName(model.slice(modelIndex + 1))
  const parts = schedule.trim().split(/\s+/)
  const time = `${(parts[1] || '9').padStart(2, '0')}:${(parts[0] || '0').padStart(2, '0')}`
  const summary = scheduleSummary(scheduleOptionForExpr(schedule), schedule, c, locale)

  function setPart(index: number, value: string) {
    const next = [...parts]
    next[index] = value
    setSchedule(next.join(' '))
  }

  function choosePreset(next: string) {
    setPreset(next)
    setError(null)
    const expression = SCHEDULE_OPTIONS.find(option => option.value === next)?.expr

    if (!expression) {
      setAdvanced(true)

      return
    }

    const nextParts = expression.split(' ')

    // Keep the chosen time while moving between daily/weekday/weekly/monthly.
    if (
      ['daily', 'weekdays', 'weekly', 'monthly'].includes(preset) &&
      ['daily', 'weekdays', 'weekly', 'monthly'].includes(next)
    ) {
      nextParts[0] = parts[0]
      nextParts[1] = parts[1]
    }

    setSchedule(nextParts.join(' '))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    if (submitting.current || (isBlueprint && !blueprint)) {
      return
    }

    if (!isBlueprint) {
      const invalid = validateCronEditor({ prompt, schedule, scriptOnlyJob: false })

      if (invalid) {
        setError(
          invalid === 'prompt'
            ? c.promptRequired
            : invalid === 'schedule'
              ? c.scheduleRequired
              : c.promptScheduleRequired
        )

        return
      }
    }

    submitting.current = true
    setSaving(true)
    setError(null)

    try {
      if (isBlueprint && blueprint) {
        await onBlueprintCreate(blueprint, slots)
      } else {
        await onSave({
          name: name.trim(),
          prompt: prompt.trim(),
          schedule: schedule.trim(),
          deliver,
          model: model === DEFAULT_MODEL ? '' : model.slice(modelIndex + 1),
          provider: model === DEFAULT_MODEL ? '' : model.slice(0, modelIndex),
          ...(project && !isDesktopFsRemoteMode() ? { workdir: project.path } : {})
        })
      }
    } catch (failure) {
      setError(cleanBlueprintFieldError(failure instanceof Error ? failure.message : c.failedSave))
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  const delivery = (value: string, onChange: (next: string) => void) => (
    <RoutineDeliveryPicker
      failed={destinations.isError}
      loading={destinations.isPending}
      onChange={onChange}
      onRetry={() => void destinations.refetch()}
      targets={destinations.data ?? []}
      value={value}
    />
  )

  return (
    <Dialog
      onOpenChange={open => {
        if (!open && !submitting.current) {
          onClose()
        }
      }}
      open
    >
      <DialogContent
        bodyClassName="routine-dialog-body"
        className="routine-create-dialog"
        data-routine-create=""
        onOpenAutoFocus={event => {
          if (nameRef.current) {
            event.preventDefault()
            nameRef.current.focus()
          }
        }}
        showCloseButton={false}
      >
        <form aria-busy={saving} className="routine-create-form" onSubmit={submit}>
          <header className="routine-dialog-header">
            <DialogTitle>{c.newCron}</DialogTitle>
            <DialogDescription className="sr-only">{copy.description}</DialogDescription>
            <Select disabled={saving} onValueChange={setTemplate} value={template}>
              <SelectTrigger aria-label={c.blueprints.startFrom} className="routine-template-trigger">
                <span>{copy.useTemplate}</span>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={CUSTOM_TEMPLATE}>{c.blueprints.custom}</SelectItem>
                {blueprints.map(item => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.title}
                  </SelectItem>
                ))}
                {catalog.isPending && <p className="p-2 text-xs text-muted-foreground">{c.blueprints.loading}</p>}
              </SelectContent>
            </Select>
            <Button
              aria-label={t.common.close}
              disabled={saving}
              onClick={onClose}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </header>

          <div className="routine-dialog-scroll">
            <fieldset className="routine-fields" disabled={saving}>
              <div className="routine-owner">
                <ProfileFace name={owner} size={40} />
                <span className="truncate font-semibold">{ownerInfo ? profileLabel(ownerInfo) : owner}</span>
              </div>

              {catalog.isError && (
                <button
                  className="text-start text-xs text-destructive underline"
                  onClick={() => void catalog.refetch()}
                  type="button"
                >
                  {copy.retryTemplates}
                </button>
              )}
              {isBlueprint ? (
                <div className="grid gap-5">
                  {blueprint ? (
                    <>
                      <div>
                        <h3 className="text-base font-semibold">{blueprint.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{blueprint.description}</p>
                      </div>
                      {blueprint.fields.map(field => {
                        const id = `routine-blueprint-${field.name}`

                        if (field.name === 'deliver') {
                          return (
                            <div key={field.name}>
                              {delivery(slots[field.name] || 'local', next =>
                                setSlots(values => ({ ...values, [field.name]: next }))
                              )}
                            </div>
                          )
                        }

                        const help = blueprintSlotHelp(field)

                        return (
                          <Field
                            htmlFor={id}
                            key={field.name}
                            label={field.label}
                            optional={field.optional}
                            optionalLabel={c.optional}
                          >
                            <BlueprintSlotControl
                              field={field}
                              id={id}
                              onChange={next => setSlots(values => ({ ...values, [field.name]: next }))}
                              optionLabel={option =>
                                blueprintOptionLabel(blueprint.key, field, option, c.blueprints.catalog)
                              }
                              value={slots[field.name] ?? ''}
                            />
                            {help && <FieldHint>{help}</FieldHint>}
                          </Field>
                        )
                      })}
                    </>
                  ) : (
                    <p role="status">{catalog.isPending ? c.blueprints.loading : copy.templateUnavailable}</p>
                  )}
                </div>
              ) : (
                <>
                  <Field htmlFor="routine-name" label={c.nameLabel} optional optionalLabel={c.optional}>
                    <Input
                      aria-label={c.nameLabel}
                      id="routine-name"
                      onChange={event => setName(event.target.value)}
                      placeholder={c.namePlaceholder}
                      ref={nameRef}
                      value={name}
                    />
                  </Field>
                  <div className="routine-instructions">
                    <label htmlFor="routine-prompt">{copy.instructions}</label>
                    <textarea
                      id="routine-prompt"
                      onChange={event => setPrompt(event.target.value)}
                      placeholder={c.promptPlaceholder}
                      value={prompt}
                    />
                    <div className="routine-composer-toolbar">
                      <RoutineProjectPicker onChange={setProject} onError={setError} value={project} />
                      <Select onValueChange={setModel} value={model}>
                        <SelectTrigger
                          aria-label={c.modelLabel}
                          className="routine-composer-chip routine-model-chip"
                          title={model === DEFAULT_MODEL ? copy.defaultModelHint : modelLabel}
                        >
                          <SlidersHorizontal aria-hidden className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {copy.ai} · {modelLabel}
                          </span>
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value={DEFAULT_MODEL}>{copy.defaultModelHint}</SelectItem>
                          {providers.map(provider => (
                            <SelectGroup key={provider.slug}>
                              <SelectLabel>{provider.name}</SelectLabel>
                              {(provider.models ?? []).map(option => (
                                <SelectItem key={option} value={`${provider.slug}:${option}`}>
                                  {displayModelName(option)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                          {models.isPending && <p className="p-2 text-xs text-muted-foreground">{t.common.loading}</p>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {models.isError && (
                    <button
                      className="text-start text-xs text-destructive underline"
                      onClick={() => void models.refetch()}
                      type="button"
                    >
                      {copy.retryModels}
                    </button>
                  )}
                  <div className="routine-schedule-group">
                    <div className="routine-setting-row">
                      <label htmlFor="routine-frequency">{copy.repeat}</label>
                      <Select onValueChange={choosePreset} value={preset}>
                        <SelectTrigger className="routine-value-select" id="routine-frequency">
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
                    </div>
                    {['daily', 'weekdays', 'weekly', 'monthly'].includes(preset) && (
                      <div className="routine-setting-row">
                        <label htmlFor="routine-time">{copy.time}</label>
                        <Input
                          className="routine-time"
                          id="routine-time"
                          onChange={event => {
                            if (!event.target.value) {
                              return
                            }

                            const [hour, minute] = event.target.value.split(':')
                            const next = [...parts]
                            next[0] = String(Number(minute))
                            next[1] = String(Number(hour))
                            setSchedule(next.join(' '))
                          }}
                          required
                          type="time"
                          value={time}
                        />
                      </div>
                    )}
                    {preset === 'weekly' && (
                      <div className="routine-setting-row">
                        <label htmlFor="routine-weekday">{copy.weekday}</label>
                        <Select onValueChange={day => setPart(4, day)} value={parts[4]}>
                          <SelectTrigger className="routine-value-select" id="routine-weekday">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 7 }, (_, day) => (
                              <SelectItem key={day} value={String(day)}>
                                {c.days[String(day)]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {(preset === 'monthly' || preset === 'hourly') && (
                      <div className="routine-setting-row">
                        <label htmlFor="routine-schedule-number">
                          {preset === 'monthly' ? copy.monthDay : copy.minute}
                        </label>
                        <Input
                          className="routine-number"
                          id="routine-schedule-number"
                          max={preset === 'monthly' ? 31 : 59}
                          min={preset === 'monthly' ? 1 : 0}
                          onChange={event => setPart(preset === 'monthly' ? 2 : 0, event.target.value)}
                          required
                          type="number"
                          value={parts[preset === 'monthly' ? 2 : 0]}
                        />
                      </div>
                    )}
                  </div>
                  {delivery(deliver, setDeliver)}
                  <div className="routine-more">
                    <Button
                      aria-controls="routine-advanced"
                      aria-expanded={advanced}
                      onClick={() => setAdvanced(value => !value)}
                      size="sm"
                      type="button"
                      variant="text"
                    >
                      {copy.more}
                      <ChevronDown aria-hidden className={`size-3.5 ${advanced ? 'rotate-180' : ''}`} />
                    </Button>
                    {advanced && (
                      <div className="mt-4 grid gap-2" id="routine-advanced">
                        <Field htmlFor="routine-expression" label={c.customScheduleLabel}>
                          <Input
                            className="font-mono"
                            id="routine-expression"
                            onChange={event => {
                              setPreset('custom')
                              setSchedule(event.target.value)
                            }}
                            placeholder="0 9 * * *"
                            value={schedule}
                          />
                          <FieldHint>{copy.customHint}</FieldHint>
                        </Field>
                        <p className="text-xs text-muted-foreground">{copy.timezoneHint}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              {error && (
                <div
                  className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </fieldset>
          </div>
          <footer className="routine-dialog-footer">
            <p className="routine-summary" title={isBlueprint ? blueprint?.title : schedule}>
              <Clock aria-hidden className="size-4 shrink-0" />
              <span>{isBlueprint ? blueprint?.title : summary || schedule}</span>
            </p>
            <div className="flex shrink-0 gap-2">
              <Button disabled={saving} onClick={onClose} type="button" variant="secondary">
                {t.common.cancel}
              </Button>
              <Button disabled={saving || (isBlueprint && !blueprint)} type="submit">
                {saving ? t.common.saving : copy.submit}
              </Button>
            </div>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
