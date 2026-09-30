import type { ReactNode } from 'react'

import type { PanelPillTone } from '@/app/overlays/panel'
import { ActionsMenu, renderActionItem } from '@/components/ui/actions-menu'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { EmptyState } from '@/components/ui/empty-state'
import { Loader } from '@/components/ui/loader'
import { RowButton } from '@/components/ui/row-button'
import { Bell, Clock, type IconComponent, Mail, Sun } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { STATE_DOT } from './job-state'

const CATEGORY_ICON: Record<string, IconComponent> = {
  daily: Sun,
  email: Mail,
  general: Bell,
  weekly: Clock
}

const STATE_TEXT: Record<PanelPillTone, string> = {
  bad: 'text-destructive',
  good: 'text-(--ui-green)',
  muted: 'text-muted-foreground',
  warn: 'text-(--ui-yellow)'
}

export interface RoutineCardModel {
  busy: boolean
  deliver: string
  dotClassName: string
  id: string
  pauseIcon: 'debug-pause' | 'play'
  pauseLabel: string
  prompt: string
  schedule: string
  stateLabel: string
  title: string
  tone: PanelPillTone
}

export interface TemplateCardModel {
  category: string
  description: string
  key: string
  title: string
}

function wavePath(): string {
  let path = 'M0 14'

  for (let x = 0; x <= 1200; x += 8) {
    path += ` L${x} ${(14 + Math.sin(x / 28) * 5).toFixed(1)}`
  }

  return path
}

const WAVE_PATH = wavePath()

export function RoutineBoardMark() {
  return (
    <svg
      aria-hidden
      className="text-muted-foreground"
      fill="none"
      height="56"
      stroke="currentColor"
      strokeWidth="1.4"
      viewBox="0 0 64 64"
      width="56"
    >
      <rect height="46" rx="4" width="34" x="10" y="8" />
      <path d="M18 20h16M18 28h20M18 36h12" />
      <circle className="fill-(--ui-chat-surface-background)" cx="44" cy="44" r="12" stroke="none" />
      <circle cx="44" cy="44" r="12" />
      <path d="M44 38.5V45l4 2.5" />
    </svg>
  )
}

export function RoutineWave() {
  return (
    <svg
      aria-hidden
      className="my-6 h-6 w-full text-(--ui-text-quaternary)"
      preserveAspectRatio="none"
      viewBox="0 0 1200 28"
    >
      <path d={WAVE_PATH} fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

const templateCardClass =
  'flex h-full w-full flex-col items-start gap-1.5 rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) px-4 py-3.5 text-left transition-colors hover:bg-(--ui-row-hover-background) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

const cardShellClass =
  'group relative rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) transition-colors hover:bg-(--ui-row-hover-background)'

const cardOpenClass =
  'flex h-full w-full flex-col items-start gap-1.5 px-4 py-3.5 pr-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

export function RoutineCardGrid({
  deleteLabel,
  editLabel,
  jobs,
  menuLabel,
  onDelete,
  onEdit,
  onOpen,
  onPause,
  onTrigger,
  triggerLabel
}: {
  deleteLabel: string
  editLabel: string
  jobs: RoutineCardModel[]
  menuLabel: string
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  onOpen: (id: string) => void
  onPause: (id: string) => void
  onTrigger: (id: string) => void
  triggerLabel: string
}) {
  return (
    <CardGrid>
      {jobs.map(job => (
        <div className={cardShellClass} key={job.id}>
          <RowButton className={cardOpenClass} data-panel-row={job.id} onClick={() => onOpen(job.id)}>
            <span className="flex items-center gap-2">
              <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', job.dotClassName)} />
              <span className={cn('text-[0.7rem] font-medium', STATE_TEXT[job.tone])}>{job.stateLabel}</span>
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">{job.title}</span>
            <span className="text-xs text-muted-foreground">
              {job.schedule} · {job.deliver}
            </span>
            {job.prompt ? <span className="line-clamp-2 text-xs text-muted-foreground">{job.prompt}</span> : null}
          </RowButton>
          <div className="absolute right-1.5 top-1.5">
            <ActionsMenu
              ariaLabel={menuLabel}
              contentClassName="w-44"
              items={kit => (
                <>
                  {renderActionItem(kit, {
                    disabled: job.busy,
                    icon: 'zap',
                    key: 'trigger',
                    label: triggerLabel,
                    onSelect: () => onTrigger(job.id)
                  })}
                  {renderActionItem(kit, {
                    disabled: job.busy,
                    icon: job.pauseIcon,
                    key: 'pause',
                    label: job.pauseLabel,
                    onSelect: () => onPause(job.id)
                  })}
                  {renderActionItem(kit, {
                    disabled: job.busy,
                    icon: 'edit',
                    key: 'edit',
                    label: editLabel,
                    onSelect: () => onEdit(job.id)
                  })}
                  <kit.Separator />
                  {renderActionItem(kit, {
                    disabled: job.busy,
                    icon: 'trash',
                    key: 'delete',
                    label: deleteLabel,
                    onSelect: () => onDelete(job.id),
                    variant: 'destructive'
                  })}
                </>
              )}
            >
              <Button aria-label={menuLabel} size="icon-xs" type="button" variant="ghost">
                <Codicon name="kebab-vertical" />
              </Button>
            </ActionsMenu>
          </div>
        </div>
      ))}
    </CardGrid>
  )
}

export function TemplateCardGrid({
  onOpen,
  templates
}: {
  onOpen: (key: string) => void
  templates: TemplateCardModel[]
}) {
  return (
    <CardGrid>
      {templates.map(template => {
        const Icon = CATEGORY_ICON[template.category] ?? Bell

        return (
          <RowButton className={templateCardClass} key={template.key} onClick={() => onOpen(template.key)}>
            <Icon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight text-foreground">{template.title}</span>
            {template.description ? (
              <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{template.description}</span>
            ) : null}
          </RowButton>
        )
      })}
    </CardGrid>
  )
}

export function routineDotClass(state: string): string {
  return STATE_DOT[state] ?? 'bg-muted-foreground'
}

export function MineEmpty({
  description,
  failedLabel,
  onOpenTemplate,
  status,
  templates,
  title
}: {
  description: string
  failedLabel: string
  onOpenTemplate: (key: string) => void
  status: 'error' | 'loading' | 'ready'
  templates: TemplateCardModel[]
  title: string
}) {
  return (
    <div>
      <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
        <RoutineBoardMark />
        <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {status === 'loading' ? (
        <div className="flex justify-center py-10">
          <Loader aria-hidden className="size-8 text-primary/70" pathSteps={180} strokeScale={0.85} type="orbit-ring" />
        </div>
      ) : status === 'error' ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{failedLabel}</p>
      ) : templates.length > 0 ? (
        <>
          <RoutineWave />
          <TemplateCardGrid onOpen={onOpenTemplate} templates={templates} />
        </>
      ) : null}
    </div>
  )
}

export function TemplateBrowser({
  emptyDescription,
  emptyTitle,
  failedLabel,
  loadingLabel,
  onOpen,
  searchDescription,
  searchTitle,
  status,
  templates
}: {
  emptyDescription: string
  emptyTitle: string
  failedLabel: string
  loadingLabel: string
  onOpen: (key: string) => void
  searchDescription?: string
  searchTitle?: string
  status: 'empty' | 'error' | 'loading' | 'ready'
  templates: TemplateCardModel[]
}) {
  if (status === 'loading') {
    return (
      <div aria-label={loadingLabel} className="flex flex-1 items-center justify-center py-16" role="status">
        <Loader aria-hidden className="size-10 text-primary/70" pathSteps={180} strokeScale={0.85} type="orbit-ring" />
      </div>
    )
  }

  if (status === 'error') {
    return <EmptyState description={emptyDescription} title={failedLabel} />
  }

  if (status === 'empty') {
    return <EmptyState description={emptyDescription} title={emptyTitle} />
  }

  if (templates.length === 0) {
    return <EmptyState description={searchDescription} title={searchTitle ?? emptyTitle} />
  }

  return <TemplateCardGrid onOpen={onOpen} templates={templates} />
}
