import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { workspacePickerProjects } from '@/app/command-palette/workspace-palette'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSearch,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { ChevronDown } from '@/lib/icons'
import { $dismissedAutoProjectIds, $sidebarProjectOrderIds } from '@/store/layout'
import {
  $ownProfileProjectTree,
  createProject,
  pickProjectFolder,
  projectRootCwd,
  refreshOwnProfileProjectTree
} from '@/store/projects'
import { getApiRequestConnection, getApiRequestProfile } from '@/work4you'

export interface RoutineProject {
  id: string
  label: string
  path: string
}

// Uses the composer's project catalog, but selection belongs to this form.
// Opening a folder promotes it to a project without entering it or starting a chat.
export function RoutineProjectPicker({
  value,
  onChange,
  onError
}: {
  value: RoutineProject | null
  onChange: (project: RoutineProject | null) => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const projects = useStore($ownProfileProjectTree)
  const orderIds = useStore($sidebarProjectOrderIds)
  const dismissedIds = useStore($dismissedAutoProjectIds)
  const rows = workspacePickerProjects({ projects, orderIds, dismissedIds, query })
  const remote = isDesktopFsRemoteMode()
  const opening = useRef(false)
  const mounted = useRef(true)

  // eslint-disable-next-line no-restricted-syntax -- component lifetime only, not a mirror of reactive state
  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  async function openFolder() {
    if (opening.current) {
      return
    }

    opening.current = true
    setBusy(true)
    const profile = getApiRequestProfile()
    const connection = getApiRequestConnection()

    const current = () =>
      mounted.current && profile === getApiRequestProfile() && connection === getApiRequestConnection()

    try {
      const path = await pickProjectFolder()

      if (!path || !current()) {
        return
      }

      const existing = projects.find(project => project.path === path && !project.isAuto && !project.archived)

      if (existing) {
        onChange({ id: existing.id, label: existing.label, path })

        return
      }

      const label =
        path
          .replace(/[/\\]+$/, '')
          .split(/[/\\]/)
          .pop() || path

      const created = await createProject({ name: label, folders: [path], primaryPath: path, use: false })

      if (created && current()) {
        onChange({ id: created.id, label: created.name || label, path: created.primary_path || path })
      }
    } catch (error) {
      if (current()) {
        onError(error instanceof Error ? error.message : String(error))
      }
    } finally {
      opening.current = false
      setBusy(false)
    }
  }

  return (
    <DropdownMenu
      onOpenChange={open => {
        setQuery('')

        if (open) {
          void refreshOwnProfileProjectTree()
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t.cron.create.project}
          className="routine-composer-chip"
          disabled={busy || remote}
          title={remote ? t.cron.create.localProjectHint : value?.path}
          type="button"
        >
          <Codicon name="folder" />
          <span className="truncate">{busy ? t.common.loading : value?.label || t.cron.create.project}</span>
          <ChevronDown aria-hidden className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]" sideOffset={8}>
        <DropdownMenuSearch
          aria-label={t.commandCenter.searchProjects}
          onValueChange={setQuery}
          placeholder={t.commandCenter.searchProjects}
          value={query}
        />
        {rows.map(project => (
          <DropdownMenuItem
            key={project.id}
            onSelect={() => onChange({ id: project.id, label: project.label, path: projectRootCwd(project)! })}
          >
            <Codicon name="folder" />
            <span className="flex-1 truncate">{project.label}</span>
            {value?.id === project.id && <Codicon name="check" />}
          </DropdownMenuItem>
        ))}
        {!rows.length && (
          <p className="px-2 py-3 text-xs text-muted-foreground">{t.commandCenter.workspaceSearchEmpty}</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void openFolder()}>
          <Codicon name="folder-opened" />
          {t.commandCenter.openFolder}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <Codicon name="circle-slash" />
          {t.cron.create.noProject}
          {!value && <Codicon className="ml-auto" name="check" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
