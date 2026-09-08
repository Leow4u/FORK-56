import fs from 'node:fs'
import type { IncomingMessage } from 'node:http'
import https from 'node:https'
import path from 'node:path'

import { wrapHandoffForDetachedConsole } from './updater-process'

/**
 * Packaged-app update channel: download the published NSIS/DMG installer
 * instead of running `work4you update` (git pull + uv + electron-builder).
 *
 * .exe/.dmg users already get a complete desktop app from GitHub Latest
 * (`Work4You-Setup.exe` / `Work4You.dmg`). Rebuilding from the cloned runtime
 * takes 10–15 minutes on Windows and still leaves the compiled UI stale until
 * that pack finishes — the published installer is the fast path.
 *
 * Source / CLI installs (`app.isPackaged === false`) keep the git hand-off.
 *
 * Pure helpers live here so check/apply policy is unit-testable without
 * booting Electron. Network + spawn stay with the caller (main.ts).
 */

export const OFFICIAL_GITHUB_REPO = 'Leow4u/FORK-56'

export const DESKTOP_RELEASE_TAG_RE = /^desktop-v(\d+)\.(\d+)\.(\d+)$/

export const GITHUB_API_HEADERS: Readonly<Record<string, string>> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'work4you-desktop-update-check'
}

export const WINDOWS_SETUP_ASSET = 'Work4You-Setup.exe'
export const MACOS_DMG_ASSET = 'Work4You.dmg'

/** Public CDN/site URLs that redirect to GitHub Latest (fallback if the API omits assets). */
export const PUBLIC_INSTALLER_DOWNLOAD: Readonly<Record<'darwin' | 'win32', string>> = {
  darwin: 'https://work4you.ai/downloads/Work4You.dmg',
  win32: 'https://work4you.ai/downloads/Work4You-Setup.exe'
}

const GIT_SHA_RE = /^[0-9a-f]{7,40}$/i
const FALLBACK_COMMIT_RE = /^0{7,40}$/

export type PackagedInstallerPlatform = 'darwin' | 'win32'

export interface GithubReleaseAsset {
  name: string
  browserDownloadUrl: string
  size: number | null
}

export interface ParsedDesktopRelease {
  tag: string
  targetCommitish: string
  assets: GithubReleaseAsset[]
}

export interface PackagedInstallerCheckResult {
  supported: boolean
  channel: 'installer'
  updateAvailable?: boolean
  reason?: string
  message?: string
  error?: string
  behind?: number | null
  currentSha?: string
  targetSha?: string
  releaseTag?: string
  commits?: []
  fetchedAt: number
}

export function isDesktopReleaseTag(tag: unknown): boolean {
  return typeof tag === 'string' && DESKTOP_RELEASE_TAG_RE.test(tag.trim())
}

export function isGitSha(value: unknown): boolean {
  return typeof value === 'string' && GIT_SHA_RE.test(value.trim()) && !FALLBACK_COMMIT_RE.test(value.trim())
}

export function isFallbackCommit(commit: unknown): boolean {
  return typeof commit === 'string' && FALLBACK_COMMIT_RE.test(commit)
}

export function packagedInstallerAssetName(platform: string): string | null {
  if (platform === 'win32') {
    return WINDOWS_SETUP_ASSET
  }

  if (platform === 'darwin') {
    return MACOS_DMG_ASSET
  }

  return null
}

/**
 * Packaged Windows/macOS Electron builds should take the published installer.
 * Linux AppImage/.deb/.rpm keep the git/`work4you update` path (guiSkew).
 * Unpackaged `electron .` / `work4you desktop` from a checkout stay on git.
 */
export function shouldUsePackagedInstallerUpdate(opts: { isPackaged: boolean; platform: string }): boolean {
  return Boolean(opts.isPackaged) && packagedInstallerAssetName(opts.platform) !== null
}

export function githubLatestReleaseApiUrl(repo = OFFICIAL_GITHUB_REPO): string {
  return `https://api.github.com/repos/${repo}/releases/latest`
}

export function githubCommitApiUrl(repo: string, ref: string): string {
  return `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`
}

export function githubLatestDownloadUrl(repo: string, assetName: string): string {
  return `https://github.com/${repo}/releases/latest/download/${assetName}`
}

export function sameGitCommit(a?: string | null, b?: string | null): boolean {
  if (!isGitSha(a) || !isGitSha(b)) {
    return false
  }

  const left = String(a).trim().toLowerCase()
  const right = String(b).trim().toLowerCase()

  return left.startsWith(right) || right.startsWith(left)
}

export function parseGithubRelease(payload: unknown): ParsedDesktopRelease | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const row = payload as {
    draft?: unknown
    prerelease?: unknown
    tag_name?: unknown
    target_commitish?: unknown
    assets?: unknown
  }

  if (row.draft === true || row.prerelease === true) {
    return null
  }

  const tag = typeof row.tag_name === 'string' ? row.tag_name.trim() : ''

  if (!isDesktopReleaseTag(tag)) {
    return null
  }

  const assets: GithubReleaseAsset[] = []

  if (Array.isArray(row.assets)) {
    for (const asset of row.assets) {
      if (!asset || typeof asset !== 'object') {
        continue
      }

      const item = asset as { name?: unknown; browser_download_url?: unknown; size?: unknown; state?: unknown }

      if (item.state && item.state !== 'uploaded') {
        continue
      }

      const name = typeof item.name === 'string' ? item.name : ''
      const browserDownloadUrl = typeof item.browser_download_url === 'string' ? item.browser_download_url : ''

      if (!name || !browserDownloadUrl) {
        continue
      }

      const size = typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : null
      assets.push({ name, browserDownloadUrl, size })
    }
  }

  return {
    tag,
    targetCommitish: typeof row.target_commitish === 'string' ? row.target_commitish.trim() : '',
    assets
  }
}

export function parseCommitSha(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const sha = (payload as { sha?: unknown }).sha

  return isGitSha(sha) ? String(sha).trim().toLowerCase() : null
}

export function selectReleaseAsset(release: ParsedDesktopRelease, assetName: string): GithubReleaseAsset | null {
  const wanted = assetName.toLowerCase()

  return release.assets.find(asset => asset.name.toLowerCase() === wanted) ?? null
}

export function resolveReleaseCommitSha(release: ParsedDesktopRelease): string | null {
  return isGitSha(release.targetCommitish) ? release.targetCommitish.trim().toLowerCase() : null
}

/**
 * NSIS silent flags for a packaged self-update.
 *
 * `/S` skips the assisted finish page, which is also where electron-builder
 * normally launches the app (`MUI_FINISHPAGE_RUN`). Without `--force-run`
 * the assisted installer therefore replaces the files and exits — the window
 * closes and nothing comes back. `--updated` tells CHECK_APP_RUNNING to
 * wait briefly for us to quit instead of killing Work4You.exe immediately.
 * `/D=` must stay last and unquoted even when the path has spaces.
 */
export const NSIS_SILENT_UPDATE_FLAGS = ['/S', '--updated', '--force-run'] as const

export function nsisSilentArgs(installDir?: string | null): string[] {
  const dir = typeof installDir === 'string' ? installDir.trim() : ''

  if (!dir) {
    return [...NSIS_SILENT_UPDATE_FLAGS]
  }

  return [...NSIS_SILENT_UPDATE_FLAGS, `/D=${dir}`]
}

export function nsisSilentCommandLine(installDir?: string | null): string {
  return nsisSilentArgs(installDir).join(' ')
}

export function packagedWindowsHandoffScriptPath(tmpDir: string): string {
  return path.join(tmpDir, 'work4you-packaged-installer-handoff.ps1')
}

export function packagedWindowsHandoffExtraArgs(opts: {
  desktopPid: number
  installerPath: string
  installDir?: string | null
  relaunchExe: string
}): string[] {
  const args = [
    '-DesktopPid',
    String(opts.desktopPid),
    '-InstallerPath',
    opts.installerPath,
    '-RelaunchExe',
    opts.relaunchExe
  ]

  const dir = typeof opts.installDir === 'string' ? opts.installDir.trim() : ''

  if (dir) {
    args.push('-InstallDir', dir)
  }

  return args
}

/**
 * Detached Windows orchestrator: wait for the desktop PID to exit, run
 * silent NSIS, then relaunch Work4You.exe if the installer did not.
 *
 * Lives as a string (written to %TEMP% at apply time) so a packaged asar
 * does not depend on a repo checkout. Spawn it through
 * wrapHandoffForDetachedConsole — a bare hidden powershell.exe dies before
 * -File processing.
 */
export const PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1 = [
  'param(',
  '  [Parameter(Mandatory = $true)][int]$DesktopPid,',
  '  [Parameter(Mandatory = $true)][string]$InstallerPath,',
  '  [Parameter(Mandatory = $true)][string]$RelaunchExe,',
  "  [string]$InstallDir = ''",
  ')',
  "$ErrorActionPreference = 'Stop'",
  'function Test-DesktopRunning([string]$Exe) {',
  '  if (-not $Exe) { return $false }',
  '  try {',
  '    $want = [IO.Path]::GetFullPath($Exe)',
  '    $hit = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |',
  '      Where-Object { $_.ExecutablePath -and ([IO.Path]::GetFullPath($_.ExecutablePath) -eq $want) }',
  '    return [bool]$hit',
  '  } catch {',
  '    return $false',
  '  }',
  '}',
  'function Start-DesktopDetached([string]$Exe) {',
  '  if (-not $Exe -or -not (Test-Path -LiteralPath $Exe)) { return $false }',
  '  $workDir = Split-Path -Parent $Exe',
  '  try {',
  '    $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{',
  '      CommandLine = (\'"{0}"\' -f $Exe)',
  '      CurrentDirectory = $workDir',
  '    } -ErrorAction Stop',
  '    if ($r -and $r.ReturnValue -eq 0) { return $true }',
  '  } catch {}',
  '  try {',
  '    $p = Start-Process -FilePath $Exe -WorkingDirectory $workDir -PassThru',
  '    Start-Sleep -Milliseconds 800',
  '    return ($p -and -not $p.HasExited)',
  '  } catch {',
  '    return $false',
  '  }',
  '}',
  'if ($DesktopPid -gt 0) {',
  '  try { Wait-Process -Id $DesktopPid -Timeout 120 -ErrorAction SilentlyContinue } catch {}',
  '}',
  'Start-Sleep -Seconds 2',
  'if (-not (Test-Path -LiteralPath $InstallerPath)) { throw "installer missing: $InstallerPath" }',
  "$nsis = '/S --updated --force-run'",
  'if ($InstallDir -and $InstallDir.Trim()) {',
  '  $nsis = "/S --updated --force-run /D=$($InstallDir.Trim())"',
  '}',
  '$psi = New-Object System.Diagnostics.ProcessStartInfo',
  '$psi.FileName = $InstallerPath',
  '$psi.Arguments = $nsis',
  '$psi.WorkingDirectory = Split-Path -Parent $InstallerPath',
  '$psi.UseShellExecute = $false',
  '$psi.CreateNoWindow = $true',
  '$installer = [System.Diagnostics.Process]::Start($psi)',
  'if (-not $installer) { throw "failed to start NSIS installer" }',
  '$installer.WaitForExit()',
  '$exeDeadline = (Get-Date).AddSeconds(90)',
  'while (-not (Test-Path -LiteralPath $RelaunchExe)) {',
  '  if ((Get-Date) -ge $exeDeadline) { break }',
  '  Start-Sleep -Milliseconds 400',
  '}',
  '$runDeadline = (Get-Date).AddSeconds(20)',
  'while ((Get-Date) -lt $runDeadline) {',
  '  if (Test-DesktopRunning $RelaunchExe) { exit 0 }',
  '  Start-Sleep -Milliseconds 400',
  '}',
  'if (-not (Start-DesktopDetached $RelaunchExe)) { exit 1 }',
  'exit 0',
  ''
].join('\n')

export function writePackagedWindowsHandoffScript(
  tmpDir: string,
  writeFile: (file: string, contents: string, encoding: BufferEncoding) => void = fs.writeFileSync
): string {
  fs.mkdirSync(tmpDir, { recursive: true })
  const dest = packagedWindowsHandoffScriptPath(tmpDir)
  writeFile(dest, PACKAGED_WINDOWS_INSTALLER_HANDOFF_PS1, 'utf8')

  return dest
}

export function compareStampToRelease(opts: {
  stampCommit?: string | null
  releaseSha?: string | null
  /** GitHub compare `ahead_by` for stamp...release (commits the release is ahead). */
  compareBehind?: number | null
}): { behind: number | null; updateAvailable: boolean } {
  const stamp = isFallbackCommit(opts.stampCommit) ? null : opts.stampCommit
  const releaseSha = opts.releaseSha

  if (sameGitCommit(stamp, releaseSha)) {
    return { updateAvailable: false, behind: 0 }
  }

  if (typeof opts.compareBehind === 'number' && Number.isInteger(opts.compareBehind) && opts.compareBehind >= 0) {
    return {
      updateAvailable: opts.compareBehind > 0,
      behind: opts.compareBehind
    }
  }

  if (isGitSha(stamp) && isGitSha(releaseSha)) {
    // SHAs differ and compare was unknowable — an update exists, count unknown.
    return { updateAvailable: true, behind: null }
  }

  // No stamp (or fallback zeros): cannot prove we already are Latest. Offer
  // the installer so a packaged build without a pin can still refresh.
  if (!isGitSha(stamp) && isGitSha(releaseSha)) {
    return { updateAvailable: true, behind: null }
  }

  if (!isGitSha(releaseSha)) {
    return { updateAvailable: true, behind: null }
  }

  return { updateAvailable: true, behind: null }
}

export function resolveInstallerDownloadUrl(opts: {
  platform: string
  asset: GithubReleaseAsset | null
  repo?: string
}): string | null {
  if (opts.asset?.browserDownloadUrl) {
    return opts.asset.browserDownloadUrl
  }

  const assetName = packagedInstallerAssetName(opts.platform)

  if (!assetName) {
    return null
  }

  const publicUrl = PUBLIC_INSTALLER_DOWNLOAD[opts.platform as PackagedInstallerPlatform]

  return publicUrl || githubLatestDownloadUrl(opts.repo ?? OFFICIAL_GITHUB_REPO, assetName)
}

export interface CheckPackagedInstallerUpdateDeps {
  stampCommit?: string | null
  platform: string
  fetchJson: (url: string) => Promise<unknown>
  compareBehind?: (currentSha: string, targetSha: string) => Promise<number | null>
  now?: () => number
  repo?: string
}

export async function checkPackagedInstallerUpdate(
  deps: CheckPackagedInstallerUpdateDeps
): Promise<PackagedInstallerCheckResult> {
  const fetchedAt = (deps.now ?? Date.now)()
  const repo = deps.repo ?? OFFICIAL_GITHUB_REPO
  const assetName = packagedInstallerAssetName(deps.platform)

  if (!assetName) {
    return {
      supported: false,
      channel: 'installer',
      reason: 'no-installer-channel',
      message: 'This packaged build has no published installer for this platform.',
      fetchedAt
    }
  }

  let payload: unknown

  try {
    payload = await deps.fetchJson(githubLatestReleaseApiUrl(repo))
  } catch (error) {
    return {
      supported: true,
      channel: 'installer',
      error: 'fetch-failed',
      message: error instanceof Error ? error.message : String(error),
      fetchedAt
    }
  }

  const release = parseGithubRelease(payload)

  if (!release) {
    return {
      supported: true,
      channel: 'installer',
      error: 'fetch-failed',
      message: 'Latest GitHub release is not a desktop-v* installer.',
      fetchedAt
    }
  }

  const asset = selectReleaseAsset(release, assetName)

  if (!asset && !resolveInstallerDownloadUrl({ platform: deps.platform, asset: null, repo })) {
    return {
      supported: false,
      channel: 'installer',
      reason: 'installer-asset-missing',
      message: `Latest desktop release ${release.tag} has no ${assetName}.`,
      releaseTag: release.tag,
      fetchedAt
    }
  }

  let releaseSha = resolveReleaseCommitSha(release)

  if (!releaseSha) {
    try {
      releaseSha = parseCommitSha(await deps.fetchJson(githubCommitApiUrl(repo, release.tag)))
    } catch {
      releaseSha = null
    }
  }

  const stampCommit = isGitSha(deps.stampCommit) ? String(deps.stampCommit).trim() : null
  let compareBehind: number | null = null

  if (
    stampCommit &&
    releaseSha &&
    deps.compareBehind &&
    stampCommit.length === 40 &&
    releaseSha.length === 40 &&
    !sameGitCommit(stampCommit, releaseSha)
  ) {
    try {
      compareBehind = await deps.compareBehind(stampCommit, releaseSha)
    } catch {
      compareBehind = null
    }
  }

  const { updateAvailable, behind } = compareStampToRelease({
    stampCommit,
    releaseSha,
    compareBehind
  })

  return {
    supported: true,
    channel: 'installer',
    updateAvailable,
    behind,
    currentSha: stampCommit ?? undefined,
    targetSha: releaseSha ?? undefined,
    releaseTag: release.tag,
    commits: [],
    fetchedAt
  }
}

export interface ResolvePackagedInstallerApplyPlanDeps {
  platform: string
  fetchJson: (url: string) => Promise<unknown>
  repo?: string
}

export interface PackagedInstallerApplyPlan {
  assetName: string
  downloadUrl: string
  releaseTag: string
  releaseSha: string | null
  size: number | null
}

export async function resolvePackagedInstallerApplyPlan(
  deps: ResolvePackagedInstallerApplyPlanDeps
): Promise<PackagedInstallerApplyPlan> {
  const repo = deps.repo ?? OFFICIAL_GITHUB_REPO
  const assetName = packagedInstallerAssetName(deps.platform)

  if (!assetName) {
    throw new Error('No packaged installer is published for this platform.')
  }

  const payload = await deps.fetchJson(githubLatestReleaseApiUrl(repo))
  const release = parseGithubRelease(payload)

  if (!release) {
    throw new Error('Latest GitHub release is not a desktop-v* installer.')
  }

  const asset = selectReleaseAsset(release, assetName)
  const downloadUrl = resolveInstallerDownloadUrl({ platform: deps.platform, asset, repo })

  if (!downloadUrl) {
    throw new Error(`Latest desktop release ${release.tag} has no ${assetName}.`)
  }

  return {
    assetName,
    downloadUrl,
    releaseTag: release.tag,
    releaseSha: resolveReleaseCommitSha(release),
    size: asset?.size ?? null
  }
}

export function installerDownloadDest(tmpDir: string, assetName: string): string {
  return path.join(tmpDir, assetName)
}

export function downloadProgressPercent(received: number, total: number | null): number | null {
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
    return null
  }

  if (!Number.isFinite(received) || received < 0) {
    return 0
  }

  // Leave headroom for the spawn/quit stage so the bar does not sit at 100%
  // while the installer has not started.
  return Math.max(1, Math.min(90, Math.round((received / total) * 90)))
}

export const GITHUB_JSON_TIMEOUT_MS = 10_000
export const INSTALLER_DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000
const MAX_REDIRECTS = 10

export type FetchJson = (url: string) => Promise<unknown>

export function createGithubFetchJson(
  get: typeof https.get = https.get,
  timeoutMs = GITHUB_JSON_TIMEOUT_MS
): FetchJson {
  return url =>
    new Promise((resolve, reject) => {
      const req = get(
        url,
        {
          headers: { ...GITHUB_API_HEADERS },
          timeout: timeoutMs
        },
        res => {
          const chunks: Buffer[] = []
          res.on('error', reject)
          res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
          res.on('end', () => {
            const status = res.statusCode || 500

            if (status >= 400) {
              reject(new Error(`GitHub API ${status}`))

              return
            }

            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
            } catch (error) {
              reject(error)
            }
          })
        }
      )

      req.on('timeout', () => req.destroy(new Error('GitHub API timeout')))
      req.on('error', reject)
    })
}

export interface DownloadHttpsToFileDeps {
  get?: typeof https.get
  timeoutMs?: number
  onProgress?: (received: number, total: number | null) => void
}

function headerValue(headers: IncomingMessage['headers'], name: string): string {
  const raw = headers[name] ?? headers[name.toLowerCase()]

  if (Array.isArray(raw)) {
    return raw[0] || ''
  }

  return typeof raw === 'string' ? raw : ''
}

export function downloadHttpsToFile(
  url: string,
  destPath: string,
  deps: DownloadHttpsToFileDeps = {},
  hop = 0
): Promise<void> {
  const get = deps.get ?? https.get
  const timeoutMs = deps.timeoutMs ?? INSTALLER_DOWNLOAD_TIMEOUT_MS

  if (hop > MAX_REDIRECTS) {
    return Promise.reject(new Error('Too many redirects while downloading installer'))
  }

  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    const tmpPath = `${destPath}.part`
    let settled = false

    const finish = (error?: Error) => {
      if (settled) {
        return
      }

      settled = true

      if (error) {
        reject(error)

        return
      }

      resolve()
    }

    const req = get(url, { timeout: timeoutMs, headers: { 'User-Agent': GITHUB_API_HEADERS['User-Agent'] } }, res => {
      const status = res.statusCode || 0
      const location = headerValue(res.headers, 'location')

      if (status >= 300 && status < 400 && location) {
        res.resume()
        downloadHttpsToFile(location, destPath, deps, hop + 1).then(
          () => finish(),
          error => finish(error instanceof Error ? error : new Error(String(error)))
        )

        return
      }

      if (status !== 200) {
        res.resume()
        finish(new Error(`Installer download failed: HTTP ${status}`))

        return
      }

      const lengthRaw = headerValue(res.headers, 'content-length')
      const total = lengthRaw ? Number.parseInt(lengthRaw, 10) : NaN
      const knownTotal = Number.isFinite(total) && total > 0 ? total : null
      let received = 0

      const out = fs.createWriteStream(tmpPath)

      const fail = (error: Error) => {
        try {
          res.destroy()
        } catch {
          // ignore
        }

        try {
          out.destroy()
        } catch {
          // ignore
        }

        try {
          fs.unlinkSync(tmpPath)
        } catch {
          // ignore
        }

        finish(error)
      }

      out.on('error', fail)
      res.on('error', fail)

      res.on('data', chunk => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        received += buffer.length
        deps.onProgress?.(received, knownTotal)

        if (!out.write(buffer)) {
          res.pause()
          out.once('drain', () => res.resume())
        }
      })

      res.on('end', () => {
        out.end(() => {
          try {
            fs.renameSync(tmpPath, destPath)
            finish()
          } catch (error) {
            fail(error instanceof Error ? error : new Error(String(error)))
          }
        })
      })
    })

    req.on('timeout', () => req.destroy(new Error('Installer download timed out')))
    req.on('error', error => finish(error instanceof Error ? error : new Error(String(error))))
  })
}

/** Direct installer spawn (macOS `open` / raw NSIS). Windows apply uses the handoff wrap. */
export function packagedInstallerSpawn(opts: { platform: string; installerPath: string; installDir?: string | null }): {
  args: string[]
  command: string
} {
  if (opts.platform === 'win32') {
    return { command: opts.installerPath, args: nsisSilentArgs(opts.installDir) }
  }

  if (opts.platform === 'darwin') {
    return { command: '/usr/bin/open', args: [opts.installerPath] }
  }

  throw new Error('No packaged installer spawn recipe for this platform.')
}

/**
 * What `applyPackagedInstallerUpdates` actually detaches.
 *
 * Windows: cmd start → powershell waits for our PID, runs silent NSIS
 * (`--force-run`), then relaunches Work4You.exe if the installer did not.
 * macOS: `open` the DMG (user drags to Applications).
 */
export function packagedInstallerApplySpawn(opts: {
  platform: string
  installerPath: string
  installDir?: string | null
  desktopPid: number
  relaunchExe: string
  handoffScriptPath: string
}): { args: string[]; command: string } {
  if (opts.platform === 'win32') {
    return wrapHandoffForDetachedConsole(
      {
        command: 'powershell',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', opts.handoffScriptPath],
        scriptPath: opts.handoffScriptPath
      },
      packagedWindowsHandoffExtraArgs({
        desktopPid: opts.desktopPid,
        installerPath: opts.installerPath,
        installDir: opts.installDir,
        relaunchExe: opts.relaunchExe
      })
    )
  }

  return packagedInstallerSpawn({
    platform: opts.platform,
    installerPath: opts.installerPath,
    installDir: opts.installDir
  })
}
