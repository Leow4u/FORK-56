import { useStore } from '@nanostores/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, motion } from 'motion/react'
import { type CSSProperties, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { DiffCount } from '@/components/ui/diff-count'
import { FileTypeIcon } from '@/components/ui/file-type-icon'
import { Tip } from '@/components/ui/tooltip'
import type { Work4YouReviewFile } from '@/global'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { displayPath } from '@/lib/display-path'
import { cn } from '@/lib/utils'
import {
  $renamingPath,
  copyFilePath,
  downloadRemoteFile,
  revealFile,
  shouldOfferRemoteFileDownload,
  toRelativePath
} from '@/store/file-actions'
import { $sidebarWorkspaceNodeOpen, revealFileInTree, toggleWorkspaceNodeCollapsed } from '@/store/layout'
import { notifyError } from '@/store/notifications'
import {
  $reviewError,
  $reviewFiles,
  $reviewLoading,
  $reviewOpen,
  $reviewRepoRoot,
  $reviewScope,
  $reviewScopeCwd,
  $reviewSelectedPath,
  $reviewTreeMode,
  requestRevert,
  selectReviewDirectory,
  selectReviewFile,
  stageReviewFile,
  unstageReviewFile
} from '@/store/review'
import { $currentCwd } from '@/store/session'

import { pickRevealLabel } from '../file-actions'

import { openReviewFile, reviewAbsolutePath } from './file-actions'
import {
  buildReviewFlatList,
  buildReviewTree,
  countAllNodes,
  flattenReviewRows,
  type ReviewFlatRow,
  type ReviewTreeNode
} from './tree-data'

const INDENT = 12

// File type and Git status are independent identities: keep the familiar file
// icon, and tint the Git status letter at the trailing edge.
const STATUS_TONE: Record<string, string> = {
  A: 'text-(--ui-green)',
  C: 'text-(--ui-green)',
  D: 'text-(--ui-red)',
  M: 'text-(--ui-yellow)',
  R: 'text-(--ui-blue)',
  U: 'text-(--ui-red)',
  '?': 'text-muted-foreground'
}

// Fast, layout-aware row: `layout` slides siblings when one is inserted/removed
// (a new file at index N pushes the rest down), AnimatePresence fades the
// enter/exit. A tight, near-critically-damped spring keeps it crisp (quick
// settle, no bounce) so adds/deletes read as snappy, not floaty.
const ROW_TRANSITION = { type: 'spring', stiffness: 1100, damping: 48, mass: 0.32 } as const

// Instant (no animation) — used while the pane is settling open so the initial
// batch of rows doesn't fly in.
const ROW_INSTANT = { duration: 0 } as const

// Past this many visible rows, drop the animated list and virtualize: only the
// rows in the viewport (plus a small overscan) are mounted, so a folder with
// tens of thousands of untracked files no longer balloons the renderer into
// hundreds of thousands of DOM nodes.
const HEAVY_LIST_CAP = 60

// Uniform row height (h-6 = 1.5rem). Every review row is this exact height, so
// the virtualizer's size estimate is exact and per-row measurement just keeps
// it honest under app zoom.
const ROW_HEIGHT = 24

// Rows mounted above and below the viewport while scrolling.
const OVERSCAN_ROWS = 12

export function ReviewFileTree({ query = '' }: { query?: string }) {
  const { t } = useI18n()
  const files = useStore($reviewFiles)
  const open = useStore($reviewOpen)
  const loading = useStore($reviewLoading)
  const mode = useStore($reviewTreeMode)

  // Search the loaded changed paths only. A flat filtered result keeps matches
  // visible even when their ancestor folders were collapsed before searching.
  const tree = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const filtered = needle ? files.filter(file => file.path.toLocaleLowerCase().includes(needle)) : files

    return mode === 'tree' && !needle ? buildReviewTree(filtered) : buildReviewFlatList(filtered)
  }, [files, mode, query])

  // Heavy is decided by the TOTAL node count, not the top-level row count: the
  // classic blow-up is ONE folder holding tens of thousands of untracked files,
  // which is a single top-level node but must still take the virtualized path.
  const heavy = useMemo(() => countAllNodes(tree) > HEAVY_LIST_CAP, [tree])

  // Visible rows for the virtualized path. Heavy trees start fully collapsed
  // (folders default closed) so even the first mount is a handful of rows; the
  // user expands a folder to reveal its children, still virtualized.
  const nodeOpen = useStore($sidebarWorkspaceNodeOpen)

  const rows = useMemo(() => {
    if (!heavy) {
      return []
    }

    return flattenReviewRows(tree, id => nodeOpen[`review:${id}`] ?? false)
  }, [heavy, nodeOpen, tree])

  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // The Pane keeps this tree mounted while collapsed, so opening it doesn't
  // remount (AnimatePresence `initial={false}` can't help). The first refresh
  // after opening can also surface a batch of edits made while it was closed.
  // Suppress row enter/exit until that first post-open refresh settles; real
  // edits made while the pane stays open then animate normally.
  const [animate, setAnimate] = useState(false)
  const armed = useRef(false)

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    if (!open) {
      armed.current = false
      setAnimate(false)
    }
  }, [open])

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    if (open && !loading && !armed.current) {
      armed.current = true
      const id = requestAnimationFrame(() => setAnimate(true))

      return () => cancelAnimationFrame(id)
    }
  }, [open, loading])

  return (
    <div
      aria-label={t.rightSidebar.aria}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 py-1"
      data-suppress-pane-reveal-side=""
      ref={scrollerRef}
      role="tree"
    >
      {query.trim() && tree.length === 0 ? (
        <div className="px-2 py-4 text-xs text-muted-foreground">{t.rightSidebar.noMatchingFiles}</div>
      ) : heavy ? (
        <VirtualizedReviewList rows={rows} scrollRef={scrollerRef} />
      ) : (
        <ReviewNodeList animate={animate} depth={0} nodes={tree} />
      )}
    </div>
  )
}

function ReviewNodeList({ animate, depth, nodes }: { animate: boolean; depth: number; nodes: ReviewTreeNode[] }) {
  return (
    <AnimatePresence initial={false}>
      {nodes.map(node => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          initial={animate ? { opacity: 0, y: -4 } : false}
          key={node.id}
          layout="position"
          transition={animate ? ROW_TRANSITION : ROW_INSTANT}
        >
          {node.isDir ? (
            <ReviewDirRow animate={animate} depth={depth} node={node} />
          ) : (
            <ReviewFileRow depth={depth} node={node} />
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

// Virtualized heavy list: the scroller mounts only the rows intersecting the
// viewport (plus overscan), so a folder with tens of thousands of changed
// files never materializes every row in the DOM. Rows are absolutely
// positioned inside a spacer sized to the full list, which keeps the
// scrollbar honest. Folders render as `leaf` rows — their children come from
// the flattened row list, not inline — so expanding one just grows the list.
function VirtualizedReviewList({
  rows,
  scrollRef
}: {
  rows: ReviewFlatRow[]
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: index => rows[index]?.node.id ?? index,
    getScrollElement: () => scrollRef.current,
    // jsdom-friendly default; the real rect takes over on first observe.
    initialRect: { height: 600, width: 240 },
    overscan: OVERSCAN_ROWS
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div className="relative" style={{ height: totalSize }}>
      {virtualItems.map(virtualItem => {
        const row = rows[virtualItem.index]

        if (!row) {
          return null
        }

        return (
          <div
            data-index={virtualItem.index}
            key={row.node.id}
            ref={virtualizer.measureElement}
            style={{
              left: 0,
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualItem.start}px)`,
              width: '100%'
            }}
          >
            {row.node.isDir ? (
              <ReviewDirRow animate={false} defaultOpen={false} depth={row.depth} leaf node={row.node} />
            ) : (
              <ReviewFileRow depth={row.depth} node={row.node} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Depth-0 rows align their icon to the panel header's dither glyph: the tree
// body has px-1 (4px) and the header glyph sits at px-2.5 (10px) + the label's
// pl-2 (8px) = 18px, so the base inset is 18 − 4 = 14px.
const ROW_BASE_INSET = 14

function rowStyle(depth: number): CSSProperties {
  return { paddingLeft: `${depth * INDENT + ROW_BASE_INSET}px` }
}

function ReviewDirRow({
  animate,
  defaultOpen = true,
  depth,
  leaf = false,
  node
}: {
  animate: boolean
  defaultOpen?: boolean
  depth: number
  /** Virtualized rows render their children from the flattened row list, not inline. */
  leaf?: boolean
  node: ReviewTreeNode
}) {
  const nodeOpen = useStore($sidebarWorkspaceNodeOpen)
  const id = `review:${node.id}`
  const open = nodeOpen[id] ?? defaultOpen
  const toggle = () => toggleWorkspaceNodeCollapsed(id, defaultOpen)

  return (
    <>
      <div
        className="group/review-row row-hover flex h-6 select-none items-center gap-1.5 rounded-md pr-1.5 text-xs text-(--ui-text-secondary) hover:text-foreground"
        onClick={toggle}
        style={rowStyle(depth)}
      >
        <Codicon
          className="shrink-0 text-(--ui-text-tertiary)"
          name={open ? 'folder-opened' : 'folder'}
          size="0.8rem"
        />
        <span className="min-w-0 flex-1 truncate" title={node.name}>
          {node.name}
        </span>
        {!open && <DiffCount added={node.added} className="text-[0.64rem] leading-4" removed={node.removed} />}
      </div>
      {!leaf && open && node.children && <ReviewNodeList animate={animate} depth={depth + 1} nodes={node.children} />}
    </>
  )
}

function ReviewFileRow({ node, depth }: { node: ReviewTreeNode; depth: number }) {
  const { t } = useI18n()
  const c = t.statusStack.coding
  const selectedPath = useStore($reviewSelectedPath)
  const scope = useStore($reviewScope)
  const loading = useStore($reviewLoading)
  const error = useStore($reviewError)
  const file = node.file!
  const selected = file.path === selectedPath
  const statusTone = STATUS_TONE[file.status] ?? STATUS_TONE.M
  const directory = file.kind === 'directory'
  const dragPath = reviewAbsolutePath(file.path)
  // Reactive mirror of reviewRepoCwd(): the pinned scope wins, else the
  // active session's cwd (subscribing to both keeps the row live either way).
  const scopeCwd = useStore($reviewScopeCwd)
  const repoRoot = useStore($reviewRepoRoot)
  const activeCwd = useStore($currentCwd)
  const cwd = repoRoot || scopeCwd?.trim() || activeCwd

  // Single-click shows the inline diff; double-click opens the file in the main
  // preview pane (matching the file browser). They're mutually exclusive: defer
  // the single-click select briefly so a double-click can cancel it, otherwise a
  // double-click would fire BOTH (inline diff + main preview = two previews).
  const clickTimer = useRef<null | ReturnType<typeof setTimeout>>(null)

  useEffect(
    () => () => {
      if (clickTimer.current != null) {
        clearTimeout(clickTimer.current)
      }
    },
    []
  )

  const handleClick = () => {
    // A file-browser rename of the same path is active → ignore the fall-through
    // click so it doesn't open the diff / steal focus from that editor.
    if ($renamingPath.get() === dragPath) {
      return
    }

    if (clickTimer.current != null) {
      clearTimeout(clickTimer.current)
    }

    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      void selectReviewFile(file)
    }, 200)
  }

  const openInPreview = () => {
    if (file.status === 'D') {
      return
    }

    void openReviewFile(file.path).catch(error => notifyError(error, t.rightSidebar.previewUnavailable))
  }

  const handleDoubleClick = () => {
    if (clickTimer.current != null) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }

    if (directory) {
      void selectReviewDirectory(file.path)
    } else {
      openInPreview()
    }
  }

  return (
    <ReviewFileContextMenu
      cwd={cwd}
      dragPath={dragPath}
      file={file}
      onOpenChanges={() => void selectReviewFile(file)}
      onOpenFile={openInPreview}
    >
      <div
        aria-label={node.name}
        aria-selected={selected}
        className={cn(
          'group/review-row row-hover flex h-6 select-none items-center gap-1.5 rounded-md pr-1.5 text-xs text-(--ui-text-secondary) hover:text-foreground',
          selected && 'bg-(--ui-row-active-background) text-foreground'
        )}
        draggable
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onDragStart={event => {
          event.dataTransfer.effectAllowed = 'copy'
          event.dataTransfer.setData(
            'application/x-work4you-paths',
            JSON.stringify([{ isDirectory: directory, path: dragPath }])
          )
          event.dataTransfer.setData('text/plain', dragPath)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void selectReviewFile(file)
          }
        }}
        role="treeitem"
        style={rowStyle(depth)}
        tabIndex={0}
        title={displayPath(dragPath)}
      >
        {directory ? <Codicon name="folder" size="0.8rem" /> : <FileTypeIcon path={file.path} size="0.8rem" />}
        {/* Dir collapses first (huge shrink); the name only ellipsizes once the
            dir is gone — either way neither runs into the diff count. */}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="min-w-0 shrink truncate" title={node.name}>
            {node.name}
          </span>
          {node.dir && (
            <span className="min-w-0 shrink-[9999] truncate text-[0.68rem] text-(--ui-text-tertiary)" title={node.dir}>
              {node.dir}
            </span>
          )}
        </span>

        {scope !== 'branch' && (
          <span className="hidden shrink-0 items-center gap-0.5 group-hover/review-row:flex group-focus-within/review-row:flex">
            <Tip label={file.unstaged || !file.staged ? c.stage : c.unstage}>
              <Button
                aria-label={file.unstaged || !file.staged ? c.stage : c.unstage}
                className="size-4 rounded text-muted-foreground/70 hover:text-foreground"
                disabled={loading || Boolean(error)}
                onClick={event => {
                  event.stopPropagation()
                  void (
                    file.unstaged || !file.staged ? stageReviewFile(file.path) : unstageReviewFile(file.path)
                  ).catch(error => notifyError(error, c.stage))
                }}
                size="icon-xs"
                variant="ghost"
              >
                <Codicon name={file.unstaged || !file.staged ? 'add' : 'remove'} size="0.7rem" />
              </Button>
            </Tip>
            <Tip label={c.revert}>
              <Button
                aria-label={c.revert}
                className="size-4 rounded text-muted-foreground/70 hover:text-(--ui-red)"
                disabled={loading || Boolean(error)}
                onClick={event => {
                  event.stopPropagation()
                  requestRevert(file.path)
                }}
                size="icon-xs"
                variant="ghost"
              >
                <Codicon name="discard" size="0.7rem" />
              </Button>
            </Tip>
          </span>
        )}

        {!directory && (
          <DiffCount
            added={node.added}
            className={cn(
              'text-[0.64rem] leading-4',
              scope !== 'branch' && 'group-hover/review-row:hidden group-focus-within/review-row:hidden'
            )}
            removed={node.removed}
          />
        )}
        <span className={cn('shrink-0 text-[0.64rem]', statusTone)}>{file.status}</span>
        {file.staged && (
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--ui-green)/70" title={c.staged} />
        )}
      </div>
    </ReviewFileContextMenu>
  )
}

// Git-specific right-click menu for a changed file (VS Code's SCM menu shape):
// open changes / open file, stage·unstage, discard, then reveal / copy path. No
// rename or delete here — those belong to the file browser; this tree just
// reflects the working-tree state.
function ReviewFileContextMenu({
  children,
  cwd,
  dragPath,
  file,
  onOpenChanges,
  onOpenFile
}: {
  children: ReactNode
  cwd: null | string
  dragPath: string
  file: Work4YouReviewFile
  onOpenChanges: () => void
  onOpenFile: () => void
}) {
  const { t } = useI18n()
  const c = t.statusStack.coding
  const m = t.fileMenu
  const localFs = !isDesktopFsRemoteMode()
  const scope = useStore($reviewScope)
  const loading = useStore($reviewLoading)
  const error = useStore($reviewError)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onOpenChanges}>{c.openChanges}</ContextMenuItem>
        <ContextMenuItem disabled={file.status === 'D'} onSelect={onOpenFile}>
          {c.openFile}
        </ContextMenuItem>
        {scope !== 'branch' && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={loading || Boolean(error) || !(file.unstaged ?? !file.staged)}
              onSelect={() => void stageReviewFile(file.path).catch(error => notifyError(error, c.stage))}
            >
              {c.stage}
            </ContextMenuItem>
            <ContextMenuItem
              disabled={loading || Boolean(error) || !file.staged}
              onSelect={() => void unstageReviewFile(file.path).catch(error => notifyError(error, c.unstage))}
            >
              {c.unstage}
            </ContextMenuItem>
            <ContextMenuItem
              disabled={loading || Boolean(error)}
              onSelect={() => requestRevert(file.path)}
              variant="destructive"
            >
              {c.revert}
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => revealFileInTree(dragPath)}>{m.revealInSidebar}</ContextMenuItem>
        {localFs && (
          <ContextMenuItem onSelect={() => void revealFile(dragPath)}>
            {pickRevealLabel(m.revealFinder, m.revealExplorer, m.revealFileManager)}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void copyFilePath(dragPath)}>{m.copyPath}</ContextMenuItem>
        {cwd && (
          <ContextMenuItem onSelect={() => void copyFilePath(toRelativePath(dragPath, cwd))}>
            {m.copyRelativePath}
          </ContextMenuItem>
        )}
        {shouldOfferRemoteFileDownload(file.kind === 'directory') && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => void downloadRemoteFile(dragPath)}>{m.download}</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
