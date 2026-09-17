import { type ReactNode, useMemo, useState } from 'react'

import {
  buildWorkspaceActionItems,
  createWorkspacePaletteHandlers,
  type WorkspacePaletteItem
} from '@/app/command-palette/workspace-palette'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  dropdownMenuRow,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { releaseTypingFocus } from '@/components/ui/keyboard-first'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

function workspaceItemGlyph(kind: WorkspacePaletteItem['kind']) {
  switch (kind) {
    case 'open-folder':
      return 'folder-opened'

    case 'new-project':
      return 'add'
  }
}

export function WorkspaceSelectMenu({
  children,
  side = 'bottom',
  tooltip
}: {
  children: ReactNode
  side?: 'bottom' | 'top'
  tooltip: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const handlers = useMemo(() => createWorkspacePaletteHandlers(), [])

  const items = useMemo(
    () =>
      buildWorkspaceActionItems(
        {
          newProject: t.sidebar.projects.newButton,
          openFolder: t.commandCenter.openFolder
        },
        handlers
      ),
    [handlers, t]
  )

  const setMenuOpen = (next: boolean) => {
    setOpen(next)

    if (!next) {
      releaseTypingFocus()
    }
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={open}>
      <Tip label={tooltip} side="top">
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent
        align="start"
        className="min-w-52 p-1"
        data-slot="workspace-select-menu"
        side={side}
        sideOffset={4}
      >
        {items.map(item => (
          <DropdownMenuItem className={cn(dropdownMenuRow, 'rounded-md')} key={item.id} onSelect={() => item.run?.()}>
            <Codicon name={workspaceItemGlyph(item.kind)} size="0.75rem" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
