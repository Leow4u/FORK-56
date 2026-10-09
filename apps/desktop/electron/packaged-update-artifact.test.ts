import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import type { PackagedInstallerApplyPlan } from './packaged-installer-update'
import {
  ensurePackagedUpdateArtifact,
  isPackagedArtifactValid,
  packagedArtifactPath,
  prunePackagedArtifactCache
} from './packaged-update-artifact'

const contents = Buffer.from('a complete installer')

const plan: PackagedInstallerApplyPlan = {
  kind: 'installer',
  assetName: 'Work4You-Setup.exe',
  releaseTag: 'desktop-v1.0.0',
  releaseSha: 'a'.repeat(40),
  downloadUrl: 'https://example.com/releases/1/Work4You-Setup.exe',
  size: contents.length,
  sha256: createHash('sha256').update(contents).digest('hex'),
  assetId: 1
}

test('cache cleanup retains the current and recovery installers without removing unrelated files', async () => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-update-prune-'))

  try {
    const paths: string[] = []

    for (const assetId of [1, 2, 3]) {
      paths.push(
        await ensurePackagedUpdateArtifact(
          { ...plan, assetId },
          {
            scratchDir,
            download: async (_url, dest) => {
              fs.writeFileSync(dest, contents)
            }
          }
        )
      )
    }

    fs.mkdirSync(path.join(scratchDir, 'unrelated'))
    await prunePackagedArtifactCache(scratchDir, paths.slice(1))
    assert.equal(fs.existsSync(paths[0]), false)
    assert.equal(fs.existsSync(paths[1]), true)
    assert.equal(fs.existsSync(paths[2]), true)
    assert.equal(fs.existsSync(path.join(scratchDir, 'unrelated')), true)
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true })
  }
})

test('reuses only an intact asset and downloads again after cleanup or same-size corruption', async () => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-update-artifact-'))
  let downloads = 0

  const download = async (_url: string, dest: string) => {
    downloads++
    fs.writeFileSync(dest, contents)
  }

  try {
    const dest = await ensurePackagedUpdateArtifact(plan, { scratchDir, download })
    assert.equal(await isPackagedArtifactValid(plan, dest), true)
    await ensurePackagedUpdateArtifact(plan, { scratchDir, download })
    assert.equal(downloads, 1)
    fs.writeFileSync(dest, Buffer.alloc(contents.length, 42))
    assert.equal(await isPackagedArtifactValid(plan, dest), false)
    await ensurePackagedUpdateArtifact(plan, { scratchDir, download })
    assert.equal(downloads, 2)
    fs.unlinkSync(dest)
    await ensurePackagedUpdateArtifact(plan, { scratchDir, download })
    assert.equal(downloads, 3)
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true })
  }
})

test('different releases and replaced assets cannot share cached executable paths', () => {
  const original = packagedArtifactPath('/tmp/updates', plan)
  assert.notEqual(original, packagedArtifactPath('/tmp/updates', { ...plan, releaseTag: 'desktop-v1.0.1' }))
  assert.notEqual(original, packagedArtifactPath('/tmp/updates', { ...plan, assetId: 2 }))
})

test('rejects wrong checksums or truncated downloads without leaving a reusable receipt', async () => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-update-reject-'))

  try {
    for (const invalid of [Buffer.alloc(contents.length, 42), contents.subarray(0, 3)]) {
      await assert.rejects(
        () =>
          ensurePackagedUpdateArtifact(plan, {
            scratchDir,
            download: async (_url, dest) => {
              fs.writeFileSync(dest, invalid)
            }
          }),
        /size or SHA-256/
      )
      assert.equal(await isPackagedArtifactValid(plan, packagedArtifactPath(scratchDir, plan)), false)
    }
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true })
  }
})

test('never promotes an unverified completed-looking part just because its size matches', async () => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-update-part-'))

  try {
    const dest = packagedArtifactPath(scratchDir, plan)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(`${dest}.part`, contents)
    let downloaded = false
    await ensurePackagedUpdateArtifact(plan, {
      scratchDir,
      download: async (_url, file) => {
        downloaded = true
        fs.writeFileSync(file, contents)
      }
    })
    assert.equal(downloaded, true)
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true })
  }
})

test('a local digest still detects cache corruption when a release has no remote digest', async () => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-update-local-hash-'))
  const unsignedDigestPlan = { ...plan, sha256: undefined }

  try {
    const dest = await ensurePackagedUpdateArtifact(unsignedDigestPlan, {
      scratchDir,
      download: async (_url, file) => {
        fs.writeFileSync(file, contents)
      }
    })

    fs.writeFileSync(dest, Buffer.alloc(contents.length, 32))
    assert.equal(await isPackagedArtifactValid(unsignedDigestPlan, dest), false)
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true })
  }
})
