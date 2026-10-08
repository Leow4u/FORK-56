import { atom, computed } from 'nanostores'

import { isPaneVisible, revealTreePane } from '@/components/pane-shell/tree/store'
import type { Work4YouReviewFile, Work4YouReviewScope, Work4YouReviewShipInfo } from '@/global'
import { desktopFsCacheKey } from '@/lib/desktop-fs'
import { desktopGit } from '@/lib/desktop-git'
import { isExcludedPath } from '@/lib/excluded-paths'
import { requestOneShot } from '@/lib/oneshot'
import { Codecs, persistentAtom } from '@/lib/persisted'

import { refreshRepoStatus, repoStatusForCwd } from './coding-status'
import { stampSessionPrBranch } from './pull-requests'
import { $busy, $connection, $currentCwd, $selectedStoredSessionId, $sessions } from './session'
import { $workspaceChangeTick } from './workspace-events'

// State for the review pane: the working-tree changed-file list, the selected
// file's diff, and the git mutations (stage / unstage / revert). The active
// session's cwd is the repo; the pane reads git as the source of truth, the
// same bounded "re-probe on structural edges" model as the coding rail.
//
// Must match the review <Pane id> in desktop-controller (the forced-reveal
// event is addressed by pane id).
export const REVIEW_PANE_ID = 'review'

const OPEN_KEY = 'work4you.desktop.reviewOpen'
const COMMIT_DEFAULT_KEY = 'work4you.desktop.reviewCommitDefault'
const TREE_MODE_KEY = 'work4you.desktop.reviewTreeMode'
const SELECTED_KEY = 'work4you.desktop.reviewSelectedPath'
const REVIEW_REFRESH_DEBOUNCE_MS = 100
const SHIP_INFO_STALE_MS = 30_000

// Persisted so the pane stays open across reloads (like the other rail panes).
export const $reviewOpen = persistentAtom(OPEN_KEY, false, Codecs.bool)

// The split-button's remembered default action ('commit' | 'commitPush').
export type CommitAction = 'commit' | 'commitPush'

export const $reviewCommitDefault = persistentAtom<CommitAction>(COMMIT_DEFAULT_KEY, 'commit', {
  decode: raw => (raw === 'commitPush' ? 'commitPush' : 'commit'),
  encode: value => value
})

// Changed-file layout: a flat path list (VS Code's default) or a folder tree.
export type ReviewTreeMode = 'list' | 'tree'

export const $reviewTreeMode = persistentAtom<ReviewTreeMode>(TREE_MODE_KEY, 'tree', {
  decode: raw => (raw === 'list' ? 'list' : 'tree'),
  encode: value => value
})

export function toggleReviewTreeMode(): void {
  $reviewTreeMode.set($reviewTreeMode.get() === 'tree' ? 'list' : 'tree')
}

export const $reviewFiles = atom<Work4YouReviewFile[]>([])
export const $reviewLoading = atom(false)
export type ReviewScope = Exclude<Work4YouReviewScope, 'lastTurn'>
export const $reviewScope = atom<ReviewScope>('uncommitted')
export const $reviewBaseRef = atom<null | string>(null)
export const $reviewResolvedBaseRef = atom<null | string>(null)
export const $reviewRepoRoot = atom<null | string>(null)
export const $reviewError = atom<null | string>(null)
export const $reviewDiffError = atom<null | string>(null)
export const $reviewMissingPath = atom<null | string>(null)
export const $reviewDiffPart = atom<'unstaged' | 'staged'>('unstaged')
export const $reviewDirectoryPath = atom<null | string>(null)
export const $reviewTruncated = atom(false)
export const $reviewTreeVisible = atom(true)
export const $reviewFullContext = atom(false)
// Older remote runtimes lack the scoped-review response contract.
export const $reviewScopesSupported = atom(false)
// Commit eligibility comes from the whole working tree, never the visible scope or filter.
export const $reviewCommitSummary = atom({
  hasStaged: false,
  stagedCount: 0,
  totalCount: 0,
  includesDirectories: false,
  truncated: false
})

export function toggleReviewTreeVisible(): void {
  $reviewTreeVisible.set(!$reviewTreeVisible.get())
}

export function setReviewScope(scope: ReviewScope): void {
  if ($reviewScope.get() === scope) {
    return
  }

  $reviewScope.set(scope)

  // Let Git resolve its default base. The status label may omit the remote prefix.

  $reviewDirectoryPath.set(null)
  clearReviewSelection()
  void refreshReview()
}

export function setReviewBaseRef(ref: string): void {
  $reviewBaseRef.set(ref)
  clearReviewSelection()
  void refreshReview()
}

export async function selectReviewDirectory(path: null | string): Promise<void> {
  $reviewDirectoryPath.set(path)
  clearReviewSelection()
  await refreshReview()
}

export function setReviewFullContext(value: boolean): void {
  $reviewFullContext.set(value)
  const file = $reviewFiles.get().find(item => item.path === $reviewSelectedPath.get())

  if (file) {
    void selectReviewFile(file, true)
  }
}

export function setReviewDiffPart(part: 'unstaged' | 'staged'): void {
  $reviewDiffPart.set(part)
  const file = $reviewFiles.get().find(item => item.path === $reviewSelectedPath.get())

  if (file) {
    void selectReviewFile(file, true)
  }
}

// False when the active session isn't in a local git repo (detached/fresh chat,
// remote backend). Lets the pane say "not a repo" instead of stranding on a
// skeleton or implying a clean repo with "no changes".
export const $reviewIsRepo = atom(true)

// Largest single-file churn (added + removed) in the current diff. Drives the
// per-row data bars: each file's bar is its churn relative to this max, so the
// biggest file fills the row and the rest scale down against it.
export const $reviewMaxChurn = computed($reviewFiles, files =>
  files.reduce((max, file) => Math.max(max, file.added + file.removed), 0)
)
// Persisted so a relaunch restores the file you were diffing (its diff is
// re-fetched in refreshReview once the file is confirmed still changed).
export const $reviewSelectedPath = persistentAtom<null | string>(SELECTED_KEY, null, Codecs.nullableText)
export const $reviewDiff = atom<null | string>(null)
export const $reviewDiffLoading = atom(false)

// Ship state: gh availability + this branch's PR, and a busy flag for the
// commit/push/PR action bar (disables buttons + shows progress).
export const $reviewShipInfo = atom<Work4YouReviewShipInfo>({ ghReady: false, pr: null })
export const $reviewShipBusy = atom(false)

// True while a commit message is being generated (drives the input's spinner).
export const $reviewCommitMsgBusy = atom(false)

// The pane's repo scope. Null = follow the ACTIVE session's cwd (the classic
// behavior). A tile's rail opens the pane pinned to ITS worktree instead —
// tiles can sit in different worktrees than main, and reviewing "the diff I'm
// looking at" must mean that tile's repo, not whatever main happens to be on.
export const $reviewScopeCwd = atom<null | string>(null)
// The composer target that opened the pane. The review pane is a shared
// surface, but its "let the agent ship it" action must return to the session
// whose worktree the user is reviewing, not broadcast to every mounted tile.
export const $reviewScopeTarget = atom('main')

/** The repo the pane is reading right now: its pinned scope, else the active
 *  session's cwd. Exported for pane helpers that join repo-relative paths. */
export const reviewRepoCwd = (): null | string => $reviewScopeCwd.get()?.trim() || $currentCwd.get()?.trim() || null

const repoCwd = reviewRepoCwd

type ReviewBridge = NonNullable<NonNullable<NonNullable<Window['work4youDesktop']>['git']>['review']>
let reviewRefreshSeq = 0
let reviewDiffSeq = 0
let reviewRefreshTimer: ReturnType<typeof setTimeout> | null = null
let shipInfoSeq = 0
let shipInfoLastCheckedAt = 0

// The two things every review op needs: the repo cwd + the IPC bridge. Null when
// either is missing (no session, remote backend), so callers bail in one line.
function reviewCtx(): { cwd: string; review: ReviewBridge } | null {
  const cwd = repoCwd()
  const review = desktopGit()?.review

  return cwd && review ? { cwd, review } : null
}

// ── Reads ────────────────────────────────────────────────────────────────────

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function refreshReview(): Promise<void> {
  const ctx = reviewCtx()
  const seq = ++reviewRefreshSeq
  const connection = desktopFsCacheKey()
  const scope = $reviewScope.get()
  const base = scope === 'branch' ? $reviewBaseRef.get() : null
  const directory = $reviewDirectoryPath.get()

  const live = () =>
    seq === reviewRefreshSeq && repoCwd() === ctx?.cwd && desktopFsCacheKey() === connection && $reviewOpen.get()

  $reviewError.set(null)

  if (!$reviewOpen.get() || !ctx) {
    $reviewFiles.set([])
    $reviewIsRepo.set(Boolean(ctx))
    $reviewCommitSummary.set({
      hasStaged: false,
      stagedCount: 0,
      totalCount: 0,
      includesDirectories: false,
      truncated: false
    })
    $reviewLoading.set(false)
    clearReviewSelection()

    return
  }

  $reviewLoading.set(true)

  try {
    const read = directory ? ctx.review.list(ctx.cwd, scope, base, directory) : ctx.review.list(ctx.cwd, scope, base)

    const [result, working] = await Promise.all([
      read,
      scope === 'uncommitted' && !directory ? read : ctx.review.list(ctx.cwd, 'uncommitted', null)
    ])

    if (!live()) {
      return
    }

    $reviewIsRepo.set(result.state !== 'not-repo')
    $reviewScopesSupported.set(result.state !== undefined)

    if (result.state === 'error') {
      throw new Error(result.error || 'Git review failed')
    }

    if (working.state === 'error') {
      throw new Error(working.error || 'Git status failed')
    }

    $reviewRepoRoot.set(result.repoRoot ?? ctx.cwd)
    $reviewResolvedBaseRef.set(result.base ?? null)
    const stagedCount = working.stagedCount ?? working.files.filter(file => file.staged).length
    $reviewCommitSummary.set({
      hasStaged: stagedCount > 0,
      stagedCount,
      totalCount: working.totalCount ?? working.files.length,
      includesDirectories: working.files.some(file => file.kind === 'directory'),
      truncated: Boolean(working.truncated)
    })
    $reviewTruncated.set(Boolean(result.truncated))
    const files = result.files.filter(file => !isExcludedPath(file.path))
    $reviewFiles.set(files)
    const selected = $reviewSelectedPath.get()
    const selectedFile = files.find(file => file.path === selected)

    if (selectedFile) {
      void selectReviewFile(selectedFile, true)
    } else if (selected) {
      clearReviewSelection()
    } else {
      const firstFile = files.find(file => file.kind !== 'directory' && !file.path.endsWith('/'))

      if (firstFile) {
        void selectReviewFile(firstFile)
      }
    }
  } catch (error) {
    if (live()) {
      $reviewFiles.set([])
      $reviewCommitSummary.set({
        hasStaged: false,
        stagedCount: 0,
        totalCount: 0,
        includesDirectories: false,
        truncated: false
      })
      clearReviewSelection()
      $reviewError.set(errorMessage(error))
    }
  } finally {
    if (live()) {
      $reviewLoading.set(false)
    }
  }
}

function scheduleReviewRefresh(): void {
  if (!$reviewOpen.get()) {
    return
  }

  if (reviewRefreshTimer) {
    clearTimeout(reviewRefreshTimer)
  }

  reviewRefreshTimer = setTimeout(() => {
    reviewRefreshTimer = null
    void refreshReview()
  }, REVIEW_REFRESH_DEBOUNCE_MS)
}

export async function selectReviewFile(file: Work4YouReviewFile, preservePart = false): Promise<void> {
  if (file.kind === 'directory' || file.path.endsWith('/')) {
    await selectReviewDirectory(file.path)

    return
  }

  const previous = $reviewSelectedPath.get()
  const scope = $reviewScope.get()
  const hasUnstaged = file.unstaged ?? !file.staged

  const staged =
    scope === 'staged' ||
    (scope === 'uncommitted' &&
      file.staged &&
      (!hasUnstaged || (preservePart && previous === file.path && $reviewDiffPart.get() === 'staged')))

  $reviewDiffPart.set(staged ? 'staged' : 'unstaged')
  $reviewSelectedPath.set(file.path)
  $reviewMissingPath.set(null)
  $reviewDiff.set(null)
  $reviewDiffError.set(null)
  const ctx = reviewCtx()
  const seq = ++reviewDiffSeq
  const connection = desktopFsCacheKey()

  const live = () =>
    seq === reviewDiffSeq &&
    repoCwd() === ctx?.cwd &&
    desktopFsCacheKey() === connection &&
    $reviewSelectedPath.get() === file.path

  if (!ctx) {
    $reviewDiffLoading.set(false)

    return
  }

  $reviewDiffLoading.set(true)

  try {
    const base = scope === 'branch' ? $reviewBaseRef.get() : null
    const full = $reviewFullContext.get()

    const diff = full
      ? await ctx.review.diff(ctx.cwd, file.path, scope, base, staged, true)
      : await ctx.review.diff(ctx.cwd, file.path, scope, base, staged)

    if (live()) {
      $reviewDiff.set(diff)
    }
  } catch (error) {
    if (live()) {
      $reviewDiffError.set(errorMessage(error))
    }
  } finally {
    if (live()) {
      $reviewDiffLoading.set(false)
    }
  }
}

export function clearReviewSelection(): void {
  reviewDiffSeq += 1
  $reviewSelectedPath.set(null)
  $reviewDiff.set(null)
  $reviewDiffError.set(null)
  $reviewMissingPath.set(null)
  $reviewDiffLoading.set(false)
}

export async function refreshShipInfo(): Promise<void> {
  const ctx = reviewCtx()
  const seq = (shipInfoSeq += 1)
  const connection = desktopFsCacheKey()

  if (!ctx) {
    $reviewShipInfo.set({ ghReady: false, pr: null })

    return
  }

  try {
    const info = await ctx.review.shipInfo(ctx.cwd)

    if (seq === shipInfoSeq && repoCwd() === ctx.cwd && desktopFsCacheKey() === connection) {
      $reviewShipInfo.set(info)
      shipInfoLastCheckedAt = Date.now()
    }
  } catch {
    if (seq === shipInfoSeq && repoCwd() === ctx.cwd && desktopFsCacheKey() === connection) {
      $reviewShipInfo.set({ ghReady: false, pr: null })
      shipInfoLastCheckedAt = Date.now()
    }
  }
}

function refreshShipInfoIfStale(): void {
  if (Date.now() - shipInfoLastCheckedAt > SHIP_INFO_STALE_MS) {
    void refreshShipInfo()
  }
}

/** Open the pane scoped to `scopeCwd` (a tile's worktree), or to the active
 *  session's cwd when null — see `$reviewScopeCwd`. Keep the originating
 *  composer target alongside it for agent-ship actions. */
export function openReview(scopeCwd: null | string = null, scopeTarget = 'main'): void {
  $reviewScopeCwd.set(scopeCwd?.trim() || null)
  $reviewScopeTarget.set(scopeTarget.trim() || 'main')
  $reviewOpen.set(true)
  void refreshReview()
  void refreshShipInfo()
}

export function closeReview(): void {
  reviewRefreshSeq += 1
  $reviewOpen.set(false)
  $reviewLoading.set(false)
  $reviewScopeCwd.set(null)
  $reviewScopeTarget.set('main')
  clearReviewSelection()
}

export function toggleReview(scopeCwd: null | string = null, scopeTarget = 'main'): void {
  // Ask the TREE, not `$reviewOpen`. The store stays true while the pane sits
  // behind a sibling tab in the right column or inside a minimized zone, so a
  // boolean flip spent the press re-asserting a value it already held and ⌘G
  // read as a dead key. `revealReview` fronts and un-minimizes; only close when
  // the diff is genuinely the thing on screen.
  const targetCwd = scopeCwd?.trim() || $currentCwd.get()?.trim() || null

  if (
    isPaneVisible(REVIEW_PANE_ID) &&
    repoCwd() === targetCwd &&
    $reviewScopeTarget.get() === (scopeTarget.trim() || 'main')
  ) {
    closeReview()
  } else {
    revealReview(scopeCwd, scopeTarget)
  }
}

/**
 * Open the review pane and bring it into view. Unlike `toggleReview` this never
 * closes an already-open pane — it's the "take me to the diff" entry point used
 * by the transcript's changed-files card.
 */
export function revealReview(scopeCwd: null | string = null, scopeTarget = 'main'): void {
  const wasOpen = $reviewOpen.get()
  const target = scopeTarget.trim() || 'main'

  if (!wasOpen) {
    openReview(scopeCwd, target)
  } else if (($reviewScopeCwd.get() ?? null) !== (scopeCwd?.trim() || null) || $reviewScopeTarget.get() !== target) {
    // Already open but on another worktree's diff — re-home it. The scope
    // subscription below clears the stale list and re-probes. Keep the
    // originating composer target alongside the cwd for the agent-ship action.
    $reviewScopeCwd.set(scopeCwd?.trim() || null)
    $reviewScopeTarget.set(target)
  }

  revealTreePane(REVIEW_PANE_ID)
}

/** Composer counts and response cards always refer to the current working tree. */
export function revealCurrentReview(scopeCwd: null | string = null, scopeTarget = 'main'): void {
  const reset = $reviewScope.get() !== 'uncommitted' || $reviewDirectoryPath.get() !== null
  $reviewScope.set('uncommitted')
  $reviewDirectoryPath.set(null)

  if (reset) {
    clearReviewSelection()
  }

  revealReview(scopeCwd, scopeTarget)
  void refreshReview()
}

/** The changed file matching a tool-reported path (absolute or repo-relative). */
function matchReviewFile(files: readonly Work4YouReviewFile[], path: string): Work4YouReviewFile | undefined {
  const target = path.replace(/\\/g, '/').replace(/\/+$/, '')

  if (!target) {
    return undefined
  }

  return files.find(file => {
    const candidate = file.path.replace(/\\/g, '/')

    return candidate === target || target.endsWith(`/${candidate}`) || candidate.endsWith(`/${target}`)
  })
}

/**
 * Open the review pane on one file's diff. The path comes from a tool call, so
 * it may be absolute while git reports repo-relative — match on the tail.
 */
export async function openReviewForPath(
  path: string,
  scopeCwd: null | string = null,
  scopeTarget = 'main'
): Promise<void> {
  revealReview(scopeCwd, scopeTarget)
  $reviewScope.set('uncommitted')
  $reviewDirectoryPath.set(null)
  clearReviewSelection()
  const cwd = repoCwd()
  const connection = desktopFsCacheKey()
  const target = $reviewScopeTarget.get()
  let pending = refreshReview()
  let request = reviewRefreshSeq

  const live = () =>
    request === reviewRefreshSeq &&
    repoCwd() === cwd &&
    desktopFsCacheKey() === connection &&
    $reviewScopeTarget.get() === target &&
    $reviewScope.get() === 'uncommitted' &&
    $reviewOpen.get()

  await pending

  // Git compacts wholly untracked directories. Follow only the requested path,
  // opening one ancestor at a time, rather than scanning the whole workspace.
  const visited = new Set<string>()

  while (live() && !$reviewError.get()) {
    const files = $reviewFiles.get()
    const file = matchReviewFile(files, path)

    if (file) {
      await selectReviewFile(file)

      return
    }

    const normalized = path.replace(/\\/g, '/')

    const directory = files.find(item => {
      const prefix = item.path.replace(/\\/g, '/').replace(/\/+$/, '') + '/'

      return (
        item.kind === 'directory' &&
        !visited.has(item.path) &&
        (normalized.startsWith(prefix) || normalized.includes(`/${prefix}`))
      )
    })

    if (!directory) {
      clearReviewSelection()

      if (!$reviewTruncated.get()) {
        $reviewMissingPath.set(path)
      }

      return
    }

    visited.add(directory.path)
    pending = selectReviewDirectory(directory.path)
    request = reviewRefreshSeq
    await pending
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────

// Run a git mutation then re-sync both the review list and the rail's +/- (the
// working tree changed). A failure is swallowed by the caller's notify wrapper.
async function afterMutation(cwd: string, connection: string): Promise<void> {
  if (repoCwd() !== cwd || desktopFsCacheKey() !== connection) {
    return
  }

  void refreshRepoStatus(cwd)

  // A staged child is no longer inside a wholly untracked directory. Re-read
  // the root so Git can describe the new tracked/untracked grouping truthfully.
  if ($reviewDirectoryPath.get()) {
    $reviewDirectoryPath.set(null)
    clearReviewSelection()
  }

  await refreshReview()
}

export async function stageReviewFile(path: null | string): Promise<void> {
  const ctx = reviewCtx()

  if (!ctx || $reviewScope.get() === 'branch' || $reviewError.get() || $reviewLoading.get()) {
    return
  }

  const connection = desktopFsCacheKey()
  await ctx.review.stage(ctx.cwd, path)
  await afterMutation(ctx.cwd, connection)
}

export async function unstageReviewFile(path: null | string): Promise<void> {
  const ctx = reviewCtx()

  if (!ctx || $reviewScope.get() === 'branch' || $reviewError.get() || $reviewLoading.get()) {
    return
  }

  const connection = desktopFsCacheKey()
  await ctx.review.unstage(ctx.cwd, path)
  await afterMutation(ctx.cwd, connection)
}

export async function revertReviewFile(path: null | string): Promise<void> {
  const ctx = reviewCtx()

  if (!ctx || $reviewScope.get() === 'branch' || $reviewError.get() || $reviewLoading.get()) {
    return
  }

  const connection = desktopFsCacheKey()
  await ctx.review.revert(ctx.cwd, path)
  await afterMutation(ctx.cwd, connection)
}

// Revert is destructive (discards working-tree edits with no undo), so it always
// routes through a confirm dialog. The target is `{ path }` where `path === null`
// means "revert all"; `undefined` means no confirm is open. We wrap the path in
// an object so the `null` ("all") case is distinguishable from "closed".
export const $reviewRevertTarget = atom<{ path: null | string } | undefined>(undefined)

/** Open the revert confirm for a single file, or `null` for all changes. */
export function requestRevert(path: null | string): void {
  $reviewRevertTarget.set({ path })
}

export function cancelRevert(): void {
  $reviewRevertTarget.set(undefined)
}

/** Confirm the pending revert (closes the dialog, then performs it). */
export async function confirmRevert(): Promise<void> {
  const target = $reviewRevertTarget.get()

  $reviewRevertTarget.set(undefined)

  if (target) {
    await revertReviewFile(target.path)
  }
}

// ── Ship flow (commit / push / PR) ───────────────────────────────────────────

// Serialize ship actions behind one busy flag so the bar can't double-fire.
async function runShip<T>(action: () => Promise<T>): Promise<T> {
  $reviewShipBusy.set(true)

  try {
    return await action()
  } finally {
    $reviewShipBusy.set(false)
  }
}

export async function commitChanges(message: string, opts: { push?: boolean } = {}): Promise<void> {
  const ctx = reviewCtx()

  if (
    !ctx ||
    !message.trim() ||
    $reviewScope.get() === 'branch' ||
    $reviewError.get() ||
    $reviewLoading.get() ||
    $reviewShipBusy.get()
  ) {
    return
  }

  await runShip(async () => {
    const connection = desktopFsCacheKey()
    await ctx.review.commit(ctx.cwd, message.trim(), Boolean(opts.push))
    await afterMutation(ctx.cwd, connection)
    void refreshShipInfo()
  })
}

// Monotonic token: each generation captures one; Stop (or a newer press) bumps
// it, so a stale resolve is ignored. The model call can't be aborted
// server-side — we just drop its result and free the UI immediately.
let commitGenSeq = 0

/** Abandon any in-flight commit-message generation and re-enable the input. */
export function cancelCommitMessage(): void {
  commitGenSeq += 1
  $reviewCommitMsgBusy.set(false)
}

// Draft a commit message from the working-tree diff via a one-off LLM request
// (outside the conversation — no history, no cache break). `previous` is the
// current box text: handing it back as "don't repeat this" makes a re-press a
// real regen even on greedy / temperature-pinned models. Throws so the UI toasts.
export async function generateCommitMessage(previous = ''): Promise<string> {
  const ctx = reviewCtx()

  if (!ctx?.review.commitContext) {
    return ''
  }

  const gen = (commitGenSeq += 1)
  const connection = desktopFsCacheKey()
  const live = () => gen === commitGenSeq && repoCwd() === ctx.cwd && desktopFsCacheKey() === connection

  $reviewCommitMsgBusy.set(true)

  try {
    const { diff, recent } = await ctx.review.commitContext(ctx.cwd)

    if (!live() || !diff.trim()) {
      return ''
    }

    const text = await requestOneShot({
      template: 'commit_message',
      temperature: 0.8,
      variables: { avoid: previous, diff, recent_commits: recent }
    })

    return live() ? text : ''
  } finally {
    if (live()) {
      $reviewCommitMsgBusy.set(false)
    }
  }
}

export async function pushChanges(): Promise<void> {
  const ctx = reviewCtx()

  if (!ctx) {
    return
  }

  await runShip(async () => {
    await ctx.review.push(ctx.cwd)
    void refreshShipInfo()
  })
}

// PR button: open the existing PR in the browser, or create one (pushing first)
// then open it. Caller gates this on shipInfo.ghReady.
export async function createOrOpenPr(): Promise<void> {
  const ctx = reviewCtx()

  if (!ctx) {
    return
  }

  const existing = $reviewShipInfo.get().pr

  if (existing?.url) {
    void window.work4youDesktop?.openExternal?.(existing.url)

    return
  }

  await runShip(async () => {
    const { url } = await ctx.review.createPr(ctx.cwd)

    if (url) {
      void window.work4youDesktop?.openExternal?.(url)
    }

    // The session recorded its branch when it started; the checkout may have
    // moved since, so bind the conversation to the branch the PR actually came
    // from — otherwise a session that began on trunk badges whatever else lives
    // on trunk, or nothing.
    const session = $sessions.get().find(s => s.id === $selectedStoredSessionId.get())
    const branch = repoStatusForCwd(ctx.cwd).get()?.branch

    if (session?.git_repo_root && branch) {
      stampSessionPrBranch(session.id, session.git_repo_root, branch)
    }

    void refreshShipInfo()
  })
}

// ── Triggers (module-scope, mirror coding-status.ts) ─────────────────────────

// A file-mutating tool finished (event-driven, not polled) → refresh the open
// pane's changed-file list. gh/PR re-check is NOT here (gh is slow); it runs on
// the settle edge below.
$workspaceChangeTick.subscribe(() => {
  if ($reviewOpen.get()) {
    scheduleReviewRefresh()
  }
})

// Turn settled: final list refresh + the slower gh/PR re-check.
let prevBusy = $busy.get()

$busy.subscribe(busy => {
  if (prevBusy && !busy && $reviewOpen.get()) {
    scheduleReviewRefresh()
    refreshShipInfoIfStale()
  }

  prevBusy = busy
})

// The pane's repo moved under it. For the classic (unscoped) pane that's the
// active session's cwd changing; for a scoped pane it's a re-home to another
// tile's worktree — and a main-pane cwd change is deliberately IGNORED while
// scoped, so switching sessions in main can't yank the diff you're reviewing.
// Either way: clear the stale file list + selection up front so the pane drops
// straight to its loading skeleton instead of blipping the previous repo's
// diff into the new one.
function onReviewRepoMoved(): void {
  reviewRefreshSeq += 1
  reviewDiffSeq += 1
  shipInfoSeq += 1
  cancelCommitMessage()
  cancelRevert()
  $reviewScope.set('uncommitted')
  $reviewScopesSupported.set(false)
  $reviewFullContext.set(false)
  $reviewBaseRef.set(null)
  $reviewResolvedBaseRef.set(null)
  $reviewRepoRoot.set(null)
  $reviewDirectoryPath.set(null)
  $reviewError.set(null)
  $reviewCommitSummary.set({
    hasStaged: false,
    stagedCount: 0,
    totalCount: 0,
    includesDirectories: false,
    truncated: false
  })
  $reviewShipInfo.set({ ghReady: false, pr: null })
  clearReviewSelection()
  $reviewFiles.set([])
  $reviewTruncated.set(false)

  if ($reviewOpen.get()) {
    $reviewLoading.set(true)
    scheduleReviewRefresh()
    void refreshShipInfo()
  }
}

$currentCwd.subscribe(() => {
  if (!$reviewScopeCwd.get()) {
    onReviewRepoMoved()
  }
})

let prevScopeCwd = $reviewScopeCwd.get()

$reviewScopeCwd.subscribe(scope => {
  if (scope !== prevScopeCwd) {
    prevScopeCwd = scope
    onReviewRepoMoved()
  }
})

let previousConnection = desktopFsCacheKey()
$connection.subscribe(() => {
  const next = desktopFsCacheKey()

  if (next !== previousConnection) {
    previousConnection = next
    onReviewRepoMoved()
  }
})

// An outside terminal may have changed the tree while we were away.
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    if ($reviewOpen.get()) {
      scheduleReviewRefresh()
      refreshShipInfoIfStale()
    }
  })
}
