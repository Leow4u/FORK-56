import { useStore } from '@nanostores/react'
import { type ReactNode, useMemo, useRef, useState } from 'react'

import {
  buildWorkspacePaletteGroups,
  createWorkspacePaletteHandlers,
  type WorkspacePaletteItem,
  type WorkspacePickerSource
} from '@/app/command-palette/workspace-palette'
import { composerPanelCard } from '@/components/chat/composer-dock'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  dropdownMenuRow,
  DropdownMenuSearch,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { releaseTypingFocus } from '@/components/ui/keyboard-first'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $dismissedAutoProjectIds, $sidebarProjectOrderIds } from '@/store/layout'
import { $activeProjectId, $projectScope, $projectTree } from '@/store/projects'

import { useComposerMenuSide } from '../use-composer-menu-side'

function workspaceItemGlyph(kind: WorkspacePaletteItem['kind']) {
  switch (kind) {
    case 'clear-active':
      return 'close'

    case 'open-folder':
      return 'folder-opened'

    case 'new-project':
      return 'add'

    case 'project':
      return 'folder'
  }
}

export function WorkspaceSelectMenu({
  children,
  cwd = '',
  tooltip
}: {
  children: ReactNode
  cwd?: string
  tooltip: string
}) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const menuSide = useComposerMenuSide(hostRef)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const projects = useStore($projectTree)
  const orderIds = useStore($sidebarProjectOrderIds)
  const dismissedIds = useStore($dismissedAutoProjectIds)
  const scope = useStore($projectScope)
  const activeProjectId = useStore($activeProjectId)

  const handlers = useMemo(() => createWorkspacePaletteHandlers(), [])

  const source = useMemo<WorkspacePickerSource>(
    () => ({
      activeProjectId,
      cwd,
      dismissedIds,
      orderIds,
      projects,
      query,
      scope
    }),
    [activeProjectId, cwd, dismissedIds, orderIds, projects, query, scope]
  )

  const groups = useMemo(
    () =>
      buildWorkspacePaletteGroups(
        {
          clearActive: t.commandCenter.clearActiveWorkspace,
          newProject: t.sidebar.projects.newButton,
          openFolder: t.commandCenter.openFolder
        },
        handlers,
        source
      ),
    [handlers, source, t]
  )

  const items = groups.flatMap(group => group.items)
  const projectItems = items.filter(item => item.kind === 'project')
  const actionItems = items.filter(item => item.kind === 'open-folder' || item.kind === 'new-project')
  const clearItem = items.find(item => item.kind === 'clear-active')
  const showEmpty = query.trim().length > 0 && projectItems.length === 0

  const setMenuOpen = (next: boolean) => {
    setOpen(next)

    if (!next) {
      setQuery('')
      releaseTypingFocus()
    }
  }

  const row = (item: WorkspacePaletteItem) => (
    <DropdownMenuItem className={cn(dropdownMenuRow, 'rounded-md')} key={item.id} onSelect={() => item.run?.()}>
      <Codicon name={workspaceItemGlyph(item.kind)} size="0.75rem" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.active ? <Codicon className="ml-auto" name="check" size="0.75rem" /> : null}
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={open}>
      <div className="contents" ref={hostRef}>
        <Tip label={tooltip} side={menuSide === 'bottom' ? 'top' : 'bottom'}>
          <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        </Tip>
      </div>
      <DropdownMenuContent
        align="start"
        className={cn('w-72', composerPanelCard)}
        data-composer-menu=""
        data-slot="workspace-select-menu"
        side={menuSide}
        sideOffset={8}
      >
        <DropdownMenuSearch
          aria-label={t.commandCenter.searchProjects}
          onValueChange={setQuery}
          placeholder={t.commandCenter.searchProjects}
          value={query}
        />
        {projectItems.map(row)}
        {showEmpty ? (
          <p className="px-2.5 py-1.5 text-xs text-(--ui-text-tertiary)">{t.commandCenter.workspaceSearchEmpty}</p>
        ) : null}
        <DropdownMenuSeparator />
        {actionItems.map(row)}
        {clearItem ? (
          <>
            <DropdownMenuSeparator />
            {row(clearItem)}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
