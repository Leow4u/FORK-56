import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { downloadHttpsToFile, type PackagedInstallerApplyPlan } from './packaged-installer-update'

/** A cache entry belongs to an immutable release asset, never merely a filename. */
export function packagedArtifactKey(plan: PackagedInstallerApplyPlan): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        plan.releaseTag,
        plan.releaseSha,
        plan.assetName,
        plan.assetId ?? null,
        plan.downloadUrl,
        plan.size,
        plan.sha256 ?? null
      ])
    )
    .digest('hex')
}

export function packagedArtifactPath(scratchDir: string, plan: PackagedInstallerApplyPlan): string {
  return path.join(scratchDir, packagedArtifactKey(plan), path.basename(plan.assetName))
}

async function inspectArtifact(file: string): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256')
  let size = 0

  for await (const chunk of fs.createReadStream(file)) {
    size += chunk.length
    hash.update(chunk)
  }

  return { size, sha256: hash.digest('hex') }
}

function matchesRelease(plan: PackagedInstallerApplyPlan, actual: { size: number; sha256: string }): boolean {
  return (
    actual.size > 0 &&
    (plan.size == null || actual.size === plan.size) &&
    (!plan.sha256 || actual.sha256 === plan.sha256)
  )
}

/** Rehash even a ready download: temporary cleaners and disk changes outlive UI state. */
export async function isPackagedArtifactValid(plan: PackagedInstallerApplyPlan, file: string): Promise<boolean> {
  try {
    const saved = JSON.parse(await fs.promises.readFile(`${file}.json`, 'utf8'))

    if (saved.key !== packagedArtifactKey(plan)) {
      return false
    }

    const actual = await inspectArtifact(file)

    return matchesRelease(plan, actual) && saved.size === actual.size && saved.sha256 === actual.sha256
  } catch {
    return false
  }
}

export async function ensurePackagedUpdateArtifact(
  plan: PackagedInstallerApplyPlan,
  options: {
    scratchDir: string
    onProgress?: (received: number, total: number | null) => void
    download?: typeof downloadHttpsToFile
  }
): Promise<string> {
  const dest = packagedArtifactPath(options.scratchDir, plan)

  if (await isPackagedArtifactValid(plan, dest)) {
    return dest
  }

  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.rm(`${dest}.json`, { force: true })
  // A partial file without a verified receipt is never promoted by its size alone.
  await (options.download ?? downloadHttpsToFile)(plan.downloadUrl, dest, { onProgress: options.onProgress })
  const actual = await inspectArtifact(dest)

  if (!matchesRelease(plan, actual)) {
    await fs.promises.rm(dest, { force: true })
    throw new Error('The downloaded installer failed its size or SHA-256 check. Please try again.')
  }

  const receipt = `${dest}.json`
  await fs.promises.writeFile(`${receipt}.tmp`, JSON.stringify({ key: packagedArtifactKey(plan), ...actual }), 'utf8')
  await fs.promises.rename(`${receipt}.tmp`, receipt)

  return dest
}

/** Run after a verified update, keeping its installer and the previous working one. */
export async function prunePackagedArtifactCache(scratchDir: string, keepFiles: readonly string[]): Promise<void> {
  const retained = new Set(keepFiles.map(file => path.resolve(path.dirname(file))))
  let entries: fs.Dirent[]

  try {
    entries = await fs.promises.readdir(scratchDir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const directory = path.resolve(scratchDir, entry.name)

    if (entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name) && !retained.has(directory)) {
      await fs.promises.rm(directory, { recursive: true, force: true })
    }
  }
}
