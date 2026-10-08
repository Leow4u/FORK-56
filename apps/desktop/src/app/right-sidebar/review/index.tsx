import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { TreeSkeleton } from '@/components/chat/skeletons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SearchField } from '@/components/ui/search-field'
import { useDelayedTrue } from '@/hooks/use-delayed-true'
import { useI18n } from '@/i18n'
import { desktopFsCacheKey } from '@/lib/desktop-fs'
import { displayPath } from '@/lib/display-path'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import {
  $reviewError,
  $reviewFiles,
  $reviewIsRepo,
  $reviewLoading,
  $reviewMissingPath,
  $reviewRevertTarget,
  $reviewScopeCwd,
  $reviewSelectedPath,
  $reviewTreeVisible,
  $reviewTruncated,
  cancelRevert,
  confirmRevert,
  refreshReview
} from '@/store/review'
import { $connection, $currentCwd } from '@/store/session'

import { ReviewFilePanel } from './file-panel'
import { ReviewFileTree } from './file-tree'
import { ReviewShipBar } from './ship-bar'
import { ReviewToolbar } from './toolbar'

export function ReviewPane() {
  const { t } = useI18n()
  const scopeCwd = useStore($reviewScopeCwd)
  const currentCwd = useStore($currentCwd)
  const connection = useStore($connection)
  const cwd = scopeCwd?.trim() || currentCwd.trim()

  return (
    <aside
      aria-label={t.statusStack.coding.review}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground"
      data-review-workspace=""
    >
      <ReviewToolbar cwd={cwd} key={`toolbar:${desktopFsCacheKey(connection)}:${cwd}`} />
      <ReviewBody key={`body:${desktopFsCacheKey(connection)}:${cwd}`} />
      <ReviewShipBar />
      <RevertConfirmation />
    </aside>
  )
}

function ReviewBody() {
  const { t } = useI18n()
  const c = t.statusStack.coding
  const files = useStore($reviewFiles)
  const loading = useStore($reviewLoading)
  const isRepo = useStore($reviewIsRepo)
  const error = useStore($reviewError)
  const missingPath = useStore($reviewMissingPath)
  const selectedPath = useStore($reviewSelectedPath)
  const treeVisible = useStore($reviewTreeVisible)
  const truncated = useStore($reviewTruncated)
  const [query, setQuery] = useState('')
  const skeleton = useDelayedTrue(loading && files.length === 0)
  const selectedFile = files.find(file => file.path === selectedPath)
  const hasFiles = files.length > 0

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-review-reader="">
        {error ? (
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4">
            <ErrorState
              description={<p className="break-words text-xs text-muted-foreground">{error}</p>}
              title={<p className="text-sm font-medium">{c.reviewError}</p>}
            >
              <Button onClick={() => void refreshReview()} size="sm" variant="secondary">
                {t.rightSidebar.tryAgain}
              </Button>
            </ErrorState>
          </div>
        ) : selectedFile ? (
          <ReviewFilePanel file={selectedFile} key={selectedFile.path} />
        ) : loading ? (
          skeleton ? (
            <TreeSkeleton />
          ) : (
            <div className="min-h-0 flex-1" />
          )
        ) : !isRepo ? (
          <EmptyState className="flex-1 px-4" description={c.noRepositoryBody} title={c.noRepository} />
        ) : missingPath ? (
          <EmptyState className="flex-1 px-4" description={displayPath(missingPath)} title={c.fileChangedSinceReview} />
        ) : (
          <EmptyState className="flex-1 px-4" title={hasFiles ? c.selectChangedFile : c.cleanScope} />
        )}
      </div>
      <aside
        aria-label={t.rightSidebar.aria}
        className={cn(
          'flex w-[38%] max-w-60 shrink-0 flex-col border-l border-(--ui-stroke-tertiary)',
          !treeVisible && 'hidden'
        )}
      >
        {(hasFiles || query) && (
          <div className="px-2 py-2">
            <SearchField
              aria-label={t.rightSidebar.filterFiles}
              containerClassName="w-full"
              onChange={setQuery}
              placeholder={t.rightSidebar.filterFiles}
              recede={false}
              shape="pill"
              value={query}
            />
          </div>
        )}
        {truncated && (
          <p className="px-3 pb-2 text-xs text-muted-foreground" role="status">
            {c.partialListing}
          </p>
        )}
        <ReviewFileTree query={query} />
      </aside>
    </div>
  )
}

function RevertConfirmation() {
  const { t } = useI18n()
  const c = t.statusStack.coding
  const target = useStore($reviewRevertTarget)
  const all = target?.path == null

  return (
    <Dialog onOpenChange={open => !open && cancelRevert()} open={target !== undefined}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{all ? c.revertAll : c.revert}</DialogTitle>
          <DialogDescription>
            {all ? c.revertAllConfirm : c.revertConfirm}
            {!all && target?.path && (
              <span
                className="mt-2 block truncate font-mono text-xs text-muted-foreground"
                title={displayPath(target.path)}
              >
                {displayPath(target.path)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={cancelRevert} variant="ghost">
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => void confirmRevert().catch(error => notifyError(error, c.revert))}
            variant="destructive"
          >
            {all ? c.revertAll : c.revert}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
