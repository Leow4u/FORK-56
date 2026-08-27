/**
 * Pure-contract tests for Cloud in-place image update helpers.
 * Run: node --test cloud/nas-sync/src/lib/__tests__/image-ref.test.mjs
 *
 * Mirrors normalizeImageRef / imagesMatch / mount-safety checks from
 * fly-machines.ts so we don't need the full Next/Prisma graph.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

function normalizeImageRef(image) {
  return image.split('@')[0].trim().toLowerCase()
}

function imagesMatch(a, b) {
  if (!a || !b) return false
  return normalizeImageRef(a) === normalizeImageRef(b)
}

function assertSafeToRoll(config, expectedVolumeId) {
  if (!config || typeof config !== 'object') {
    throw new Error('Máquina Fly sem config — não é seguro atualizar')
  }
  const mounts = Array.isArray(config.mounts) ? config.mounts : []
  const dataMount = mounts.find((m) => m.path === '/opt/data')
  if (!dataMount?.volume) {
    throw new Error(
      'Mount /opt/data em falta — abortar update para não perder dados',
    )
  }
  if (dataMount.volume !== expectedVolumeId) {
    throw new Error(
      `Volume id diverge (machine=${dataMount.volume}, db=${expectedVolumeId}) — abortar`,
    )
  }
  return true
}

function planRoll(config, expectedVolumeId, targetImage) {
  assertSafeToRoll(config, expectedVolumeId)
  const previousImage = typeof config.image === 'string' ? config.image : ''
  if (previousImage && imagesMatch(previousImage, targetImage)) {
    return { changed: false, nextConfig: config }
  }
  return {
    changed: true,
    nextConfig: { ...config, image: targetImage },
  }
}

describe('imagesMatch', () => {
  it('matches identical refs', () => {
    const img =
      'registry.fly.io/work4you-cloud-runtime:deployment-01M126K255WVTKAF2YDCN3Q93M'
    assert.equal(imagesMatch(img, img), true)
  })

  it('ignores digest suffix', () => {
    const tag =
      'registry.fly.io/work4you-cloud-runtime:deployment-01M126K255WVTKAF2YDCN3Q93M'
    const withDigest = `${tag}@sha256:deadbeef`
    assert.equal(imagesMatch(tag, withDigest), true)
  })

  it('detects older pin as update-available', () => {
    const old =
      'registry.fly.io/work4you-cloud-runtime:deployment-01M0WPHE2Q4YN2T0JH5G7EYDDA'
    const pinned =
      'registry.fly.io/work4you-cloud-runtime:deployment-01M126K255WVTKAF2YDCN3Q93M'
    assert.equal(imagesMatch(old, pinned), false)
    assert.equal(Boolean(old && !imagesMatch(old, pinned)), true)
  })
})

describe('roll safety (volume intact)', () => {
  const vol = 'vol_abc123'
  const baseConfig = {
    image:
      'registry.fly.io/work4you-cloud-runtime:deployment-OLD',
    env: { WORK4YOU_HOME: '/opt/data', WORK4YOU_CLOUD_INSTANCE_ID: 'x' },
    mounts: [{ volume: vol, path: '/opt/data' }],
    guest: { cpus: 2, memory_mb: 1024, cpu_kind: 'shared' },
  }
  const target =
    'registry.fly.io/work4you-cloud-runtime:deployment-01M126K255WVTKAF2YDCN3Q93M'

  it('only changes image — mounts and env survive', () => {
    const plan = planRoll(baseConfig, vol, target)
    assert.equal(plan.changed, true)
    assert.equal(plan.nextConfig.image, target)
    assert.deepEqual(plan.nextConfig.mounts, baseConfig.mounts)
    assert.deepEqual(plan.nextConfig.env, baseConfig.env)
    assert.deepEqual(plan.nextConfig.guest, baseConfig.guest)
  })

  it('no-ops when already on target', () => {
    const onTarget = { ...baseConfig, image: target }
    const plan = planRoll(onTarget, vol, target)
    assert.equal(plan.changed, false)
  })

  it('aborts when /opt/data mount missing', () => {
    assert.throws(
      () => planRoll({ ...baseConfig, mounts: [] }, vol, target),
      /Mount \/opt\/data/,
    )
  })

  it('aborts when volume id diverges from DB', () => {
    assert.throws(
      () => planRoll(baseConfig, 'vol_OTHER', target),
      /Volume id diverge/,
    )
  })

  it('never implies deleteFlyApp for upgrades', () => {
    // Contract: upgrade path is POST machine config only.
    const plan = planRoll(baseConfig, vol, target)
    assert.equal(plan.changed, true)
    assert.ok(plan.nextConfig.mounts?.[0]?.volume === vol)
    // Destructive ops must stay on deleteAgent only — not on this plan.
    const destructive = ['deleteFlyApp', 'destroyMachine', 'deleteAgent']
    const planJson = JSON.stringify(plan)
    for (const name of destructive) {
      assert.equal(planJson.includes(name), false)
    }
  })
})
