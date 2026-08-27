import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'vitest'

import {
  appendUniquePathEntries,
  buildDesktopBackendEnv,
  buildDesktopBackendPath,
  normalizeWork4YouHomeRoot,
  pathEnvKey,
  POSIX_SANE_PATH_ENTRIES,
  work4youManagedNodePathEntries
} from './backend-env'

test('desktop backend PATH adds Work4You-managed bins and missing POSIX sane entries', () => {
  const result = buildDesktopBackendPath({
    work4youHome: '/Users/test/.work4you',
    venvRoot: '/Users/test/.work4you/work4you/venv',
    currentPath: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin',
    platform: 'darwin',
    pathModule: path.posix
  })

  const entries = result.split(':')
  // Both managed-Node layouts lead, POSIX-native shape first, then the venv.
  assert.deepEqual(entries.slice(0, 3), [
    '/Users/test/.work4you/node/bin',
    '/Users/test/.work4you/node',
    '/Users/test/.work4you/work4you/venv/bin'
  ])
  assert.ok(entries.includes('/opt/homebrew/bin'), 'Apple Silicon Homebrew bin is added')
  assert.ok(entries.includes('/opt/homebrew/sbin'), 'Apple Silicon Homebrew sbin is added')
  assert.ok(entries.includes('/usr/local/sbin'), 'missing standard sbin is added')

  for (const expected of POSIX_SANE_PATH_ENTRIES) {
    assert.ok(entries.includes(expected), `${expected} should be present`)
  }
})

test('managed Node dirs lead with the platform-native layout but always offer both', () => {
  const posix = work4youManagedNodePathEntries('/Users/test/.work4you', {
    platform: 'darwin',
    pathModule: path.posix
  })

  const windows = work4youManagedNodePathEntries('C:\\Users\\test\\AppData\\Local\\work4you', {
    platform: 'win32',
    pathModule: path.win32
  })

  // install.sh uses node/bin; install.ps1 unpacks node.exe into node\ itself.
  // Both shapes are always emitted so migrated installs keep resolving.
  assert.deepEqual(posix, ['/Users/test/.work4you/node/bin', '/Users/test/.work4you/node'])
  assert.deepEqual(windows, [
    'C:\\Users\\test\\AppData\\Local\\work4you\\node',
    'C:\\Users\\test\\AppData\\Local\\work4you\\node\\bin'
  ])
})

test('managed Node dirs are empty without a Work4You home', () => {
  assert.deepEqual(work4youManagedNodePathEntries(undefined, { platform: 'darwin', pathModule: path.posix }), [])
  assert.deepEqual(work4youManagedNodePathEntries('', { platform: 'win32', pathModule: path.win32 }), [])
})

test('every managed Node dir outranks the inherited PATH on both platforms', () => {
  for (const [platform, pathModule, home, inherited, delimiter] of [
    ['darwin', path.posix, '/Users/test/.work4you', '/usr/local/bin:/usr/bin', ':'],
    ['win32', path.win32, 'C:\\work4you', 'C:\\Program Files\\nodejs;C:\\Windows\\System32', ';']
  ] as const) {
    const entries = buildDesktopBackendPath({
      work4youHome: home,
      venvRoot: null,
      currentPath: inherited,
      platform,
      pathModule
    }).split(delimiter)

    const managed = work4youManagedNodePathEntries(home, { platform, pathModule })
    const firstInherited = Math.min(...inherited.split(delimiter).map(entry => entries.indexOf(entry)))

    for (const dir of managed) {
      assert.ok(
        entries.indexOf(dir) >= 0 && entries.indexOf(dir) < firstInherited,
        `${dir} must precede the inherited PATH on ${platform}`
      )
    }
  }
})

test('desktop backend PATH preserves first occurrence and avoids duplicates', () => {
  const result = buildDesktopBackendPath({
    work4youHome: '/Users/test/.work4you',
    venvRoot: '/Users/test/.work4you/work4you/venv',
    currentPath: '/opt/homebrew/bin:/usr/bin:/opt/homebrew/bin:/bin',
    platform: 'darwin',
    pathModule: path.posix
  })

  const entries = result.split(':')
  assert.equal(entries.filter(entry => entry === '/opt/homebrew/bin').length, 1)
  assert.ok(
    entries.indexOf('/opt/homebrew/bin') < entries.indexOf('/opt/homebrew/sbin'),
    'existing Homebrew bin keeps its precedence over appended missing sane entries'
  )
})

test('buildDesktopBackendEnv extends PYTHONPATH and backend PATH together', () => {
  const env = buildDesktopBackendEnv({
    work4youHome: '/Users/test/.work4you',
    pythonPathEntries: ['/repo/work4you'],
    venvRoot: '/Users/test/.work4you/work4you/venv',
    currentEnv: {
      PATH: '/usr/bin:/bin',
      PYTHONPATH: '/existing/pythonpath'
    },
    platform: 'darwin',
    pathModule: path.posix
  })

  assert.equal(env.PYTHONPATH, '/repo/work4you:/existing/pythonpath')
  assert.ok(
    env.PATH.startsWith(
      '/Users/test/.work4you/node/bin:/Users/test/.work4you/node:/Users/test/.work4you/work4you/venv/bin:'
    )
  )
  assert.ok(env.PATH.includes('/opt/homebrew/bin'))
})

test('buildDesktopBackendEnv forces PYTHONUTF8 unless the user set it explicitly', () => {
  const defaulted = buildDesktopBackendEnv({
    work4youHome: '/Users/test/.work4you',
    currentEnv: { PATH: '/usr/bin' },
    platform: 'darwin',
    pathModule: path.posix
  })

  assert.equal(defaulted.PYTHONUTF8, '1')

  const optedOut = buildDesktopBackendEnv({
    work4youHome: '/Users/test/.work4you',
    currentEnv: { PATH: '/usr/bin', PYTHONUTF8: '0' },
    platform: 'darwin',
    pathModule: path.posix
  })

  assert.equal(optedOut.PYTHONUTF8, '0')
})

test('normalizeWork4YouHomeRoot maps profile homes back to the global Work4You root', () => {
  assert.equal(
    normalizeWork4YouHomeRoot('/Users/test/.work4you/profiles/oracle', { pathModule: path.posix }),
    '/Users/test/.work4you'
  )
  assert.equal(
    normalizeWork4YouHomeRoot('C:\\Users\\test\\AppData\\Local\\work4you\\profiles\\oracle', {
      pathModule: path.win32
    }),
    'C:\\Users\\test\\AppData\\Local\\work4you'
  )
  assert.equal(normalizeWork4YouHomeRoot('/Users/test/.work4you', { pathModule: path.posix }), '/Users/test/.work4you')
})

test('Windows PATH casing and delimiter are preserved without POSIX sane entries', () => {
  const env = buildDesktopBackendEnv({
    work4youHome: 'C:\\Users\\test\\AppData\\Local\\work4you',
    pythonPathEntries: ['C:\\repo\\work4you'],
    venvRoot: 'C:\\Users\\test\\AppData\\Local\\work4you\\work4you\\venv',
    currentEnv: {
      Path: 'C:\\Windows\\System32;C:\\Windows',
      PYTHONPATH: 'C:\\existing\\pythonpath'
    },
    platform: 'win32',
    pathModule: path.win32
  })

  assert.equal(pathEnvKey({ Path: 'x' }, 'win32'), 'Path')
  assert.equal(env.PATH, undefined)
  // Windows leads with the portable layout (install.ps1 unpacks node.exe
  // straight into node\, no bin\), then the POSIX shape for migrated installs.
  assert.ok(
    env.Path.startsWith(
      'C:\\Users\\test\\AppData\\Local\\work4you\\node;C:\\Users\\test\\AppData\\Local\\work4you\\node\\bin;'
    )
  )
  assert.ok(env.Path.includes('\\venv\\Scripts;'))
  assert.ok(env.Path.includes(';C:\\Windows\\System32;C:\\Windows'))
  assert.equal(env.Path.includes('/opt/homebrew/bin'), false)
})

test('appendUniquePathEntries drops empty entries and keeps first occurrence', () => {
  assert.equal(appendUniquePathEntries([':/a::/b', ['/a', '/c']], { delimiter: ':' }), '/a:/b:/c')
})
