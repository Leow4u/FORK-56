import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, test } from 'vitest'

import {
  gitFor,
  repoStatus,
  resolveRenamePath,
  REVIEW_FILE_CAP,
  reviewCommit,
  reviewDiff,
  reviewList,
  reviewStage,
  reviewUnstage
} from './git-review-ops'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true })
  }
})

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-desktop-git-status-'))

  tempDirs.push(dir)
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 'work4you-test@example.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Work4You Test'], { cwd: dir })
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: dir })
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'tracked\n')
  execFileSync('git', ['add', 'tracked.txt'], { cwd: dir })
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: dir })

  return dir
}

test('resolveRenamePath: plain path is unchanged', () => {
  assert.equal(resolveRenamePath('src/a.ts'), 'src/a.ts')
})

test('gitFor accepts an internally resolved git binary path containing spaces', () => {
  assert.doesNotThrow(() => gitFor(process.cwd(), 'C:\\Program Files\\Git\\cmd\\git.exe'))
})

test('gitFor runs git through a spaced binary path', async () => {
  if (process.platform !== 'win32') {
    return
  }

  const gitBin = path.join(process.env.ProgramFiles || String.raw`C:\Program Files`, 'Git', 'cmd', 'git.exe')

  if (!fs.existsSync(gitBin)) {
    return
  }

  const repo = makeRepo()

  fs.writeFileSync(path.join(repo, 'changed.txt'), 'review me\n')

  const status = await gitFor(repo, gitBin).status()

  assert.equal(status.not_added.includes('changed.txt'), true)
})

test('resolveRenamePath: simple rename resolves to the new path', () => {
  assert.equal(resolveRenamePath('old.ts => new.ts'), 'new.ts')
})

test('resolveRenamePath: brace rename resolves to the new path', () => {
  assert.equal(resolveRenamePath('src/{old => new}/file.ts'), 'src/new/file.ts')
})

test('resolveRenamePath: brace rename collapsing a segment', () => {
  assert.equal(resolveRenamePath('src/{lib => }/file.ts'), 'src/file.ts')
})

test('repoStatus reports an untracked directory without recursively listing its contents', async () => {
  const dir = makeRepo()
  const nested = path.join(dir, 'generated', 'deep')

  fs.mkdirSync(nested, { recursive: true })
  fs.writeFileSync(path.join(nested, 'large-output.txt'), 'generated\n')

  const status = await repoStatus(dir, 'git')

  assert.ok(status)
  assert.equal(status.untracked, 1)
  assert.equal(status.changed, 1)
  assert.deepEqual(
    status.files.map(file => file.path),
    ['generated/']
  )
})

test('reviewList reports an untracked directory without recursively listing its contents', async () => {
  const dir = makeRepo()
  const nested = path.join(dir, 'browser-profile', 'Default', 'Cache')

  fs.mkdirSync(nested, { recursive: true })

  for (let i = 0; i < 20; i++) {
    fs.writeFileSync(path.join(nested, `cache-${i}.bin`), 'generated\n')
  }

  const result = await reviewList(dir, 'uncommitted', null, 'git')

  assert.deepEqual(
    result.files.map(file => file.path),
    ['browser-profile/']
  )
})

test('reviewList caps the file payload returned to the renderer', async () => {
  const dir = makeRepo()

  for (let i = 0; i < REVIEW_FILE_CAP + 10; i++) {
    fs.writeFileSync(path.join(dir, `untracked-${String(i).padStart(4, '0')}.txt`), 'generated\n')
  }

  const result = await reviewList(dir, 'uncommitted', null, 'git')

  assert.equal(result.files.length, REVIEW_FILE_CAP)
  assert.equal(result.truncated, true)
}, 20_000)

function git(dir: string, ...args: string[]) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
}

function diff(
  dir: string,
  file: string,
  scope = 'uncommitted',
  base: string | null = null,
  staged = false,
  full = false
) {
  return reviewDiff(dir, file, scope, base, staged, full, 'git')
}

test('partial staging keeps each count and patch aligned with its scope and commit', async () => {
  const dir = makeRepo()
  const file = path.join(dir, 'tracked.txt')
  fs.writeFileSync(file, 'prepared\n')
  git(dir, 'add', 'tracked.txt')
  fs.writeFileSync(file, 'tracked\n')
  const all = await reviewList(dir, 'uncommitted', null, 'git')
  const prepared = await reviewList(dir, 'staged', null, 'git')
  const pending = await reviewList(dir, 'unstaged', null, 'git')
  assert.equal(all.state, 'ready')
  assert.equal(all.files[0].added, prepared.files[0].added + pending.files[0].added)
  assert.equal(all.files[0].stagedAdded, prepared.files[0].added)
  assert.equal(all.files[0].unstagedAdded, pending.files[0].added)
  assert.equal(all.files[0].staged, true)
  assert.equal(all.files[0].unstaged, true)
  assert.match(await diff(dir, 'tracked.txt', 'staged'), /\+prepared/)
  assert.match(await diff(dir, 'tracked.txt', 'unstaged'), /\+tracked/)
  const status = await repoStatus(dir, 'git')
  assert.equal(status?.added, all.files[0].added)
  assert.equal(status?.removed, all.files[0].removed)
  await reviewCommit(dir, 'prepared only', false, 'git')
  assert.equal(git(dir, 'show', 'HEAD:tracked.txt'), 'prepared')
  assert.equal(fs.readFileSync(file, 'utf8'), 'tracked\n')
}, 20_000)

test('branch comparisons respect the selected local or remote base and never checkout', async () => {
  const dir = makeRepo()
  git(dir, 'branch', '-M', 'main')
  git(dir, 'switch', '-qc', 'feature')
  fs.writeFileSync(path.join(dir, 'first.txt'), 'first\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-qm', 'first')
  git(dir, 'branch', 'later-base')
  git(dir, 'update-ref', 'refs/remotes/origin/later-base', 'HEAD')
  fs.writeFileSync(path.join(dir, 'second.txt'), 'second\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-qm', 'second')
  const main = await reviewList(dir, 'branch', 'main', 'git')
  const local = await reviewList(dir, 'branch', 'later-base', 'git')
  const remote = await reviewList(dir, 'branch', 'origin/later-base', 'git')
  assert.deepEqual(
    main.files.map(f => f.path),
    ['first.txt', 'second.txt']
  )
  assert.deepEqual(
    local.files.map(f => f.path),
    ['second.txt']
  )
  assert.deepEqual(remote.files, local.files)
  assert.equal(await diff(dir, 'first.txt', 'branch', 'later-base'), '')
  assert.match(await diff(dir, 'first.txt', 'branch', 'main'), /\+first/)
  assert.equal((await reviewList(dir, 'branch', 'missing-base', 'git')).state, 'error')
  await assert.rejects(diff(dir, 'first.txt', 'branch', 'missing-base'))
  assert.equal(git(dir, 'branch', '--show-current'), 'feature')
}, 20_000)

test('automatic branch base works with only the remote default ref', async () => {
  const dir = makeRepo()
  git(dir, 'branch', '-M', 'feature')
  const base = git(dir, 'rev-parse', 'HEAD')
  git(dir, 'update-ref', 'refs/remotes/origin/main', base)
  git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
  fs.writeFileSync(path.join(dir, 'feature.txt'), 'feature change\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-qm', 'feature change')

  const result = await reviewList(dir, 'branch', null, 'git')
  assert.equal(result.state, 'ready')
  assert.equal(result.base, base)
  assert.deepEqual(
    result.files.map(file => file.path),
    ['feature.txt']
  )
  assert.match(await diff(dir, 'feature.txt', 'branch'), /\+feature change/)
  assert.equal(git(dir, 'branch', '--list', 'main'), '')
  assert.equal(git(dir, 'branch', '--show-current'), 'feature')
}, 20_000)

test('commit metadata includes staged paths beyond the review payload cap', async () => {
  const dir = makeRepo()
  const paths = Array.from({ length: REVIEW_FILE_CAP }, (_, i) => `a-${String(i).padStart(4, '0')}.txt`)
  paths.push('z-staged.txt')

  for (const file of paths) {
    fs.writeFileSync(path.join(dir, file), 'original\n')
  }

  git(dir, 'add', '.')
  git(dir, 'commit', '-qm', 'many tracked files')

  for (const file of paths) {
    fs.writeFileSync(path.join(dir, file), 'changed\n')
  }

  git(dir, 'add', 'z-staged.txt')

  const result = await reviewList(dir, 'uncommitted', null, 'git')
  assert.equal(result.files.length, REVIEW_FILE_CAP)
  assert.equal(result.truncated, true)
  assert.equal(
    result.files.some(file => file.staged),
    false
  )
  assert.ok('stagedCount' in result && 'totalCount' in result)
  assert.equal(result.stagedCount, 1)
  assert.equal(result.totalCount, paths.length)
  const staged = await reviewList(dir, 'staged', null, 'git')
  assert.deepEqual(
    staged.files.map(file => file.path),
    ['z-staged.txt']
  )
  assert.ok('stagedCount' in staged && 'totalCount' in staged)
  assert.equal(staged.stagedCount, result.stagedCount)
  assert.equal(staged.totalCount, result.totalCount)
  await reviewCommit(dir, 'prepared subset', false, 'git')
  assert.equal(git(dir, 'show', '--format=', '--name-only', 'HEAD'), 'z-staged.txt')
}, 30_000)

test('full context reads the index version and does not inject worktree-only content', async () => {
  const dir = makeRepo()
  const file = path.join(dir, 'tracked.txt')
  const original = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n') + '\n'
  fs.writeFileSync(file, original)
  git(dir, 'add', '.')
  git(dir, 'commit', '-qm', 'many lines')
  fs.writeFileSync(file, original.replace('line 20', 'prepared line'))
  git(dir, 'add', '.')
  fs.writeFileSync(file, original.replace('line 20', 'working copy only'))
  const compact = await diff(dir, 'tracked.txt', 'staged')
  const full = await diff(dir, 'tracked.txt', 'staged', null, false, true)
  assert.ok(!compact.includes('line 0'))
  assert.match(full, / line 0/)
  assert.match(full, /\+prepared line/)
  assert.ok(!full.includes('working copy only'))
}, 20_000)

test('new folder browsing is immediate, ignores excluded children and never all-adds clean files', async () => {
  const dir = makeRepo()
  fs.writeFileSync(path.join(dir, '.gitignore'), '*.ignored\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-qm', 'ignore')
  fs.mkdirSync(path.join(dir, 'new', 'nested'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'new', 'a.txt'), 'new file\n')
  fs.writeFileSync(path.join(dir, 'new', 'secret.ignored'), 'excluded\n')
  fs.writeFileSync(path.join(dir, 'new', 'nested', 'b.txt'), 'nested\n')
  const root = await reviewList(dir, 'uncommitted', null, 'git')
  assert.equal(root.files[0].kind, 'directory')
  const children = await reviewList(dir, 'uncommitted', null, 'git', 'new/')
  assert.equal(children.state, 'ready', JSON.stringify(children))
  assert.deepEqual(
    children.files.map(f => f.path),
    ['new/a.txt', 'new/nested/']
  )
  assert.match(await diff(dir, 'new/a.txt'), /\+new file/)
  assert.equal(await diff(dir, 'tracked.txt'), '')
  assert.equal((await reviewList(dir, 'uncommitted', null, 'git', '../')).state, 'error')
  await assert.rejects(diff(dir, '../outside.txt'))
}, 20_000)

test('review distinguishes clean, nonrepo, missing path and Git failures', async () => {
  const dir = makeRepo()
  assert.equal((await reviewList(dir, 'uncommitted', null, 'git')).state, 'ready')
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-nonrepo-'))
  tempDirs.push(empty)
  assert.equal((await reviewList(empty, 'uncommitted', null, 'git')).state, 'not-repo')
  assert.equal((await reviewList(path.join(dir, 'missing'), 'uncommitted', null, 'git')).state, 'error')
  git(dir, 'config', 'core.repositoryformatversion', 'invalid')
  assert.equal((await reviewList(dir, 'uncommitted', null, 'git')).state, 'error')
}, 20_000)

test('rename, deletion, binary and quoted paths preserve their actual Git patches', async () => {
  const dir = makeRepo()
  fs.writeFileSync(path.join(dir, 'binary.bin'), Buffer.from([0, 1]))
  fs.writeFileSync(path.join(dir, 'remove.txt'), 'remove\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-qm', 'files')
  git(dir, 'mv', 'tracked.txt', 'renamed ü.txt')
  fs.unlinkSync(path.join(dir, 'remove.txt'))
  fs.writeFileSync(path.join(dir, 'binary.bin'), Buffer.from([0, 2]))
  const staged = await reviewList(dir, 'staged', null, 'git')
  assert.equal(staged.files[0].status, 'R')
  assert.equal(staged.files[0].added, 0)
  assert.match(await diff(dir, 'renamed ü.txt', 'staged'), /rename from tracked.txt/)
  const pending = await reviewList(dir, 'unstaged', null, 'git')
  assert.equal(pending.files.find(f => f.path === 'binary.bin')?.binary, true)
  assert.equal(pending.files.find(f => f.path === 'remove.txt')?.status, 'D')
  assert.match(await diff(dir, 'binary.bin', 'unstaged'), /Binary files/)
  assert.match(await diff(dir, 'remove.txt', 'unstaged'), /-remove/)
}, 20_000)

test('a session opened in a subfolder reviews and stages paths from the repository root', async () => {
  const dir = makeRepo()
  const child = path.join(dir, 'src')
  fs.mkdirSync(child)
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'changed\n')
  fs.writeFileSync(path.join(child, 'new.txt'), 'new\n')
  const result = await reviewList(child, 'uncommitted', null, 'git')
  assert.equal(path.resolve(result.repoRoot!), path.resolve(dir))
  assert.match(await diff(child, 'tracked.txt'), /\+changed/)
  const children = await reviewList(child, 'uncommitted', null, 'git', 'src/')
  assert.equal(children.files[0].path, 'src/new.txt')
  assert.match(await diff(child, 'src/new.txt'), /\+new/)
  await reviewStage(child, 'tracked.txt', 'git')
  assert.equal((await reviewList(child, 'staged', null, 'git')).files[0].path, 'tracked.txt')
  await reviewUnstage(child, 'tracked.txt', 'git')
  assert.equal((await reviewList(child, 'staged', null, 'git')).files.length, 0)
}, 20_000)

test('untracked directory expansion does not follow a symlink outside the repository', async () => {
  const dir = makeRepo()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-outside-review-'))
  tempDirs.push(outside)
  fs.writeFileSync(path.join(outside, 'outside.txt'), 'outside\n')
  fs.symlinkSync(outside, path.join(dir, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.equal((await reviewList(dir, 'uncommitted', null, 'git', 'linked/')).state, 'error')
}, 20_000)

test('unstaging an unborn branch preserves working files and their post-stage edits', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-unborn-review-'))
  tempDirs.push(dir)
  git(dir, 'init', '-q')
  git(dir, 'config', 'core.autocrlf', 'false')
  fs.writeFileSync(path.join(dir, 'first.txt'), 'prepared\n')
  fs.writeFileSync(path.join(dir, 'second.txt'), 'second\n')
  git(dir, 'add', '.')
  fs.writeFileSync(path.join(dir, 'first.txt'), 'working changes\n')
  await reviewUnstage(dir, 'first.txt', 'git')
  assert.equal(fs.readFileSync(path.join(dir, 'first.txt'), 'utf8'), 'working changes\n')
  assert.deepEqual(
    (await reviewList(dir, 'staged', null, 'git')).files.map(f => f.path),
    ['second.txt']
  )
  await reviewUnstage(dir, null, 'git')
  assert.equal((await reviewList(dir, 'staged', null, 'git')).files.length, 0)
  assert.equal(fs.readFileSync(path.join(dir, 'second.txt'), 'utf8'), 'second\n')
}, 20_000)
