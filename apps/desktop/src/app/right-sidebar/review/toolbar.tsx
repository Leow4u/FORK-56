import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DiffCount } from '@/components/ui/diff-count'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSearch,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import type { Work4YouGitBaseBranch } from '@/global'
import { useI18n } from '@/i18n'
import { desktopFsCacheKey } from '@/lib/desktop-fs'
import { desktopGit } from '@/lib/desktop-git'
import { displayPath } from '@/lib/display-path'
import { repoStatusForCwd } from '@/store/coding-status'
import { notifyError } from '@/store/notifications'
import {
  $reviewBaseRef,
  $reviewDirectoryPath,
  $reviewError,
  $reviewFiles,
  $reviewFullContext,
  $reviewIsRepo,
  $reviewLoading,
  $reviewRepoRoot,
  $reviewResolvedBaseRef,
  $reviewScope,
  $reviewScopesSupported,
  $reviewTreeMode,
  $reviewTreeVisible,
  refreshReview,
  requestRevert,
  selectReviewDirectory,
  setReviewBaseRef,
  setReviewFullContext,
  setReviewScope,
  stageReviewFile,
  toggleReviewTreeMode,
  toggleReviewTreeVisible
} from '@/store/review'

interface ReviewToolbarProps {
  cwd: string
}

export function ReviewToolbar({ cwd }: ReviewToolbarProps) {
  const { t } = useI18n()
  const c = t.statusStack.coding
  const scope = useStore($reviewScope)
  const scopesSupported = useStore($reviewScopesSupported)
  const base = useStore($reviewBaseRef)
  const resolvedBase = useStore($reviewResolvedBaseRef)
  const root = useStore($reviewRepoRoot) || cwd
  const files = useStore($reviewFiles)
  const loading = useStore($reviewLoading)
  const isRepo = useStore($reviewIsRepo)
  const error = useStore($reviewError)
  const treeVisible = useStore($reviewTreeVisible)
  const treeMode = useStore($reviewTreeMode)
  const fullContext = useStore($reviewFullContext)
  const directory = useStore($reviewDirectoryPath)
  const repo = useStore(repoStatusForCwd(cwd))

  const scopeLabels = {
    uncommitted: c.uncommitted,
    unstaged: c.unstaged,
    staged: c.staged,
    branch: c.branchComparison
  }

  const added = files.reduce((sum, file) => sum + file.added, 0)
  const removed = files.reduce((sum, file) => sum + file.removed, 0)
  const directories = files.filter(file => file.kind === 'directory').length
  const canMutate = scope !== 'branch' && isRepo && !loading && !error && files.length > 0

  return (
    <div className="shrink-0 border-b border-(--ui-stroke-tertiary)" data-suppress-pane-reveal-side="">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5">
        <DropdownMenu>
          <Tip label={scopesSupported ? null : c.runtimeUpdateForScopes}>
            <span>
              <DropdownMenuTrigger asChild>
                <Button aria-label={c.reviewScope} disabled={!isRepo || !scopesSupported} size="xs" variant="chip">
                  {scopeLabels[scope]}
                  <Codicon name="chevron-down" />
                  <DiffCount added={added} removed={removed} />
                </Button>
              </DropdownMenuTrigger>
            </span>
          </Tip>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup onValueChange={value => setReviewScope(value as typeof scope)} value={scope}>
              {Object.entries(scopeLabels).map(([value, label]) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {scope === 'branch' && (
          <div className="flex min-w-0 max-w-full items-center gap-1 text-xs text-muted-foreground">
            <span className="max-w-36 truncate" title={repo?.branch ?? undefined}>
              {repo?.branch ?? 'HEAD'}
            </span>
            <Codicon name="arrow-right" />
            <ComparisonBase cwd={cwd} key={cwd} value={base ?? resolvedBase} />
          </div>
        )}
        {directories > 0 && <span className="text-xs text-muted-foreground">{c.directoryCount(directories)}</span>}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={c.reviewOptions} size="icon-xs" variant="ghost">
                <Codicon name="ellipsis" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!scopesSupported && (
                <DropdownMenuLabel className="max-w-64 whitespace-normal font-normal">
                  {c.runtimeUpdateForScopes}
                </DropdownMenuLabel>
              )}
              <DropdownMenuCheckboxItem
                checked={fullContext}
                disabled={!scopesSupported}
                onCheckedChange={setReviewFullContext}
              >
                {c.showFullContext}
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem onSelect={toggleReviewTreeMode}>
                {treeMode === 'tree' ? c.viewAsList : c.viewAsTree}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!canMutate}
                onSelect={() => void stageReviewFile(null).catch(error => notifyError(error, c.stageAll))}
              >
                <Codicon name="add" />
                {c.stageAll}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMutate} onSelect={() => requestRevert(null)} variant="destructive">
                <Codicon name="discard" />
                {c.revertAll}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tip label={t.rightSidebar.refreshTree}>
            <Button
              aria-label={t.rightSidebar.refreshTree}
              onClick={() => void refreshReview()}
              size="icon-xs"
              variant="ghost"
            >
              <Codicon name="refresh" spinning={loading} />
            </Button>
          </Tip>
          <Tip label={treeVisible ? t.rightSidebar.hideFileTree : t.rightSidebar.showFileTree}>
            <Button
              aria-label={treeVisible ? t.rightSidebar.hideFileTree : t.rightSidebar.showFileTree}
              aria-pressed={treeVisible}
              onClick={toggleReviewTreeVisible}
              size="icon-xs"
              variant={treeVisible ? 'secondary' : 'ghost'}
            >
              <Codicon name="files" />
            </Button>
          </Tip>
        </div>
      </div>
      {cwd && isRepo && (
        <div className="flex min-w-0 items-center gap-1.5 px-3 pb-2 text-xs text-muted-foreground">
          {directory && (
            <Tip label={c.backToChanges}>
              <Button
                aria-label={c.backToChanges}
                onClick={() => void selectReviewDirectory(null)}
                size="icon-xs"
                variant="ghost"
              >
                <Codicon name="arrow-left" />
              </Button>
            </Tip>
          )}
          <Codicon name={directory ? 'folder-opened' : 'git-branch'} />
          <span className="shrink-0">{repo?.branch ?? 'HEAD'}</span>
          <span className="min-w-0 truncate" title={displayPath(directory ? `${root}/${directory}` : root)}>
            {displayPath(directory ? `${root}/${directory}` : root)}
          </span>
        </div>
      )}
    </div>
  )
}

function ComparisonBase({ cwd, value }: { cwd: string; value: string | null }) {
  const { t } = useI18n()
  const c = t.statusStack.coding
  const [branches, setBranches] = useState<Work4YouGitBaseBranch[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const generation = useRef(0)

  useEffect(
    () => () => {
      generation.current += 1
    },
    []
  )

  const load = async () => {
    const current = ++generation.current
    const connection = desktopFsCacheKey()
    const live = () => generation.current === current && desktopFsCacheKey() === connection
    setLoading(true)

    try {
      const result = await desktopGit()?.baseBranchList?.(cwd)

      if (live()) {
        setBranches(result ?? [])
      }
    } catch (error) {
      if (live()) {
        notifyError(error, c.comparisonBase)
      }
    } finally {
      if (live()) {
        setLoading(false)
      }
    }
  }

  return (
    <DropdownMenu
      onOpenChange={open => {
        if (open) {
          setQuery('')
          void load()
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button aria-label={c.comparisonBase} className="min-w-0 max-w-48" size="xs" variant="chip">
          <span className="truncate" title={value ?? undefined}>
            {value || c.compareWith}
          </span>
          <Codicon name="chevron-down" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuSearch
          aria-label={t.sidebar.projects.baseBranchPlaceholder}
          onValueChange={setQuery}
          placeholder={t.sidebar.projects.baseBranchPlaceholder}
          value={query}
        />
        {loading && (
          <div className="px-2 py-1">
            <Codicon name="loading" spinning />
          </div>
        )}
        {!loading &&
          branches.filter(branch => branch.name.toLowerCase().includes(query.toLowerCase())).length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">{t.sidebar.projects.baseBranchNone}</div>
          )}
        <DropdownMenuRadioGroup onValueChange={setReviewBaseRef} value={value ?? ''}>
          {branches
            .filter(branch => branch.name.toLowerCase().includes(query.toLowerCase()))
            .map(branch => (
              <DropdownMenuRadioItem key={branch.name} value={branch.name}>
                <Codicon name={branch.isRemote ? 'repo' : 'git-branch'} />
                <span className="truncate">{branch.name}</span>
              </DropdownMenuRadioItem>
            ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
