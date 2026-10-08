import { useStore } from '@nanostores/react'
import { type ComponentProps, type ReactNode, useRef, useState } from 'react'

import { TreeSkeleton } from '@/components/chat/skeletons'
import { ErrorBoundary } from '@/components/error-boundary'
import { usePaneVisible } from '@/components/pane-shell/pane-visibility'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { SearchField } from '@/components/ui/search-field'
import { Tip } from '@/components/ui/tooltip'
import { useDelayedTrue } from '@/hooks/use-delayed-true'
import { useI18n } from '@/i18n'
import { desktopFsCacheKey } from '@/lib/desktop-fs'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { cn } from '@/lib/utils'
import { setFileBrowserOpen } from '@/store/layout'
import { notifyError } from '@/store/notifications'
import { $previewOwner, $previewTileSession, openPreview, previewOwnerKey } from '@/store/preview'
import { $connection, $currentCwd, $sessions, sessionMatchesStoredId } from '@/store/session'

import { SidebarPanelLabel } from '../shell/sidebar-label'

import { fileBreadcrumb, hasTreeMatch } from './files/filter'
import { ProjectTree } from './files/tree'
import { useFileFilter } from './files/use-file-filter'
import { useProjectTree } from './files/use-project-tree'
import { $fileViews, DEFAULT_FILE_VIEW, updateFileView } from './files/view-state'

interface RightSidebarPaneProps {
  onActivateFile?: (path: string) => void
  onActivateFolder?: (path: string) => void
  children?: ReactNode
  selectedPath?: string
}

export function RightSidebarPane({ children, selectedPath, onActivateFile, onActivateFolder }: RightSidebarPaneProps) {
  const { t } = useI18n()
  const r = t.rightSidebar
  const owner = useStore($previewOwner)
  const connectionState = useStore($connection)
  const openRequest = useRef(0)
  const paneVisible = usePaneVisible()
  const primaryCwd = useStore($currentCwd)
  const tileSession = useStore($previewTileSession)
  const sessions = useStore($sessions)

  const currentCwd = (
    tileSession ? sessions.find(session => sessionMatchesStoredId(session, tileSession))?.cwd || '' : primaryCwd
  ).trim()

  const [filterRevision, setFilterRevision] = useState(0)

  // The file tree is simply "browse the session's working directory". If the
  // session has a cwd — a repo, a sibling worktree, or any folder — show it. A
  // bare/detached chat (resolveNewSessionCwd → '') has none, so it shows the
  // empty hint instead of whatever dir Work4You happens to run from.
  const viewScope = `${desktopFsCacheKey(connectionState)}:${previewOwnerKey(owner)}:${currentCwd}`
  const viewStates = useStore($fileViews, { keys: [viewScope] })
  const { treeOpen, query } = viewStates[viewScope] ?? DEFAULT_FILE_VIEW
  const setQuery = (value: string) => updateFileView(viewScope, { query: value })
  const hasWorkspace = Boolean(currentCwd)

  const {
    collapseAll,
    collapseNonce,
    data,
    effectiveCwd,
    loadChildren,
    openState,
    refreshRoot,
    rootError,
    rootLoading,
    setNodeOpen
  } = useProjectTree(hasWorkspace ? currentCwd : '', paneVisible && treeOpen)

  const cwdName =
    effectiveCwd
      .split(/[\\/]+/)
      .filter(Boolean)
      .pop() ?? effectiveCwd

  const filter = useFileFilter(effectiveCwd, paneVisible && treeOpen && Boolean(query.trim()), filterRevision)
  const crumbs = fileBreadcrumb(effectiveCwd, selectedPath)
  const canCollapse = Object.values(openState).some(Boolean)

  const previewFile = async (path: string) => {
    const request = ++openRequest.current
    const scope = previewOwnerKey(owner)
    const connection = desktopFsCacheKey()

    const isCurrent = () =>
      request === openRequest.current &&
      connection === desktopFsCacheKey() &&
      previewOwnerKey($previewOwner.get()) === scope &&
      (tileSession
        ? ($sessions.get().find(session => sessionMatchesStoredId(session, tileSession))?.cwd || '').trim() ===
          currentCwd
        : $currentCwd.get().trim() === currentCwd)

    try {
      const preview = await normalizeOrLocalPreviewTarget(path, effectiveCwd || undefined)

      if (!preview) {
        throw new Error(r.couldNotPreview(path))
      }

      if (!isCurrent()) {
        return
      }

      openPreview(preview, 'file-browser', owner)

      if (previewOwnerKey($previewOwner.get()) === scope) {
        setFileBrowserOpen(false)
      }
    } catch (error) {
      if (isCurrent()) {
        notifyError(error, r.previewUnavailable)
      }
    }
  }

  return (
    <section
      aria-label={r.files}
      className="flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground"
      data-files-workspace=""
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-(--ui-stroke-tertiary) px-3">
        <div
          aria-label={r.fileLocation}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-xs text-muted-foreground"
          title={selectedPath || effectiveCwd}
        >
          {crumbs.map((crumb, index) => (
            <span
              className={cn(
                'flex min-w-0 items-center gap-1',
                index === crumbs.length - 1 ? 'text-foreground' : 'shrink'
              )}
              key={`${index}:${crumb}`}
            >
              {index > 0 && <Codicon name="chevron-right" size="0.75rem" />}
              <span className="truncate">{crumb}</span>
            </span>
          ))}
        </div>
        <Tip label={treeOpen ? r.hideFileTree : r.showFileTree}>
          <Button
            aria-label={treeOpen ? r.hideFileTree : r.showFileTree}
            aria-pressed={treeOpen}
            onClick={() => updateFileView(viewScope, { treeOpen: !treeOpen })}
            size="icon-sm"
            variant={treeOpen ? 'secondary' : 'ghost'}
          >
            <Codicon name="files" />
          </Button>
        </Tip>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-file-reader="">
          {children ?? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
              <Codicon className="text-muted-foreground" name="folder-opened" size="1.5rem" />
              <div className="text-sm font-medium">{r.openFile}</div>
              <div className="text-xs text-muted-foreground">
                {hasWorkspace ? r.selectFileFromTree : r.noProjectBody}
              </div>
            </div>
          )}
        </div>
        <aside
          aria-label={r.aria}
          className={cn(
            'flex w-[38%] max-w-60 shrink-0 flex-col border-l border-(--ui-stroke-tertiary)',
            !treeOpen && 'hidden'
          )}
        >
          {hasWorkspace && (
            <div className="px-2 py-2">
              <SearchField
                aria-label={r.filterFiles}
                containerClassName="w-full"
                loading={filter.loading}
                onChange={setQuery}
                placeholder={r.filterFiles}
                recede={false}
                shape="pill"
                value={query}
              />
            </div>
          )}
          {query.trim() && filter.partial && (
            <div className="px-3 pb-2 text-xs text-muted-foreground" role="status">
              {r.partialFilter}
            </div>
          )}
          <FilesystemTab
            canCollapse={canCollapse}
            collapseNonce={collapseNonce}
            cwd={effectiveCwd}
            cwdName={cwdName}
            data={query.trim() ? filter.data : data}
            error={query.trim() ? null : rootError}
            hasWorkspace={hasWorkspace}
            loading={query.trim() ? filter.loading : rootLoading}
            onActivateFile={onActivateFile ?? previewFile}
            onActivateFolder={onActivateFolder ?? previewFile}
            onCollapseAll={collapseAll}
            onLoadChildren={loadChildren}
            onNodeOpenChange={setNodeOpen}
            onPreviewFile={previewFile}
            onRefresh={() => {
              setFilterRevision(value => value + 1)
              void refreshRoot()
            }}
            openState={openState}
            searchTerm={query.trim()}
            selectedPath={selectedPath}
            visible={paneVisible && treeOpen}
          />
        </aside>
      </div>
    </section>
  )
}

interface FilesystemTabProps extends FileTreeBodyProps {
  canCollapse: boolean
  cwdName: string
  hasWorkspace: boolean
  onCollapseAll: () => void
  onRefresh: () => void
}

// Sidebar palette + hover-reveal: header actions stay reachable while moving
// from the project label to the action buttons.
const HEADER_ACTION_CLASS =
  'text-sidebar-foreground/70 hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground! focus-visible:ring-sidebar-ring'

const HEADER_ACTION_LABEL_REVEAL = `${HEADER_ACTION_CLASS} pointer-events-none opacity-0 transition-opacity focus-visible:pointer-events-auto focus-visible:opacity-100 group-focus-within/project-header:pointer-events-auto group-focus-within/project-header:opacity-100 group-hover/project-header:pointer-events-auto group-hover/project-header:opacity-100`

function FilesystemTab({
  canCollapse,
  collapseNonce,
  cwd,
  cwdName,
  data,
  error,
  hasWorkspace,
  loading,
  onActivateFile,
  onActivateFolder,
  onCollapseAll,
  onLoadChildren,
  onNodeOpenChange,
  onPreviewFile,
  onRefresh,
  openState,
  searchTerm,
  selectedPath,
  visible
}: FilesystemTabProps) {
  const { t } = useI18n()
  const r = t.rightSidebar

  // No working directory (a bare/detached chat) → no tree, just a terse hint.
  // Switching workspace is a project/worktree action, never a raw folder picker.
  if (!hasWorkspace) {
    return <PaneEmptyState label={r.noProjectOpen} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RightSidebarSectionHeader>
        <div className="flex min-w-0 flex-1">
          <SidebarPanelLabel>{cwdName}</SidebarPanelLabel>
        </div>
        <Tip label={r.refreshTree}>
          <Button
            aria-label={r.refreshTree}
            className={HEADER_ACTION_LABEL_REVEAL}
            disabled={loading}
            onClick={onRefresh}
            size="icon-xs"
            variant="ghost"
          >
            <Codicon name="refresh" size="0.8125rem" spinning={loading} />
          </Button>
        </Tip>
        <Tip label={r.collapseAll}>
          <Button
            aria-label={r.collapseAll}
            className={cn(HEADER_ACTION_CLASS, !canCollapse && 'pointer-events-none opacity-0')}
            disabled={!canCollapse}
            onClick={onCollapseAll}
            size="icon-xs"
            variant="ghost"
          >
            <Codicon name="collapse-all" size="0.8125rem" />
          </Button>
        </Tip>
      </RightSidebarSectionHeader>
      <FileTreeBody
        collapseNonce={collapseNonce}
        cwd={cwd}
        data={data}
        error={error}
        loading={loading}
        onActivateFile={onActivateFile}
        onActivateFolder={onActivateFolder}
        onLoadChildren={onLoadChildren}
        onNodeOpenChange={onNodeOpenChange}
        onPreviewFile={onPreviewFile}
        onRetry={onRefresh}
        openState={openState}
        searchTerm={searchTerm}
        selectedPath={selectedPath}
        visible={visible}
      />
    </div>
  )
}

export function RightSidebarSectionHeader({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('group/project-header flex h-7 shrink-0 items-center px-2.5', className)} {...props}>
      {children}
    </div>
  )
}

interface FileTreeBodyProps {
  collapseNonce: number
  cwd: string
  data: ReturnType<typeof useProjectTree>['data']
  error: string | null
  loading: boolean
  onActivateFile: (path: string) => void
  onActivateFolder: (path: string) => void
  onLoadChildren: (id: string) => void | Promise<void>
  onNodeOpenChange: (id: string, open: boolean) => void
  onPreviewFile?: (path: string) => void
  /** Force-reload the root. The hook also auto-retries while errored, so this
   *  is the impatient-user path. */
  onRetry?: () => void
  searchTerm?: string
  selectedPath?: string
  visible?: boolean
  openState: ReturnType<typeof useProjectTree>['openState']
}

function FileTreeBody({
  collapseNonce,
  cwd,
  data,
  error,
  loading,
  onActivateFile,
  onActivateFolder,
  onLoadChildren,
  onNodeOpenChange,
  onPreviewFile,
  onRetry,
  openState,
  searchTerm,
  selectedPath,
  visible
}: FileTreeBodyProps) {
  const { t } = useI18n()
  const r = t.rightSidebar
  // Stay blank for a beat, then skeleton — so a fast project switch doesn't
  // flash a jarring loading state.
  const showSkeleton = useDelayedTrue(loading && data.length === 0)

  if (!cwd) {
    return <EmptyState body={r.noProjectBody} title={r.noProjectTitle} />
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <EmptyState body={r.unreadableBody(error)} title={r.unreadableTitle} />
        {onRetry && (
          <button
            className="text-[0.68rem] font-medium text-muted-foreground transition hover:text-foreground"
            onClick={onRetry}
            type="button"
          >
            {r.tryAgain}
          </button>
        )}
      </div>
    )
  }

  if (loading && data.length === 0) {
    return showSkeleton ? <FileTreeLoadingState /> : <div className="min-h-0 flex-1" />
  }

  if (data.length === 0 || (searchTerm && !hasTreeMatch(data, searchTerm))) {
    return (
      <EmptyState body={searchTerm ? r.noMatchingFiles : r.emptyBody} title={searchTerm ? undefined : r.emptyTitle} />
    )
  }

  return (
    <ErrorBoundary
      fallback={({ reset }) => (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <EmptyState body={r.treeErrorBody} title={r.treeErrorTitle} />
          <button
            className="text-[0.68rem] font-medium text-muted-foreground transition hover:text-foreground"
            onClick={reset}
            type="button"
          >
            {r.tryAgain}
          </button>
        </div>
      )}
      key={cwd}
      label="file-tree"
    >
      <ProjectTree
        collapseNonce={collapseNonce}
        cwd={cwd}
        data={data}
        onActivateFile={onActivateFile}
        onActivateFolder={onActivateFolder}
        onLoadChildren={onLoadChildren}
        onNodeOpenChange={onNodeOpenChange}
        onPreviewFile={onPreviewFile}
        openState={openState}
        searchTerm={searchTerm}
        selectedPath={selectedPath}
        visible={visible}
      />
    </ErrorBoundary>
  )
}

function FileTreeLoadingState() {
  const { t } = useI18n()

  return (
    <div aria-label={t.rightSidebar.loadingTree} className="min-h-0 flex-1" role="status">
      <TreeSkeleton />
    </div>
  )
}

// Terse pane empty state ("No files" / "No diffs"): the panel label itself —
// same uppercase/tracking + dither dot — just muted instead of theme-primary,
// centered. Shared by the file tree and review panes so both read identically.
export function PaneEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4">
      <SidebarPanelLabel className="pl-0 text-(--ui-text-quaternary)">{label}</SidebarPanelLabel>
    </div>
  )
}

// Richer empty/error state (title + body) for the file tree's read failures.
export function EmptyState({ body, title }: { body: string; title?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
      {title && (
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground/75">{title}</div>
      )}
      <div className="text-[0.68rem] leading-relaxed text-muted-foreground/65">{body}</div>
    </div>
  )
}
