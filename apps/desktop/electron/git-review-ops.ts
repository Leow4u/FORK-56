// Git ops backing the coding rail + Codex-style review pane. Built on `simple-git`
// (a maintained wrapper around the system git binary — same git the rest of the
// app shells to, no native build) so we read structured status()/diffSummary()
// results instead of hand-parsing porcelain. Legacy probes degrade to null;
// Review reads distinguish clean/non-repo/error and mutations reject.

import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import simpleGit from 'simple-git'

import { resolveRequestedPathForIpc } from './hardening'

const COMMIT_CONTEXT_DIFF_MAX_CHARS = 120_000
const COMMIT_CONTEXT_UNTRACKED_MAX = 80
const REVIEW_FILE_CAP = 2_000
const UNTRACKED_LINE_COUNT_CONCURRENCY = 16
const UNTRACKED_LINE_COUNT_MAX_BYTES = 1024 * 1024

// GUI-launched Electron apps on macOS inherit only a minimal PATH (no
// /opt/homebrew/bin or /usr/local/bin), so `gh` — and the `git` gh shells out
// to — aren't found. Augment PATH with the resolved gh dir + the common
// package-manager bins so gh runs the same way it does in a terminal.
function ghEnv(ghBin) {
  const extra = [ghBin ? path.dirname(ghBin) : '', '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'].filter(
    dir => dir && dir !== '.'
  )

  return { ...process.env, PATH: [...extra, process.env.PATH].filter(Boolean).join(path.delimiter) }
}

// Run the `gh` CLI in a repo. Resolves { ok, stdout } so callers branch on
// availability/auth without a throw. gh missing/unauthed → ok:false.
function runGh(args, cwd, ghBin): Promise<{ ok: boolean; stdout: string }> {
  return new Promise(resolve => {
    execFile(
      ghBin || 'gh',
      args,
      { cwd, env: ghEnv(ghBin), windowsHide: true, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => resolve({ ok: !err, stdout: String(stdout || '') })
    )
  })
}

function gitFor(cwd, gitBin) {
  // `gitBin` is resolved inside the Electron main process from known install
  // locations or PATH — never renderer/user input. simple-git's custom-binary
  // validation rejects paths containing spaces (the default Windows install is
  // `C:\Program Files\Git\cmd\git.exe`), which silently broke the Review pane.
  // For spaced paths, opt into simple-git's trusted-binary escape hatch instead
  // of falling back to PATH (often absent in GUI-launched apps, and PATH lookup
  // could resolve a repo-local git.exe).
  return simpleGit({
    baseDir: cwd,
    binary: gitBin || 'git',
    maxConcurrentProcesses: 4,
    trimmed: false,
    ...(gitBin && /\s/.test(gitBin) ? { unsafe: { allowUnsafeCustomBinary: true } } : {})
  })
}

// simple-git reports renames as `old => new` (and `dir/{old => new}/f`); resolve
// to the NEW path so the row addresses the real file for diff/stage.
function resolveRenamePath(raw) {
  const path = String(raw || '').trim()

  if (!path.includes(' => ')) {
    return path
  }

  const brace = path.match(/^(.*)\{(.*) => (.*)\}(.*)$/)

  if (brace) {
    const [, prefix, , to, suffix] = brace

    return `${prefix}${to}${suffix}`.replace(/\/{2,}/g, '/')
  }

  return path.split(' => ').pop().trim()
}

// Untracked files don't appear in diffSummary(); count insertions from disk so
// the review tree can show +N for new files (matches an all-add diff view).
// Insertions = line count: newline bytes, plus one for a final unterminated
// line. Binary (NUL byte) → 0, mirroring git numstat's "-".
async function untrackedInsertions(cwd, relPath) {
  try {
    const fullPath = path.join(cwd, relPath)
    const stat = await fs.lstat(fullPath)

    if (!stat.isFile() || stat.size > UNTRACKED_LINE_COUNT_MAX_BYTES) {
      return 0
    }

    const buf = await fs.readFile(fullPath)

    if (buf.includes(0)) {
      return 0
    }

    let lines = 0

    for (const byte of buf) {
      if (byte === 10) {
        lines++
      }
    }

    return buf.length > 0 && buf[buf.length - 1] !== 10 ? lines + 1 : lines
  } catch {
    return 0
  }
}

function capText(text, maxChars, label = 'truncated') {
  const value = String(text || '')

  if (value.length <= maxChars) {
    return value
  }

  return `${value.slice(0, maxChars)}\n# ${label}: ${value.length - maxChars} chars omitted\n`
}

// Resolve the base ref for "all branch changes": merge-base with the remote
// default branch (origin/HEAD), falling back to common trunk names.
async function branchBase(git) {
  const candidates = []

  try {
    const head = (await git.revparse(['--abbrev-ref', 'origin/HEAD'])).trim()

    if (head) {
      candidates.push(head)
    }
  } catch {
    // No origin/HEAD configured.
  }

  candidates.push('origin/main', 'origin/master', 'main', 'master')

  for (const ref of candidates) {
    try {
      const base = (await git.raw(['merge-base', 'HEAD', ref])).trim()

      if (base) {
        return base
      }
    } catch {
      // Ref doesn't exist; try the next candidate.
    }
  }

  return null
}

// Resolve the repo's default branch NAME ("main" / "master" / …), preferring
// the remote's HEAD, then common local trunk names. Null when none is found
// (e.g. a fresh repo with only a feature branch). Used to offer "branch off the
// trunk" regardless of which branch you're currently on.
async function defaultBranchName(git) {
  try {
    const head = (await git.revparse(['--abbrev-ref', 'origin/HEAD'])).trim()

    // "origin/main" → "main"; skip the bare "origin/HEAD" placeholder.
    if (head && head !== 'origin/HEAD') {
      return head.replace(/^origin\//, '')
    }
  } catch {
    // No origin/HEAD configured.
  }

  // Prefer a local trunk, then a remote-only one (returns the clean name either
  // way) so "branch off main" works even before main is checked out locally.
  for (const ref of [
    'refs/heads/main',
    'refs/heads/master',
    'refs/remotes/origin/main',
    'refs/remotes/origin/master'
  ]) {
    try {
      await git.raw(['rev-parse', '--verify', '--quiet', ref])

      return ref.replace(/^refs\/(?:heads|remotes\/origin)\//, '')
    } catch {
      // Ref doesn't exist; try the next candidate.
    }
  }

  return null
}

// A status file's single-letter classification, preferring the staged (index)
// code over the worktree code; untracked wins (simple-git marks both '?').
function statusLetter(file) {
  if (file.index === '?' || file.working_dir === '?') {
    return '?'
  }

  const code = file.index && file.index !== ' ' ? file.index : file.working_dir

  return (code || 'M').toUpperCase()
}

const isStaged = file => Boolean(file.index && file.index !== ' ' && file.index !== '?')

// Review reads distinguish an empty repository from failed Git/file reads.
// Keep the old fields for older renderers while exposing per-part counts.
function reviewFailure(error) {
  const message = error instanceof Error ? error.message : String(error)

  return {
    files: [],
    base: null,
    state: /not a git repository/i.test(message) ? 'not-repo' : 'error',
    error: message,
    repoRoot: undefined,
    truncated: false
  }
}

async function reviewRepoRoot(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review repository' })

  return (await gitFor(cwd, gitBin).raw(['rev-parse', '--show-toplevel'])).trim()
}

function reviewPath(cwd, filePath) {
  if (typeof filePath !== 'string' || !filePath || filePath.includes('\0')) {
    throw new Error('A repository-relative file path is required.')
  }

  const rel = filePath.replace(/\\/g, '/')

  if (
    path.isAbsolute(rel) ||
    /^[A-Za-z]:/.test(rel) ||
    rel.split('/').some(p => p === '..' || p.toLowerCase() === '.git')
  ) {
    throw new Error('The file must be inside the repository working directory.')
  }

  const full = resolveRequestedPathForIpc(rel, { baseDir: cwd, purpose: 'Review file' })
  const within = path.relative(cwd, full)

  if (!within || within === '..' || within.startsWith(`..${path.sep}`) || path.isAbsolute(within)) {
    throw new Error('The file must be inside the repository working directory.')
  }

  return rel
}

async function reviewBase(git, requested) {
  if (!requested) {
    const base = await branchBase(git)

    if (!base) {
      throw new Error('No comparison base is available. Select a branch.')
    }

    return { base, commit: base }
  }

  // Resolve the requested ref before constructing a range, so malformed refs
  // cannot become options and an invalid selection never falls back to trunk.
  const commit = (await git.raw(['rev-parse', '--verify', '--end-of-options', `${requested}^{commit}`])).trim()

  return { base: requested, commit }
}

async function reviewCounts(git, args) {
  const raw = await git.raw(['diff', '--no-ext-diff', '--numstat', '-z', ...args])
  const records = raw.split('\0')
  const counts = new Map<string, { added: number; removed: number; binary: boolean; previousPath?: string }>()

  for (let i = 0; i < records.length; i++) {
    const match = records[i].match(/^(\d+|-)\t(\d+|-)\t([\s\S]*)$/)

    if (!match) {
      continue
    }

    let filePath = match[3]
    let previousPath: string | undefined

    if (!filePath) {
      previousPath = records[++i]
      filePath = records[++i]
    }

    if (filePath) {
      counts.set(filePath, {
        added: match[1] === '-' ? 0 : Number(match[1]),
        removed: match[2] === '-' ? 0 : Number(match[2]),
        binary: match[1] === '-',
        ...(previousPath ? { previousPath } : {})
      })
    }
  }

  return counts
}

async function reviewStatuses(git, range) {
  const records = (await git.raw(['diff', '--no-ext-diff', '--name-status', '-z', range])).split('\0')
  const statuses = new Map<string, string>()

  for (let i = 0; i < records.length - 1;) {
    const status = records[i++]
    let filePath = records[i++]

    if (/^[RC]/.test(status)) {
      filePath = records[i++]
    }

    if (filePath) {
      statuses.set(filePath, status.slice(0, 1))
    }
  }

  return statuses
}

async function reviewUntrackedFile(cwd, filePath) {
  const target = path.join(cwd, filePath)
  const stat = await fs.lstat(target)
  const kind = stat.isDirectory() ? 'directory' : 'file'
  let added = 0
  let binary = false

  // Never follow a symlink while counting an untracked item.
  if (stat.isFile() && stat.size <= UNTRACKED_LINE_COUNT_MAX_BYTES) {
    const content = await fs.readFile(target)

    binary = content.includes(0)

    if (!binary) {
      for (const byte of content) {
        if (byte === 10) {
          added++
        }
      }

      if (content.length && content[content.length - 1] !== 10) {
        added++
      }
    }
  }

  return {
    path: filePath,
    added,
    removed: 0,
    status: '?',
    staged: false,
    unstaged: true,
    stagedAdded: 0,
    stagedRemoved: 0,
    unstagedAdded: added,
    unstagedRemoved: 0,
    kind,
    binary
  }
}

async function reviewDirectory(cwd, git, requested, gitBin) {
  const rel = reviewPath(cwd, requested).replace(/\/$/, '')
  const target = path.join(cwd, rel)
  const realCwd = await fs.realpath(cwd)
  const realTarget = await fs.realpath(target)
  const relative = path.relative(realCwd, realTarget)

  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    (await fs.lstat(target)).isSymbolicLink()
  ) {
    throw new Error('The directory must be inside the repository working directory.')
  }

  // Only browse an untracked directory. This prevents this endpoint becoming a
  // second general filesystem tree or accidentally returning tracked children.
  const status = await git.status(['--untracked-files=normal', '--', `:(literal)${rel}/`])

  if (!status.not_added.some(p => p.replace(/\/$/, '') === rel)) {
    throw new Error('This untracked directory changed. Refresh the review.')
  }

  const dir = await fs.opendir(target)
  const paths: string[] = []
  let truncated = false

  for await (const entry of dir) {
    if (entry.name.toLowerCase() === '.git') {
      continue
    }

    if (paths.length === REVIEW_FILE_CAP) {
      truncated = true

      break
    }

    paths.push(`${rel}/${entry.name}${entry.isDirectory() ? '/' : ''}`)
  }

  // check-ignore is non-recursive; exit 1 means no matching ignored paths.
  const ignored = paths.length
    ? await new Promise<string>((resolve, reject) => {
        const child = execFile(
          gitBin || 'git',
          ['check-ignore', '-z', '--stdin'],
          { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error && error.code !== 1) {
              reject(new Error(String(stderr || error.message)))
            } else {
              resolve(String(stdout || ''))
            }
          }
        )

        child.stdin?.on('error', () => undefined)
        child.stdin?.end(paths.join('\0') + '\0')
      })
    : ''

  const ignoredPaths = new Set(ignored.split('\0').map(p => p.replace(/\/$/, '')))
  const visible = paths.filter(p => !ignoredPaths.has(p.replace(/\/$/, '')))
  const files: Awaited<ReturnType<typeof reviewUntrackedFile>>[] = []

  for (let i = 0; i < visible.length; i += UNTRACKED_LINE_COUNT_CONCURRENCY) {
    files.push(
      ...(await Promise.all(
        visible.slice(i, i + UNTRACKED_LINE_COUNT_CONCURRENCY).map(p => reviewUntrackedFile(cwd, p))
      ))
    )
  }

  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), base: null, state: 'ready', truncated }
}

async function reviewList(repoPath, scope, baseRef, gitBin, directory = null) {
  try {
    const cwd = await reviewRepoRoot(repoPath, gitBin)
    const git = gitFor(cwd, gitBin)
    const inside = (await git.raw(['rev-parse', '--is-inside-work-tree'])).trim()

    if (inside !== 'true') {
      return { files: [], base: null, state: 'not-repo' }
    }

    if (directory) {
      if (scope !== 'uncommitted' && scope !== 'unstaged') {
        throw new Error('Directories are only available for uncommitted files.')
      }

      return { ...(await reviewDirectory(cwd, git, directory, gitBin)), repoRoot: cwd }
    }

    if (scope === 'branch' || scope === 'lastTurn') {
      if (scope === 'lastTurn' && !baseRef) {
        throw new Error('No comparison base is available.')
      }

      const resolved = await reviewBase(git, baseRef)

      if (!resolved.commit) {
        throw new Error('No comparison base is available.')
      }

      const range = scope === 'branch' ? `${resolved.commit}...HEAD` : resolved.commit
      const counts = await reviewCounts(git, [range])
      const statuses = await reviewStatuses(git, range)

      const files = [...counts].slice(0, REVIEW_FILE_CAP).map(([filePath, count]) => ({
        path: filePath,
        ...count,
        status: statuses.get(filePath) || 'M',
        staged: false,
        unstaged: false,
        kind: 'file'
      }))

      // Preserve the existing lastTurn API; the UI does not expose it without
      // an authoritative turn baseline.
      if (scope === 'lastTurn' && files.length < REVIEW_FILE_CAP) {
        const status = await git.status(['--untracked-files=normal'])

        for (const filePath of status.not_added) {
          if (files.length === REVIEW_FILE_CAP) {
            break
          }

          if (!counts.has(filePath)) {
            files.push(await reviewUntrackedFile(cwd, filePath))
          }
        }
      }

      return {
        files: files.sort((a, b) => a.path.localeCompare(b.path)),
        base: resolved.base,
        repoRoot: cwd,
        state: 'ready',
        truncated: counts.size > REVIEW_FILE_CAP
      }
    }

    if (!['uncommitted', 'staged', 'unstaged'].includes(scope)) {
      throw new Error('Unknown review scope.')
    }

    const [status, staged, unstaged] = await Promise.all([
      git.status(['--untracked-files=normal']),
      reviewCounts(git, ['--cached']),
      reviewCounts(git, [])
    ])

    const selected = status.files.filter(
      file =>
        scope === 'uncommitted' ||
        (scope === 'staged' ? isStaged(file) : Boolean(file.working_dir && file.working_dir !== ' '))
    )

    const files = []

    for (let i = 0; i < Math.min(selected.length, REVIEW_FILE_CAP); i += UNTRACKED_LINE_COUNT_CONCURRENCY) {
      files.push(
        ...(await Promise.all(
          selected.slice(i, Math.min(i + UNTRACKED_LINE_COUNT_CONCURRENCY, REVIEW_FILE_CAP)).map(async file => {
            const filePath = file.path

            if (statusLetter(file) === '?') {
              return reviewUntrackedFile(cwd, filePath)
            }

            const sc = staged.get(filePath) || { added: 0, removed: 0, binary: false }
            const uc = unstaged.get(filePath) || { added: 0, removed: 0, binary: false }
            const stagedOnly = scope === 'staged'
            const unstagedOnly = scope === 'unstaged'

            return {
              path: filePath,
              added: (unstagedOnly ? 0 : sc.added) + (stagedOnly ? 0 : uc.added),
              removed: (unstagedOnly ? 0 : sc.removed) + (stagedOnly ? 0 : uc.removed),
              stagedAdded: sc.added,
              stagedRemoved: sc.removed,
              unstagedAdded: uc.added,
              unstagedRemoved: uc.removed,
              status: unstagedOnly ? file.working_dir : statusLetter(file),
              staged: isStaged(file),
              unstaged: Boolean(file.working_dir && file.working_dir !== ' '),
              kind: 'file',
              binary: stagedOnly ? sc.binary : unstagedOnly ? uc.binary : sc.binary || uc.binary
            }
          })
        ))
      )
    }

    return {
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      base: null,
      repoRoot: cwd,
      state: 'ready',
      // Commit intent uses the complete status, regardless of scope or payload cap.
      // A compact untracked directory counts as one entry, without walking it.
      stagedCount: status.files.filter(isStaged).length,
      totalCount: status.files.length,
      truncated: selected.length > REVIEW_FILE_CAP
    }
  } catch (error) {
    return reviewFailure(error)
  }
}

function reviewExecDiff(cwd, args, gitBin, noIndex = false): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      gitBin || 'git',
      ['--literal-pathspecs', 'diff', '--no-ext-diff', ...args],
      { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && !(noIndex && error.code === 1)) {
          reject(new Error(String(stderr || error.message)))
        } else {
          resolve(String(stdout || ''))
        }
      }
    )
  })
}

async function reviewDiff(repoPath, filePath, scope, baseRef, staged, fullContext, gitBin) {
  const cwd = await reviewRepoRoot(repoPath, gitBin)
  const rel = reviewPath(cwd, filePath)
  const git = gitFor(cwd, gitBin)
  const args: string[] = fullContext ? ['--unified=2147483647'] : []
  let range: string[]

  if (scope === 'branch') {
    const { commit } = await reviewBase(git, baseRef)
    range = [`${commit}...HEAD`]
  } else if (scope === 'lastTurn') {
    if (!baseRef) {
      throw new Error('No comparison base is available.')
    }

    const { commit } = await reviewBase(git, baseRef)
    range = [commit]
  } else if (scope === 'staged' || (scope === 'uncommitted' && staged)) {
    range = ['--cached']
  } else if (scope === 'unstaged' || scope === 'uncommitted') {
    range = []
  } else {
    throw new Error('Unknown review scope.')
  }

  const counts = await reviewCounts(git, range)
  const previous = counts.get(rel)?.previousPath
  const patch = await reviewExecDiff(cwd, [...args, ...range, '--', ...(previous ? [previous] : []), rel], gitBin)

  if (patch.trim() || range.length) {
    return patch
  }

  const status = await git.status(['--untracked-files=normal', '--', `:(literal)${rel}`])

  // A clean tracked file, a staged-only file or a disappeared path is not an
  // all-add diff. Only synthesize one for a genuine untracked regular entry.
  if (!status.not_added.some(p => p === rel)) {
    return ''
  }

  if ((await fs.lstat(path.join(cwd, rel))).isDirectory()) {
    throw new Error('Select a file inside this untracked directory.')
  }

  return reviewExecDiff(cwd, [...args, '--no-index', '--', '/dev/null', rel], gitBin, true)
}

// Working-tree-vs-HEAD diff for ONE file — the "what changed since the last
// commit" view used by the file preview. Unlike reviewDiff this never synthesizes
// a full-add for a clean tracked file (so a pristine file shows no diff); it only
// all-adds a genuinely untracked file.
async function fileDiffVsHead(repoPath, filePath, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'File diff' })
  } catch {
    return ''
  }

  const git = gitFor(cwd, gitBin)
  const head = await git.diff(['HEAD', '--', filePath]).catch(() => '')

  if (head.trim()) {
    return head
  }

  // No tracked changes vs HEAD. Only synthesize an all-add diff for a file git
  // doesn't know yet; a clean tracked file must return empty.
  const status = await git.raw(['status', '--porcelain', '--', filePath]).catch(() => '')

  if (!status.trim().startsWith('??')) {
    return ''
  }

  return new Promise(resolve => {
    execFile(
      gitBin || 'git',
      ['diff', '--no-index', '--', '/dev/null', filePath],
      { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 },
      (_err, stdout) => resolve(String(stdout || ''))
    )
  })
}

async function reviewStage(repoPath, filePath, gitBin) {
  const cwd = await reviewRepoRoot(repoPath, gitBin)

  if (filePath) {
    filePath = reviewPath(cwd, filePath)
  }

  await gitFor(cwd, gitBin).raw(filePath ? ['--literal-pathspecs', 'add', '--', filePath] : ['add', '-A'])

  return { ok: true }
}

async function reviewUnstage(repoPath, filePath, gitBin) {
  const cwd = await reviewRepoRoot(repoPath, gitBin)

  if (filePath) {
    filePath = reviewPath(cwd, filePath)
  }

  const git = gitFor(cwd, gitBin)

  const hasHead = await new Promise<boolean>((resolve, reject) => {
    execFile(
      gitBin || 'git',
      ['rev-parse', '--verify', '--quiet', 'HEAD'],
      { cwd, windowsHide: true, timeout: 30_000 },
      (error, _stdout, stderr) => {
        if (error && error.code !== 1) {
          reject(new Error(String(stderr || error.message)))
        } else {
          resolve(!error)
        }
      }
    )
  })

  if (hasHead) {
    await git.raw(filePath ? ['--literal-pathspecs', 'reset', '-q', 'HEAD', '--', filePath] : ['reset', '-q', 'HEAD'])
  } else {
    // An unborn branch has no HEAD to reset to. Remove only index entries;
    // --cached preserves working files, including edits made after staging.
    // symbolic-ref must still succeed: a failed repository read is not unborn.
    await git.raw(['symbolic-ref', '--quiet', 'HEAD'])
    await git.raw([
      '--literal-pathspecs',
      'rm',
      '--cached',
      '-q',
      '-r',
      '-f',
      '--ignore-unmatch',
      '--',
      filePath || '.'
    ])
  }

  return { ok: true }
}

// Discard changes back to the committed state. Destructive — the renderer
// confirms first. Restores tracked files and removes untracked ones.
async function reviewRevert(repoPath, filePath, gitBin) {
  const cwd = await reviewRepoRoot(repoPath, gitBin)

  if (filePath) {
    filePath = reviewPath(cwd, filePath)
  }

  const git = gitFor(cwd, gitBin)

  if (filePath) {
    await git.raw(['--literal-pathspecs', 'checkout', 'HEAD', '--', filePath]).catch(() => undefined)
    await git.raw(['--literal-pathspecs', 'clean', '-fd', '--', filePath]).catch(() => undefined)
  } else {
    await git.raw(['checkout', 'HEAD', '--', '.']).catch(() => undefined)
    await git.raw(['clean', '-fd']).catch(() => undefined)
  }

  return { ok: true }
}

// Resolve a ref to a commit sha (captures the turn baseline for "Last turn").
async function reviewRevParse(repoPath, ref, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review rev-parse' })
  } catch {
    return null
  }

  try {
    return (await gitFor(cwd, gitBin).revparse([ref || 'HEAD'])).trim() || null
  } catch {
    return null
  }
}

// Commit the working tree. Mirrors VS Code: if nothing is staged, stage
// everything first ("commit all"), then commit. Optionally push afterward,
// setting upstream on the first push.
async function reviewCommit(repoPath, message, push, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review commit' })
  const git = gitFor(cwd, gitBin)
  const status = await git.status()

  if (status.staged.length === 0) {
    await git.raw(['add', '-A'])
  }

  await git.commit(message)

  if (push) {
    const fresh = await git.status()

    if (fresh.tracking) {
      await git.push()
    } else if (fresh.current) {
      await git.raw(['push', '-u', 'origin', fresh.current])
    }
  }

  return { ok: true }
}

// Gather the context the model needs to draft a commit message: the diff of
// what *will* be committed (staged when anything is staged, else everything
// vs HEAD — mirroring reviewCommit's "stage all when nothing staged" rule),
// the names of untracked files (which carry no diff), and recent commit
// subjects for style. Diff is capped so the payload stays bounded. Reads only.
async function reviewCommitContext(repoPath, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review commit context' })
  } catch {
    return { diff: '', recent: '' }
  }

  const git = gitFor(cwd, gitBin)
  const safe = args => git.diff(args).catch(() => '')

  let status

  try {
    status = await git.status()
  } catch {
    return { diff: '', recent: '' }
  }

  // What will land: staged changes if any, otherwise all tracked changes vs HEAD.
  let diff = capText(
    status.staged.length > 0 ? await safe(['--cached']) : await safe(['HEAD']),
    COMMIT_CONTEXT_DIFF_MAX_CHARS,
    'diff truncated for commit-message generation'
  )

  // Untracked files have no diff — list them so new files aren't invisible.
  const untracked = status.not_added || []

  if (untracked.length > 0) {
    const visible = untracked.slice(0, COMMIT_CONTEXT_UNTRACKED_MAX)
    const omitted = untracked.length - visible.length

    const note =
      `\n# New (untracked) files:\n${visible.map(p => `#   ${p}`).join('\n')}\n` +
      (omitted > 0 ? `#   ... ${omitted} more omitted\n` : '')

    diff = diff ? `${diff}${note}` : note
  }

  const recent = await git.raw(['log', '-n', '10', '--pretty=format:%s']).catch(() => '')

  return { diff: diff || '', recent: String(recent || '').trim() }
}

async function reviewPush(repoPath, gitBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review push' })
  const git = gitFor(cwd, gitBin)
  const status = await git.status()

  if (status.tracking) {
    await git.push()
  } else if (status.current) {
    await git.raw(['push', '-u', 'origin', status.current])
  }

  return { ok: true }
}

// gh availability + auth + whether this branch already has a PR. Reads only;
// drives the PR button's enabled/label state. `ghReady` is false when gh is
// missing OR not authenticated — either way the PR action can't run.
async function reviewShipInfo(repoPath, ghBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review ship info' })
  } catch {
    return { ghReady: false, pr: null }
  }

  const auth = await runGh(['auth', 'status'], cwd, ghBin)

  if (!auth.ok) {
    return { ghReady: false, pr: null }
  }

  const view = await runGh(['pr', 'view', '--json', 'url,state,number'], cwd, ghBin)

  if (!view.ok) {
    // gh exits non-zero when no PR exists for the branch — that's not an error.
    return { ghReady: true, pr: null }
  }

  try {
    const pr = JSON.parse(view.stdout)

    return { ghReady: true, pr: pr && pr.url ? { url: pr.url, state: pr.state, number: pr.number } : null }
  } catch {
    return { ghReady: true, pr: null }
  }
}

// GraphQL asks per branch, so the answer can't be crowded out the way a
// `gh pr list` page can. Aliases let one request carry many branches; 50 keeps
// the document well inside GitHub's node budget.
const PR_QUERY_BRANCH_CHUNK = 50
const PR_QUERY_BRANCH_CAP = 300

const PR_NODE_FIELDS = 'number state isDraft isCrossRepository title url headRefName'

function prQueryFor(owner, name, branches, numbers) {
  const fields = [
    ...branches.map(
      (branch, i) =>
        `b${i}: pullRequests(headRefName: ${JSON.stringify(branch)}, first: 5, ` +
        `orderBy: {field: CREATED_AT, direction: DESC}) ` +
        `{ nodes { ${PR_NODE_FIELDS} } }`
    ),
    // A PR recovered from a transcript is known by number, and asking for it
    // directly also tells us its branch — so it lands in the same by-branch map
    // as everything else.
    ...numbers.map((number, i) => `n${i}: pullRequest(number: ${number}) { ${PR_NODE_FIELDS} }`)
  ].join('\n')

  return `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {\n${fields}\n} }`
}

const prPayload = pr => ({
  branch: String(pr.headRefName),
  draft: Boolean(pr.isDraft),
  number: Number(pr.number) || 0,
  state: String(pr.state || '').toLowerCase(),
  title: String(pr.title || ''),
  url: String(pr.url || '')
})

// A GitHub review-comment / issue-comment URL, as pasted from the browser.
// Captures owner, repo, PR number, and the comment kind + id. Review threads
// deep-link as `#discussion_r<id>`; conversation-tab comments as
// `#issuecomment-<id>`.
const PR_COMMENT_URL_RE =
  /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:\/[^#\s]*)?#(discussion_r|issuecomment-)(\d+)$/

function parsePrCommentUrl(url) {
  const match = PR_COMMENT_URL_RE.exec(String(url || '').trim())

  if (!match) {
    return null
  }

  const [, owner, repo, prNumber, kind, id] = match

  return { id, kind: kind === 'discussion_r' ? 'review' : 'issue', owner, prNumber: Number(prNumber), repo }
}

// Resolve a pasted PR comment URL into the structured context the composer
// attaches: author, body, and — for review comments — the file, line range,
// and the diff hunk the comment anchors to. Reads only; any failure (gh
// missing, unauthenticated, private repo, deleted comment) yields null and the
// paste falls back to being a plain URL.
async function reviewFetchPrComment(repoPath, ghBin, url) {
  const parsed = parsePrCommentUrl(url)

  if (!parsed) {
    return null
  }

  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review comment fetch' })
  } catch {
    return null
  }

  const endpoint =
    parsed.kind === 'review'
      ? `repos/${parsed.owner}/${parsed.repo}/pulls/comments/${parsed.id}`
      : `repos/${parsed.owner}/${parsed.repo}/issues/comments/${parsed.id}`

  const res = await runGh(['api', endpoint], cwd, ghBin)

  if (!res.ok) {
    return null
  }

  try {
    const data = JSON.parse(res.stdout)

    return {
      author: String(data?.user?.login || ''),
      body: String(data?.body || ''),
      diffHunk: parsed.kind === 'review' ? String(data?.diff_hunk || '') : '',
      kind: parsed.kind,
      // `line` is the comment's anchor in the current diff; null once the code
      // moved on (outdated comment) — `original_line` still says where it was.
      line: data?.line ?? data?.original_line ?? null,
      path: parsed.kind === 'review' ? String(data?.path || '') : '',
      prNumber: parsed.prNumber,
      startLine: data?.start_line ?? data?.original_start_line ?? null,
      url: String(data?.html_url || url)
    }
  } catch {
    return null
  }
}

// The PR for each of the given branches, keyed by branch. Asks GitHub about the
// branches we actually have sessions on rather than listing the repo's newest
// PRs and hoping ours are in the page — on a busy repo they are not. One
// GraphQL request per 50 branches; reads only.
async function reviewPrList(repoPath, ghBin, branches, numbers) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review PR list' })
  } catch {
    return { ghReady: false, prs: [] }
  }

  const wanted = [...new Set((branches || []).filter(Boolean).map(String))].slice(0, PR_QUERY_BRANCH_CAP)
  const byNumber = [...new Set((numbers || []).map(Number).filter(Boolean))].slice(0, PR_QUERY_BRANCH_CAP)

  if (wanted.length === 0 && byNumber.length === 0) {
    return { ghReady: false, prs: [] }
  }

  const repo = await runGh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], cwd, ghBin)
  const [owner, name] = repo.stdout.trim().split('/')

  if (!repo.ok || !owner || !name) {
    // gh missing, unauthenticated, or no GitHub remote — all "nothing to badge".
    return { ghReady: false, prs: [] }
  }

  const prs = []
  const chunks = []

  for (let start = 0; start < wanted.length; start += PR_QUERY_BRANCH_CHUNK) {
    chunks.push([wanted.slice(start, start + PR_QUERY_BRANCH_CHUNK), []])
  }

  for (let start = 0; start < byNumber.length; start += PR_QUERY_BRANCH_CHUNK) {
    chunks.push([[], byNumber.slice(start, start + PR_QUERY_BRANCH_CHUNK)])
  }

  for (const [branchChunk, numberChunk] of chunks) {
    const query = prQueryFor(owner, name, branchChunk, numberChunk)
    const res = await runGh(['api', 'graphql', '-f', `query=${query}`], cwd, ghBin)

    if (!res.ok) {
      continue
    }

    try {
      const repository = JSON.parse(res.stdout)?.data?.repository ?? {}

      for (const key of Object.keys(repository)) {
        // Asked for by number, so it's ours by construction — a fork PR can't
        // be recovered from our own transcript. Asked for by branch, it has to
        // prove it: fork PRs share our branch namespace, and a contributor's
        // `main` is how a session on trunk ends up badged with a stranger's PR.
        const pr = key.startsWith('n')
          ? repository[key]
          : (repository[key]?.nodes ?? []).find(node => node && !node.isCrossRepository)

        if (pr?.headRefName) {
          prs.push(prPayload(pr))
        }
      }
    } catch {
      // A malformed chunk drops its branches; the rest still resolve.
    }
  }

  return { ghReady: true, prs }
}

// Create a PR for the current branch (pushing first so gh has a remote ref),
// letting gh fill title/body from the commits. Returns the new PR url.
async function reviewCreatePr(repoPath, gitBin, ghBin) {
  const cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Review create PR' })

  await reviewPush(repoPath, gitBin).catch(() => undefined)

  const created = await runGh(['pr', 'create', '--fill'], cwd, ghBin)

  if (!created.ok) {
    throw new Error('gh pr create failed (is gh installed and authenticated?)')
  }

  const url = created.stdout.trim().split('\n').filter(Boolean).pop() || ''

  return { url }
}

// Compact working-tree status for the composer coding rail: branch, ahead/behind,
// per-state change counts, +/- for both index/worktree parts, and a capped file list.
async function repoStatus(repoPath, gitBin) {
  let cwd

  try {
    cwd = resolveRequestedPathForIpc(repoPath, { purpose: 'Repo status' })
  } catch {
    return null
  }

  // Session cwds can point at a deleted worktree for a moment (or forever in a
  // stale row). simple-git throws at construction time on a missing baseDir, so
  // fail soft and hide the coding rail instead of spamming IPC handler errors.
  try {
    const stat = await fs.stat(cwd)

    if (!stat.isDirectory()) {
      return null
    }
  } catch {
    return null
  }

  let git

  try {
    cwd = await reviewRepoRoot(cwd, gitBin)
    git = gitFor(cwd, gitBin)
  } catch {
    return null
  }

  let status

  try {
    // The coding rail needs compact change truth, not every generated file.
    // `simple-git` defaults bare `-u` to recursive `all`, which can make a
    // generated workspace consume gigabytes before the 200-row UI cap is
    // applied. `normal` reports each untracked directory as one entry.
    status = await git.status(['--untracked-files=normal'])
  } catch {
    // Not a repo / git unavailable / remote backend.
    return null
  }

  const detached = typeof status.detached === 'boolean' ? status.detached : !status.current

  const files = status.files.map(file => ({
    path: file.path,
    staged: isStaged(file),
    unstaged: Boolean(file.working_dir && file.working_dir !== ' ' && file.working_dir !== '?'),
    untracked: file.index === '?' || file.working_dir === '?',
    conflicted: file.index === 'U' || file.working_dir === 'U'
  }))

  const result = {
    branch: detached ? null : status.current || null,
    defaultBranch: await defaultBranchName(git),
    detached,
    ahead: status.ahead || 0,
    behind: status.behind || 0,
    staged: files.filter(f => f.staged).length,
    unstaged: files.filter(f => f.unstaged).length,
    untracked: status.not_added.length,
    conflicted: status.conflicted.length,
    changed: files.length,
    added: 0,
    removed: 0,
    files: files.slice(0, 200)
  }

  // Match Review's two visible parts, including partial staging where an
  // edit in the worktree may undo a staged edit (net HEAD would hide both).
  try {
    const counts = await Promise.all([reviewCounts(git, ['--cached']), reviewCounts(git, [])])

    for (const part of counts) {
      for (const count of part.values()) {
        result.added += count.added
        result.removed += count.removed
      }
    }
  } catch {
    return null
  }

  // Tracked diffs ignore untracked files, so a turn that only creates new
  // files (the common case — a fresh module) showed +0 in the rail while the
  // review pane counted them. Fold top-level untracked file insertions into
  // `added`; directories reported by the compact `normal` scan intentionally
  // remain at zero rather than recursively walking their contents.
  try {
    const untracked = status.not_added.slice(0, REVIEW_FILE_CAP)

    for (let i = 0; i < untracked.length; i += UNTRACKED_LINE_COUNT_CONCURRENCY) {
      const batch = await Promise.all(
        untracked.slice(i, i + UNTRACKED_LINE_COUNT_CONCURRENCY).map(path => untrackedInsertions(cwd, path))
      )

      result.added += batch.reduce((sum, n) => sum + n, 0)
    }
  } catch {
    // Best-effort: a probe failure just leaves untracked lines uncounted.
  }

  return result
}

export {
  branchBase,
  fileDiffVsHead,
  gitFor,
  repoStatus,
  resolveRenamePath,
  REVIEW_FILE_CAP,
  reviewCommit,
  reviewCommitContext,
  reviewCreatePr,
  reviewDiff,
  reviewFetchPrComment,
  reviewList,
  reviewPrList,
  reviewPush,
  reviewRevert,
  reviewRevParse,
  reviewShipInfo,
  reviewStage,
  reviewUnstage
}
