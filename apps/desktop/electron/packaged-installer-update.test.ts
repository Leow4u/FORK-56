/**
 * Tests for electron/packaged-installer-update.ts — packaged Windows/macOS
 * installs download the published Setup.exe / DMG instead of `work4you update`.
 *
 * Run with: npx vitest run --project electron electron/packaged-installer-update.test.ts
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import {
  checkPackagedInstallerUpdate,
  compareStampToRelease,
  downloadProgressPercent,
  githubCommitApiUrl,
  githubLatestReleaseApiUrl,
  isDesktopReleaseTag,
  isGitSha,
  nsisSilentArgs,
  nsisSilentCommandLine,
  NSIS_SILENT_UPDATE_FLAGS,
  PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1,
  packagedInstallerApplySpawn,
  packagedInstallerAssetName,
  packagedInstallerSpawn,
  packagedWindowsHandoffExtraArgs,
  parseCommitSha,
  parseGithubRelease,
  resolveInstallerDownloadUrl,
  resolvePackagedInstallerApplyPlan,
  sameGitCommit,
  selectReleaseAsset,
  shouldUsePackagedInstallerUpdate,
  writePackagedWindowsHandoffScript,
  WINDOWS_SETUP_ASSET
} from './packaged-installer-update'

const LATEST_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const STAMP_SHA = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function releasePayload(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'desktop-v0.0.27',
    target_commitish: LATEST_SHA,
    draft: false,
    prerelease: false,
    assets: [
      {
        name: 'Work4You-Setup.exe',
        browser_download_url: 'https://github.com/Leow4u/FORK-56/releases/download/desktop-v0.0.27/Work4You-Setup.exe',
        size: 180_000_000,
        state: 'uploaded'
      },
      {
        name: 'Work4You.dmg',
        browser_download_url: 'https://github.com/Leow4u/FORK-56/releases/download/desktop-v0.0.27/Work4You.dmg',
        size: 160_000_000,
        state: 'uploaded'
      }
    ],
    ...overrides
  }
}

test('shouldUsePackagedInstallerUpdate is packaged Windows/macOS only', () => {
  assert.equal(shouldUsePackagedInstallerUpdate({ isPackaged: true, platform: 'win32' }), true)
  assert.equal(shouldUsePackagedInstallerUpdate({ isPackaged: true, platform: 'darwin' }), true)
  assert.equal(shouldUsePackagedInstallerUpdate({ isPackaged: true, platform: 'linux' }), false)
  assert.equal(shouldUsePackagedInstallerUpdate({ isPackaged: false, platform: 'win32' }), false)
  assert.equal(shouldUsePackagedInstallerUpdate({ isPackaged: false, platform: 'darwin' }), false)
})

test('packagedInstallerAssetName matches published GitHub asset names', () => {
  assert.equal(packagedInstallerAssetName('win32'), 'Work4You-Setup.exe')
  assert.equal(packagedInstallerAssetName('darwin'), 'Work4You.dmg')
  assert.equal(packagedInstallerAssetName('linux'), null)
})

test('isDesktopReleaseTag accepts only desktop-vX.Y.Z', () => {
  assert.equal(isDesktopReleaseTag('desktop-v0.0.27'), true)
  assert.equal(isDesktopReleaseTag('v0.0.27'), false)
  assert.equal(isDesktopReleaseTag('v0.17.0'), false)
  assert.equal(isDesktopReleaseTag('latest'), false)
})

test('sameGitCommit matches full SHA to prefix and is case-insensitive', () => {
  assert.equal(sameGitCommit(LATEST_SHA, LATEST_SHA.slice(0, 12)), true)
  assert.equal(sameGitCommit(LATEST_SHA.toUpperCase(), LATEST_SHA), true)
  assert.equal(sameGitCommit(LATEST_SHA, STAMP_SHA), false)
  assert.equal(sameGitCommit('main', LATEST_SHA), false)
  assert.equal(sameGitCommit('0000000000000000000000000000000000000000', LATEST_SHA), false)
})

test('parseGithubRelease rejects drafts, prereleases, and non-desktop tags', () => {
  assert.equal(parseGithubRelease(releasePayload({ draft: true })), null)
  assert.equal(parseGithubRelease(releasePayload({ prerelease: true })), null)
  assert.equal(parseGithubRelease(releasePayload({ tag_name: 'v1.2.3' })), null)

  const parsed = parseGithubRelease(releasePayload())
  assert.ok(parsed)
  assert.equal(parsed.tag, 'desktop-v0.0.27')
  assert.equal(parsed.targetCommitish, LATEST_SHA)
  assert.equal(selectReleaseAsset(parsed, WINDOWS_SETUP_ASSET)?.name, WINDOWS_SETUP_ASSET)
})

test('parseCommitSha reads the commits API sha field', () => {
  assert.equal(parseCommitSha({ sha: LATEST_SHA }), LATEST_SHA)
  assert.equal(parseCommitSha({ sha: 'main' }), null)
})

test('compareStampToRelease: identical stamp is up to date', () => {
  assert.deepEqual(compareStampToRelease({ stampCommit: LATEST_SHA, releaseSha: LATEST_SHA }), {
    updateAvailable: false,
    behind: 0
  })
})

test('compareStampToRelease: compareBehind 0 means stamp is not behind (local pack ahead)', () => {
  assert.deepEqual(
    compareStampToRelease({ stampCommit: STAMP_SHA, releaseSha: LATEST_SHA, compareBehind: 0 }),
    { updateAvailable: false, behind: 0 }
  )
})

test('compareStampToRelease: compareBehind > 0 offers the installer', () => {
  assert.deepEqual(
    compareStampToRelease({ stampCommit: STAMP_SHA, releaseSha: LATEST_SHA, compareBehind: 12 }),
    { updateAvailable: true, behind: 12 }
  )
})

test('compareStampToRelease: differing SHAs without a compare count stay honest (null behind)', () => {
  assert.deepEqual(compareStampToRelease({ stampCommit: STAMP_SHA, releaseSha: LATEST_SHA }), {
    updateAvailable: true,
    behind: null
  })
})

test('compareStampToRelease: missing stamp still offers Latest (cannot prove current)', () => {
  assert.deepEqual(compareStampToRelease({ stampCommit: null, releaseSha: LATEST_SHA }), {
    updateAvailable: true,
    behind: null
  })
})

test('nsisSilentArgs puts --force-run before unquoted /D', () => {
  assert.deepEqual(nsisSilentArgs(null), ['/S', '--updated', '--force-run'])
  assert.deepEqual(nsisSilentArgs('C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You'), [
    '/S',
    '--updated',
    '--force-run',
    '/D=C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You'
  ])
  assert.deepEqual(nsisSilentArgs('C:\\Program Files\\Work4You'), [
    '/S',
    '--updated',
    '--force-run',
    '/D=C:\\Program Files\\Work4You'
  ])
  assert.equal(
    nsisSilentCommandLine('C:\\Program Files\\Work4You'),
    '/S --updated --force-run /D=C:\\Program Files\\Work4You'
  )
})

test('packagedInstallerSpawn uses silent NSIS on Windows and open on macOS', () => {
  assert.deepEqual(
    packagedInstallerSpawn({
      platform: 'win32',
      installerPath: 'C:\\Temp\\Work4You-Setup.exe',
      installDir: 'C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You'
    }),
    {
      command: 'C:\\Temp\\Work4You-Setup.exe',
      args: [
        '/S',
        '--updated',
        '--force-run',
        '/D=C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You'
      ]
    }
  )
  assert.deepEqual(packagedInstallerSpawn({ platform: 'darwin', installerPath: '/tmp/Work4You.dmg' }), {
    command: '/usr/bin/open',
    args: ['/tmp/Work4You.dmg']
  })
})

test('packagedInstallerApplySpawn waits then relaunches on Windows via cmd start', () => {
  const scriptPath = 'C:\\Temp\\work4you-packaged-installer-handoff.ps1'
  const installerPath = 'C:\\Temp\\Work4You-Setup.exe'
  const installDir = 'C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You'
  const relaunchExe = 'C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You\\Work4You.exe'
  const spawned = packagedInstallerApplySpawn({
    platform: 'win32',
    installerPath,
    installDir,
    desktopPid: 4242,
    relaunchExe,
    handoffScriptPath: scriptPath
  })

  assert.equal(spawned.command, 'cmd.exe')
  assert.deepEqual(spawned.args, [
    '/d',
    '/s',
    '/c',
    'start',
    '',
    '/min',
    'powershell',
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...packagedWindowsHandoffExtraArgs({
      desktopPid: 4242,
      installerPath,
      installDir,
      relaunchExe
    })
  ])
  assert.equal(spawned.args.at(-1), installDir)
  assert.ok(!spawned.args.some(arg => arg.startsWith('/D=')))
})

test('packagedInstallerApplySpawn still opens the DMG on macOS', () => {
  assert.deepEqual(
    packagedInstallerApplySpawn({
      platform: 'darwin',
      installerPath: '/tmp/Work4You.dmg',
      desktopPid: 1,
      relaunchExe: '/Applications/Work4You.app',
      handoffScriptPath: '/tmp/unused.ps1'
    }),
    {
      command: '/usr/bin/open',
      args: ['/tmp/Work4You.dmg']
    }
  )
})

test('writePackagedWindowsHandoffScript writes the orchestrator next to the installer', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w4y-handoff-'))

  try {
    const dest = writePackagedWindowsHandoffScript(tmp)
    assert.equal(dest, path.join(tmp, 'work4you-packaged-installer-handoff.ps1'))
    assert.equal(fs.readFileSync(dest, 'utf8'), PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('Windows handoff script carries the same NSIS flags and waits for the desktop PID', () => {
  for (const flag of NSIS_SILENT_UPDATE_FLAGS) {
    assert.ok(
      PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1.includes(flag),
      `handoff script must pass NSIS flag ${flag}`
    )
  }

  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /Wait-Process/)
  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /Win32_Process/)
  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /Start-DesktopDetached/)
})

test('downloadProgressPercent leaves headroom under 100 until spawn', () => {
  assert.equal(downloadProgressPercent(0, 100), 1)
  assert.equal(downloadProgressPercent(50, 100), 45)
  assert.equal(downloadProgressPercent(100, 100), 90)
  assert.equal(downloadProgressPercent(10, null), null)
})

test('resolveInstallerDownloadUrl prefers the GitHub asset, then work4you.ai', () => {
  const parsed = parseGithubRelease(releasePayload())
  assert.ok(parsed)
  const asset = selectReleaseAsset(parsed, WINDOWS_SETUP_ASSET)
  assert.equal(
    resolveInstallerDownloadUrl({ platform: 'win32', asset }),
    'https://github.com/Leow4u/FORK-56/releases/download/desktop-v0.0.27/Work4You-Setup.exe'
  )
  assert.equal(
    resolveInstallerDownloadUrl({ platform: 'win32', asset: null }),
    'https://work4you.ai/downloads/Work4You-Setup.exe'
  )
})

test('checkPackagedInstallerUpdate offers an update when the stamp is behind Latest', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: STAMP_SHA,
    platform: 'win32',
    now: () => 1_700_000_000_000,
    fetchJson: async url => {
      assert.equal(url, githubLatestReleaseApiUrl())

      return releasePayload()
    },
    compareBehind: async (current, target) => {
      assert.equal(current, STAMP_SHA)
      assert.equal(target, LATEST_SHA)

      return 4
    }
  })

  assert.equal(result.supported, true)
  assert.equal(result.channel, 'installer')
  assert.equal(result.updateAvailable, true)
  assert.equal(result.behind, 4)
  assert.equal(result.currentSha, STAMP_SHA)
  assert.equal(result.targetSha, LATEST_SHA)
  assert.equal(result.releaseTag, 'desktop-v0.0.27')
  assert.deepEqual(result.commits, [])
})

test('checkPackagedInstallerUpdate is up to date when stamp matches Latest', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: LATEST_SHA,
    platform: 'win32',
    fetchJson: async () => releasePayload(),
    compareBehind: async () => {
      throw new Error('compare should not run when SHAs already match')
    }
  })

  assert.equal(result.updateAvailable, false)
  assert.equal(result.behind, 0)
})

test('checkPackagedInstallerUpdate resolves tag commit when target_commitish is a branch name', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: STAMP_SHA,
    platform: 'darwin',
    fetchJson: async url => {
      if (url === githubLatestReleaseApiUrl()) {
        return releasePayload({ target_commitish: 'main' })
      }

      assert.equal(url, githubCommitApiUrl('Leow4u/FORK-56', 'desktop-v0.0.27'))

      return { sha: LATEST_SHA }
    },
    compareBehind: async () => 1
  })

  assert.equal(result.updateAvailable, true)
  assert.equal(result.targetSha, LATEST_SHA)
  assert.equal(result.releaseTag, 'desktop-v0.0.27')
})

test('checkPackagedInstallerUpdate surfaces fetch-failed when GitHub is down', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: STAMP_SHA,
    platform: 'win32',
    fetchJson: async () => {
      throw new Error('GitHub API 403')
    }
  })

  assert.equal(result.supported, true)
  assert.equal(result.error, 'fetch-failed')
  assert.match(result.message || '', /403/)
})

test('checkPackagedInstallerUpdate is unsupported on Linux even if packaged', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: STAMP_SHA,
    platform: 'linux',
    fetchJson: async () => {
      throw new Error('must not hit the network')
    }
  })

  assert.equal(result.supported, false)
  assert.equal(result.reason, 'no-installer-channel')
})

test('resolvePackagedInstallerApplyPlan returns the Setup.exe URL', async () => {
  const plan = await resolvePackagedInstallerApplyPlan({
    platform: 'win32',
    fetchJson: async () => releasePayload()
  })

  assert.equal(plan.assetName, WINDOWS_SETUP_ASSET)
  assert.match(plan.downloadUrl, /Work4You-Setup\.exe$/)
  assert.equal(plan.releaseTag, 'desktop-v0.0.27')
})

test('isGitSha rejects empty and branch names', () => {
  assert.equal(isGitSha(''), false)
  assert.equal(isGitSha('main'), false)
  assert.equal(isGitSha(LATEST_SHA), true)
})
