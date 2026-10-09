/**
 * Tests for electron/packaged-installer-update.ts — packaged Windows/macOS
 * installs download the complete Work4You-Setup.exe (Windows) or DMG (macOS)
 * instead of updating an independent checkout with `work4you update`.
 *
 * Run with: npx vitest run --project electron electron/packaged-installer-update.test.ts
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import type https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'

import { test } from 'vitest'

import {
  checkPackagedInstallerUpdate,
  compareStampToRelease,
  downloadHttpsToFile,
  downloadProgressPercent,
  githubCommitApiUrl,
  githubLatestReleaseApiUrl,
  isDesktopReleaseTag,
  isGitSha,
  NSIS_SILENT_UPDATE_FLAGS,
  nsisSilentArgs,
  nsisSilentCommandLine,
  PACKAGED_WINDOWS_CHROME_HANDOFF_PS1,
  PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1,
  packagedDownloadPartPath,
  packagedInstallerApplySpawn,
  packagedInstallerAssetName,
  packagedInstallerSpawn,
  packagedWindowsChromeHandoffExtraArgs,
  packagedWindowsHandoffExtraArgs,
  parseCommitSha,
  parseGithubRelease,
  parseRuntimeFingerprint,
  readInstalledRuntimeFingerprint,
  replaceDownloadedFile,
  resolveInstallerDownloadUrl,
  resolvePackagedInstallerApplyPlan,
  sameGitCommit,
  selectReleaseAsset,
  shouldUsePackagedInstallerUpdate,
  WINDOWS_CHROME_ZIP_ASSET,
  WINDOWS_SETUP_ASSET,
  writePackagedWindowsChromeHandoffScript,
  writePackagedWindowsHandoffScript
} from './packaged-installer-update'

const LATEST_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const STAMP_SHA = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const MATCHING_FINGERPRINT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const OTHER_FINGERPRINT = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function fingerprintAsset() {
  return {
    name: 'runtime-win-x64.fingerprint',
    browser_download_url:
      'https://github.com/Leow4u/FORK-56/releases/download/desktop-v0.0.27/runtime-win-x64.fingerprint',
    size: 65,
    state: 'uploaded'
  }
}

function updateAsset() {
  return {
    name: WINDOWS_SETUP_ASSET,
    browser_download_url: 'https://github.com/Leow4u/FORK-56/releases/download/desktop-v0.0.27/Work4You-Update.exe',
    size: 110_000_000,
    state: 'uploaded'
  }
}

function chromeAssets() {
  return [
    {
      name: WINDOWS_CHROME_ZIP_ASSET,
      browser_download_url: 'https://github.com/Leow4u/FORK-56/releases/download/desktop-v0.0.27/Work4You-win-x64.zip',
      size: 70_000_000,
      state: 'uploaded'
    },
    fingerprintAsset()
  ]
}

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
  assert.deepEqual(compareStampToRelease({ stampCommit: STAMP_SHA, releaseSha: LATEST_SHA, compareBehind: 0 }), {
    updateAvailable: false,
    behind: 0
  })
})

test('compareStampToRelease: compareBehind > 0 offers the installer', () => {
  assert.deepEqual(compareStampToRelease({ stampCommit: STAMP_SHA, releaseSha: LATEST_SHA, compareBehind: 12 }), {
    updateAvailable: true,
    behind: 12
  })
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
      args: ['/S', '--updated', '--force-run', '/D=C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You']
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

test.skipIf(process.platform !== 'win32')('the generated handoff parses with native Windows PowerShell', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w4y-handoff-parse-'))

  try {
    const script = writePackagedWindowsHandoffScript(tmp)
    const literal = script.replace(/'/g, "''")
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$tokens = $null; $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${literal}', [ref]$tokens, [ref]$errors); if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }`
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 30_000 }
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('all handoff receipt reads explicitly decode the UTF-8 written by Node', () => {
  const reads = PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1.split('\n').filter(line => line.includes('Get-Content'))
  assert.ok(reads.length > 0)

  for (const read of reads) {
    assert.match(read, /-Encoding UTF8\b/, read)
  }
})

test.skipIf(process.platform !== 'win32')('native receipt rewrites preserve Unicode user and installer paths', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w4y-handoff-unicode-'))

  try {
    const statePath = path.join(tmp, 'state.json')
    const installerPath = 'C:\\Users\\João\\更新\\Work4You-Setup.exe'
    fs.writeFileSync(
      statePath,
      JSON.stringify({ attemptId: 'unicode', stage: 'pending', updatedAt: '', installerPath }),
      'utf8'
    )
    const start = PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1.indexOf('function Read-UpdateState')
    const end = PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1.indexOf('function Test-DesktopRunning')
    const scriptPath = path.join(tmp, 'receipt-roundtrip.ps1')
    fs.writeFileSync(
      scriptPath,
      [
        'param([string]$StatePath)',
        "$ErrorActionPreference = 'Stop'",
        "$AttemptId = 'unicode'",
        "$updaterStartMarker = 'win:123'",
        '$installer = $null',
        PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1.slice(start, end),
        "Write-UpdateState 'ready'"
      ].join('\n'),
      'utf8'
    )
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-StatePath', statePath],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000
      }
    )
    const rewritten = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    assert.equal(rewritten.stage, 'ready')
    assert.equal(rewritten.installerPath, installerPath)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('Windows handoff script carries the same NSIS flags and waits for the desktop PID', () => {
  for (const flag of NSIS_SILENT_UPDATE_FLAGS) {
    assert.ok(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1.includes(flag), `handoff script must pass NSIS flag ${flag}`)
  }

  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /Get-Process -Id \$DesktopPid/)
  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /Win32_Process/)
  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /Start-DesktopDetached/)
  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /Hide-HandoffConsole/)
  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /GetConsoleWindow/)
  assert.match(PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, /ShowWindow/)
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

test('checkPackagedInstallerUpdate offers the complete installer when the stamp is behind Latest', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: STAMP_SHA,
    platform: 'win32',
    now: () => 1_700_000_000_000,
    fetchJson: async url => {
      assert.equal(url, githubLatestReleaseApiUrl())

      return releasePayload({
        assets: [...(releasePayload().assets as object[]), updateAsset(), ...chromeAssets()]
      })
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

test('checkPackagedInstallerUpdate refuses an incomplete release without the platform installer', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: STAMP_SHA,
    platform: 'win32',
    fetchJson: async () => releasePayload({ assets: [] }),
    compareBehind: async () => 4
  })

  assert.equal(result.supported, false)
  assert.equal(result.reason, 'installer-asset-missing')
  assert.equal(result.updateAvailable, undefined)
  assert.equal(result.behind, undefined)
})

test('the complete Setup release is sufficient without a second update asset', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: STAMP_SHA,
    platform: 'win32',
    fetchJson: async () => releasePayload(),
    compareBehind: async () => 4
  })

  assert.equal(result.updateAvailable, true)
  assert.equal(result.behind, 4)
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

test('apply pins the complete Setup asset to the release already offered', async () => {
  const urls: string[] = []

  const plan = await resolvePackagedInstallerApplyPlan({
    platform: 'win32',
    releaseTag: 'desktop-v0.0.27',
    fetchJson: async url => {
      urls.push(url)

      return releasePayload()
    }
  })

  assert.equal(plan.assetName, WINDOWS_SETUP_ASSET)
  assert.match(plan.downloadUrl, /releases\/download\/desktop-v0.0.27\/Work4You-Setup\.exe$/)
  assert.equal(plan.releaseSha, LATEST_SHA)
  assert.deepEqual(urls, ['https://api.github.com/repos/Leow4u/FORK-56/releases/tags/desktop-v0.0.27'])
})

test('apply rejects a different release instead of silently switching a prepared update', async () => {
  await assert.rejects(
    () =>
      resolvePackagedInstallerApplyPlan({
        platform: 'win32',
        releaseTag: 'desktop-v0.0.27',
        fetchJson: async () => releasePayload({ tag_name: 'desktop-v0.0.28' })
      }),
    /release changed/
  )
})

test('apply refuses a moving site fallback if the pinned installer is absent', async () => {
  await assert.rejects(
    () =>
      resolvePackagedInstallerApplyPlan({
        platform: 'win32',
        fetchJson: async () => releasePayload({ assets: [] })
      }),
    /Work4You-Setup\.exe/
  )
})

test('apply resolves a release tag commit and passes through the GitHub asset digest', async () => {
  const sha256 = 'c'.repeat(64)

  const plan = await resolvePackagedInstallerApplyPlan({
    platform: 'win32',
    fetchJson: async url =>
      url.includes('/commits/')
        ? { sha: LATEST_SHA }
        : releasePayload({
            target_commitish: 'main',
            assets: [{ ...releasePayload().assets[0], digest: 'sha256:' + sha256, id: 123 }]
          })
  })

  assert.equal(plan.releaseSha, LATEST_SHA)
  assert.equal(plan.sha256, sha256)
  assert.equal(plan.assetId, 123)
})

test('parseRuntimeFingerprint accepts 64 hex and rejects junk', () => {
  assert.equal(parseRuntimeFingerprint(MATCHING_FINGERPRINT), MATCHING_FINGERPRINT)
  assert.equal(parseRuntimeFingerprint(`  ${MATCHING_FINGERPRINT.toUpperCase()}\n`), MATCHING_FINGERPRINT)
  assert.equal(parseRuntimeFingerprint('not-a-fingerprint'), null)
  assert.equal(parseRuntimeFingerprint(''), null)
})

test('readInstalledRuntimeFingerprint reads HOME/work4you/.runtime-fingerprint', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w4y-fp-'))

  try {
    const dest = path.join(tmp, 'work4you')
    fs.mkdirSync(dest)
    fs.writeFileSync(path.join(dest, '.runtime-fingerprint'), `${MATCHING_FINGERPRINT}\n`)
    assert.equal(readInstalledRuntimeFingerprint(tmp), MATCHING_FINGERPRINT)
    assert.equal(readInstalledRuntimeFingerprint(path.join(tmp, 'missing')), null)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('resolvePackagedInstallerApplyPlan stays on the DMG on macOS even if Update.exe exists', async () => {
  const plan = await resolvePackagedInstallerApplyPlan({
    platform: 'darwin',
    localFingerprint: MATCHING_FINGERPRINT,
    fetchJson: async () =>
      releasePayload({
        assets: [...(releasePayload().assets as object[]), updateAsset(), ...chromeAssets()]
      }),
    fetchText: async () => MATCHING_FINGERPRINT
  })

  assert.equal(plan.kind, 'installer')
  assert.match(plan.downloadUrl, /Work4You\.dmg$/)
})

test('checkPackagedInstallerUpdate stays on the installer channel when Update.exe is published', async () => {
  const result = await checkPackagedInstallerUpdate({
    stampCommit: STAMP_SHA,
    platform: 'win32',
    fetchJson: async () =>
      releasePayload({
        assets: [...(releasePayload().assets as object[]), updateAsset()]
      }),
    compareBehind: async () => 2
  })

  assert.equal(result.channel, 'installer')
  assert.equal(result.updateAvailable, true)
})

test('packagedInstallerApplySpawn uses chrome handoff args when kind is chrome', () => {
  const scriptPath = 'C:\\Temp\\work4you-packaged-chrome-handoff.ps1'
  const zipPath = 'C:\\Temp\\Work4You-win-x64.zip'
  const extractedDir = 'C:\\Temp\\chrome-extracted'
  const installDir = 'C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You'
  const relaunchExe = 'C:\\Users\\Ada\\AppData\\Local\\Programs\\Work4You\\Work4You.exe'

  const spawned = packagedInstallerApplySpawn({
    platform: 'win32',
    installerPath: zipPath,
    installDir,
    desktopPid: 4242,
    relaunchExe,
    handoffScriptPath: scriptPath,
    kind: 'chrome',
    extractedDir
  })

  assert.equal(spawned.command, 'cmd.exe')
  assert.deepEqual(
    spawned.args.slice(-10),
    packagedWindowsChromeHandoffExtraArgs({
      desktopPid: 4242,
      extractedDir,
      chromeZipPath: zipPath,
      installDir,
      relaunchExe
    })
  )
  assert.ok(spawned.args.includes('-ExtractedDir'))
  assert.ok(!spawned.args.some(arg => arg.startsWith('/D=')))
  assert.ok(!spawned.args.includes('-InstallerPath'))
})

test('chrome handoff extra args omit ExtractedDir when the tree was not unpacked', () => {
  const args = packagedWindowsChromeHandoffExtraArgs({
    desktopPid: 7,
    chromeZipPath: 'C:\\Temp\\Work4You-win-x64.zip',
    installDir: 'C:\\Prog\\Work4You',
    relaunchExe: 'C:\\Prog\\Work4You\\Work4You.exe'
  })

  assert.ok(!args.includes('-ExtractedDir'))
  assert.ok(args.includes('-ChromeZipPath'))
})

test('writePackagedWindowsChromeHandoffScript writes the overlay orchestrator', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w4y-chrome-handoff-'))

  try {
    const dest = writePackagedWindowsChromeHandoffScript(tmp)
    assert.equal(dest, path.join(tmp, 'work4you-packaged-chrome-handoff.ps1'))
    assert.equal(fs.readFileSync(dest, 'utf8'), PACKAGED_WINDOWS_CHROME_HANDOFF_PS1)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('Windows chrome handoff overlays an extracted tree and does not run NSIS or wipe runtime', () => {
  assert.match(PACKAGED_WINDOWS_CHROME_HANDOFF_PS1, /Copy-ChromeOverlay/)
  assert.match(PACKAGED_WINDOWS_CHROME_HANDOFF_PS1, /robocopy/)
  assert.match(PACKAGED_WINDOWS_CHROME_HANDOFF_PS1, /ZipFile/)
  assert.match(PACKAGED_WINDOWS_CHROME_HANDOFF_PS1, /Wait-Process/)
  assert.match(PACKAGED_WINDOWS_CHROME_HANDOFF_PS1, /Start-DesktopDetached/)
  assert.match(PACKAGED_WINDOWS_CHROME_HANDOFF_PS1, /Hide-HandoffConsole/)
  assert.ok(!PACKAGED_WINDOWS_CHROME_HANDOFF_PS1.includes('Expand-Archive'))
  assert.ok(!PACKAGED_WINDOWS_CHROME_HANDOFF_PS1.includes('/MIR'))
  assert.ok(!PACKAGED_WINDOWS_CHROME_HANDOFF_PS1.includes('/S'))
  assert.ok(!PACKAGED_WINDOWS_CHROME_HANDOFF_PS1.includes('--force-run'))
  assert.ok(!PACKAGED_WINDOWS_CHROME_HANDOFF_PS1.includes('deploy-desktop-runtime'))
  assert.ok(!PACKAGED_WINDOWS_CHROME_HANDOFF_PS1.includes('Remove-Item -LiteralPath $InstallDir'))
})

test('isGitSha rejects empty and branch names', () => {
  assert.equal(isGitSha(''), false)
  assert.equal(isGitSha('main'), false)
  assert.equal(isGitSha(LATEST_SHA), true)
})

test('replaceDownloadedFile overwrites a leftover dest instead of failing rename', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w4y-replace-'))

  try {
    const dest = path.join(dir, WINDOWS_SETUP_ASSET)
    const part = packagedDownloadPartPath(dest)
    fs.writeFileSync(dest, 'old leftover installer')
    fs.writeFileSync(part, 'new signed installer')
    replaceDownloadedFile(part, dest, { delayMs: 0 })
    assert.equal(fs.readFileSync(dest, 'utf8'), 'new signed installer')
    assert.equal(fs.existsSync(part), false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('replaceDownloadedFile retries a locked dest then keeps the part on failure', () => {
  const dest = `C:\\Temp\\${WINDOWS_SETUP_ASSET}`
  const part = packagedDownloadPartPath(dest)
  let unlinks = 0
  const existing = new Set([dest, part])

  assert.throws(
    () =>
      replaceDownloadedFile(part, dest, {
        delayMs: 0,
        retries: 3,
        exists: file => existing.has(file),
        unlink: file => {
          if (file === dest) {
            unlinks += 1
            throw Object.assign(new Error('EPERM: operation not permitted, unlink'), { code: 'EPERM' })
          }

          existing.delete(file)
        },
        rename: () => {
          throw new Error('rename must not run while dest is locked')
        }
      }),
    /file in use from a previous update/
  )
  assert.equal(unlinks, 3)
  assert.ok(existing.has(part))
})

test('replaceDownloadedFile copies when rename fails after dest is gone', () => {
  const dest = '/tmp/Work4You-Setup.exe'
  const part = packagedDownloadPartPath(dest)
  const existing = new Set([dest, part])
  const copied: string[] = []

  replaceDownloadedFile(part, dest, {
    delayMs: 0,
    exists: file => existing.has(file),
    unlink: file => {
      existing.delete(file)
    },
    rename: () => {
      throw new Error('EXDEV')
    },
    copy: (from, to) => {
      copied.push(`${from}->${to}`)
      existing.add(to)
    }
  })

  assert.deepEqual(copied, [`${part}->${dest}`])
  assert.equal(existing.has(part), false)
  assert.equal(existing.has(dest), true)
})

test('downloadHttpsToFile replaces an existing dest instead of EPERM rename', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w4y-dl-'))
  const dest = path.join(dir, WINDOWS_SETUP_ASSET)
  const body = Buffer.from('new signed installer')
  fs.writeFileSync(dest, 'old leftover installer')

  const get = ((_url: string, options: unknown, cb?: (res: NodeJS.ReadableStream) => void) => {
    const callback = typeof options === 'function' ? options : cb

    const req = {
      on() {
        return req
      },
      destroy() {
        return undefined
      }
    }

    const res = new PassThrough() as InstanceType<typeof PassThrough> & {
      statusCode: number
      headers: Record<string, string>
    }

    res.statusCode = 200
    res.headers = { 'content-length': String(body.length) }
    queueMicrotask(() => {
      callback?.(res)
      res.end(body)
    })

    return req
  }) as unknown as typeof https.get

  try {
    await downloadHttpsToFile('https://example.test/Work4You-Setup.exe', dest, { get })
    assert.equal(fs.readFileSync(dest, 'utf8'), 'new signed installer')
    assert.equal(fs.existsSync(packagedDownloadPartPath(dest)), false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
