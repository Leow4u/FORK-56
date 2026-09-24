import type * as React from 'react'
import { useRef, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import type { Work4YouGitWorktree } from '@/global'
import { useI18n } from '@/i18n'
import { isComputerProjectPath } from '@/lib/attached-folder'
import { cn } from '@/lib/utils'
import type { SessionInfo } from '@/work4you'

import {
  SIDEBAR_LEAD_ICON_SIZE,
  SidebarGroupRow,
  SidebarRowBody,
  SidebarRowGrab,
  SidebarRowLabel,
  SidebarRowLead,
  SidebarRowLeadGlyph,
  SidebarRowLink,
  SidebarRowNest,
  SidebarRowShell
} from '../chrome'

import { latestProjectSessions, SIDEBAR_GROUP_PAGE, useWorkspaceNodeOpen } from './model'
import { ProjectContextMenu, ProjectMenu } from './project-menu'
import type { SidebarProjectTree } from './workspace-groups'
import { WorkspaceAddButton, WorkspaceShowMoreButton } from './workspace-header'

// A bare color dot (no icon) or an icon glyph — tinted by `color` when set, else
// the lead's default tertiary. The glyph wrapper centers + caps size either way.
export function projectIcon({ color, icon, isNoProject, path }: SidebarProjectTree) {
  if (color && !icon) {
    return (
      <SidebarRowLeadGlyph>
        <span aria-hidden="true" className="size-1 rounded-full" style={{ backgroundColor: color }} />
      </SidebarRowLeadGlyph>
    )
  }

  const glyph = icon || (isNoProject ? 'home' : isComputerProjectPath(path) ? 'device-desktop' : 'folder-library')

  return (
    <SidebarRowLeadGlyph style={color ? { color } : undefined}>
      <Codicon name={glyph} size={SIDEBAR_LEAD_ICON_SIZE} />
    </SidebarRowLeadGlyph>
  )
}

export function ProjectBackRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <SidebarRowShell>
      <SidebarRowBody
        className="group/back w-full text-(--ui-text-tertiary) opacity-40 hover:text-foreground"
        onClick={onClick}
      >
        <SidebarRowLead>
          <SidebarRowLeadGlyph>
            <Codicon name="arrow-left" size={SIDEBAR_LEAD_ICON_SIZE} />
          </SidebarRowLeadGlyph>
        </SidebarRowLead>
        <SidebarRowLabel className="text-xs underline-offset-4 group-hover/back:underline">{label}</SidebarRowLabel>
      </SidebarRowBody>
    </SidebarRowShell>
  )
}

interface ProjectOverviewRowProps {
  project: SidebarProjectTree
  onEnter?: (id: string) => void
  onNewSession?: (path: null | string) => void
  renderRows?: (sessions: SessionInfo[]) => React.ReactNode
  activeProjectId?: null | string
  previewSessions?: SessionInfo[]
  repoWorktrees?: Record<string, Work4YouGitWorktree[]>
  reorderable?: boolean
  dragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  ref?: React.Ref<HTMLDivElement>
  style?: React.CSSProperties
}

export function ProjectOverviewRow({
  project,
  onEnter,
  onNewSession,
  renderRows,
  activeProjectId,
  previewSessions,
  reorderable = false,
  dragging = false,
  dragHandleProps,
  ref,
  style
}: ProjectOverviewRowProps) {
  const { t } = useI18n()
  const s = t.sidebar
  const isActive = project.id === activeProjectId
  const [open, toggleOpen] = useWorkspaceNodeOpen(project.id)
  // The appearance popover anchors here (the full row) so it opens flush with
  // the sidebar's content edge regardless of which side the sidebar is on.
  const rowRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(SIDEBAR_GROUP_PAGE)
  const fetched = previewSessions ?? []

  const preview = renderRows
    ? fetched.length
      ? fetched
      : latestProjectSessions(project, Number.POSITIVE_INFINITY)
    : []

  const visiblePreview = preview.slice(0, visibleCount)
  const hiddenCount = preview.length - visiblePreview.length
  const nextCount = Math.min(SIDEBAR_GROUP_PAGE, hiddenCount)
  // Overview folders disclose history only. Git lanes stay on drill-in; the
  // live branch already sits on the composer.
  const canExpand = preview.length > 0

  const lead = reorderable ? (
    <SidebarRowGrab
      ariaLabel={s.projects.reorder(project.label)}
      dragging={dragging}
      dragHandleProps={dragHandleProps}
      leadClassName="overflow-visible"
    >
      {projectIcon(project)}
    </SidebarRowGrab>
  ) : (
    <SidebarRowLead>{projectIcon(project)}</SidebarRowLead>
  )

  const shell = (
    <SidebarGroupRow
      actions={
        <>
          {/* Home is a bucket, not a record, so there's nothing to rename or
              delete — but it still starts sessions: a null path is the "no
              folder" chat. New session sits outermost: it's the one you reach
              for. */}
          {!project.isNoProject && <ProjectMenu anchorRef={rowRef} isActive={isActive} project={project} />}
          {onNewSession && (
            <WorkspaceAddButton label={s.newSessionIn(project.label)} onClick={() => onNewSession(project.path)} />
          )}
        </>
      }
      className={cn(dragging && 'cursor-grabbing bg-(--ui-sidebar-surface-background)')}
      data-glass-opaque={dragging ? '' : undefined}
      label={
        <SidebarRowLink
          aria-label={s.projects.enter(project.label)}
          labelClassName={cn('hover:text-foreground hover:underline', isActive && 'text-foreground')}
          onClick={() => onEnter?.(project.id)}
        >
          {project.label}
        </SidebarRowLink>
      }
      lead={lead}
      // The label is grab surface too, not just the lead's grabber — same
      // listeners, minus the controls that keep their own gestures. A project
      // row has no rival drag (its title navigates on CLICK), so the sortable
      // owns the press outright.
      {...dragHandleProps}
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('[data-reorder-handle], [data-row-actions]')) {
          return
        }

        dragHandleProps?.onPointerDown?.(event)
      }}
      ref={rowRef}
      toggle={
        canExpand ? { ariaLabel: s.projects.toggle(project.label, !open), onToggle: toggleOpen, open } : undefined
      }
      totals={{ costUsd: project.totalCostUsd ?? 0, tokens: project.totalTokens ?? 0 }}
    />
  )

  return (
    // Tag each project sibling with its id so a custom skin can target one
    // project in the overview — the parallel to the entered-project wrapper's
    // `data-sessions-project` (index.tsx), which only fires once you've drilled
    // in. Here it's present on every row of the list.
    <div className={cn(dragging && 'relative z-10')} data-sessions-project={project.id} ref={ref} style={style}>
      {/* Home has no per-project actions, so it gets no right-click menu. */}
      {project.isNoProject ? (
        shell
      ) : (
        <ProjectContextMenu isActive={isActive} project={project}>
          {shell}
        </ProjectContextMenu>
      )}
      {open && preview.length > 0 && (
        <SidebarRowNest>
          {renderRows?.(visiblePreview)}
          {hiddenCount > 0 && (
            <WorkspaceShowMoreButton
              count={nextCount}
              label={project.label}
              onClick={() => setVisibleCount(count => count + SIDEBAR_GROUP_PAGE)}
            />
          )}
        </SidebarRowNest>
      )}
    </div>
  )
}
