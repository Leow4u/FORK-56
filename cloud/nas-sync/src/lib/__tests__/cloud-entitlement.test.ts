/**
 * Plan → one Cloud VM contract.
 * Run: node --import ./cloud/nas-sync/src/lib/__tests__/register-ts-resolve.mjs --test cloud/nas-sync/src/lib/__tests__/cloud-entitlement.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assertFlyApiToken,
  canonicalCloudInstance,
  CLOUD_ENSURE_MAX_ATTEMPTS,
  CLOUD_ENSURE_PAID_LAG_DELAY_MS,
  cloudEnsureBody,
  cloudEntitlement,
  cloudInstanceName,
  cloudSizeForTier,
  DEFAULT_CLOUD_INSTANCE_NAME,
  ensureOrgCloudInstanceWith,
  FlyNotConfiguredError,
  MANUAL_CLOUD_CREATE_ERROR,
  manualCloudCreateRefusal,
  retrySubscriptionCloudEnsure,
  type CloudInstanceRef,
} from '../cloud-entitlement.ts'
import { isPaidTierId, TIER_CATALOG } from '../tiers.ts'

const row = (
  id: string,
  createdAt: string,
  status = 'online',
): CloudInstanceRef => ({ id, createdAt, status })

describe('cloud size for tier', () => {
  it('maps each paid catalog tier to a machine and leaves free without one', () => {
    for (const tier of TIER_CATALOG) {
      const size = cloudSizeForTier(tier.tierId)
      if (isPaidTierId(tier.tierId)) {
        assert.ok(size)
      } else {
        assert.equal(size, null)
      }
    }
  })

  it('assigns Plus Small, Super Medium, Ultra Large', () => {
    assert.equal(cloudSizeForTier('plus'), 'small')
    assert.equal(cloudSizeForTier(' PLUS '), 'small')
    assert.equal(cloudSizeForTier('super'), 'medium')
    assert.equal(cloudSizeForTier('ultra'), 'large')
  })

  it('fails closed for free, empty, and unknown tiers', () => {
    for (const tierId of [null, undefined, '', 'free', 'Free', 'nope']) {
      assert.equal(cloudSizeForTier(tierId), null)
      assert.equal(cloudEntitlement(tierId).canUseCloud, false)
      assert.equal(cloudEntitlement(tierId).reason, 'paid_plan_required')
      assert.equal(cloudEntitlement(tierId).manualCreate, false)
    }
  })
})

describe('entitlement', () => {
  it('lets a paid plan use cloud and still refuses manual create', () => {
    const entitlement = cloudEntitlement('ultra')
    assert.equal(entitlement.tierId, 'ultra')
    assert.equal(entitlement.canUseCloud, true)
    assert.equal(entitlement.allowedSize, 'large')
    assert.equal(entitlement.manualCreate, false)
    assert.equal(entitlement.reason, 'ok')
  })
})

describe('manual create', () => {
  it('refuses POST with a stable error', () => {
    const refusal = manualCloudCreateRefusal()
    assert.equal(refusal.status, 403)
    assert.equal(refusal.body.error, MANUAL_CLOUD_CREATE_ERROR)
    assert.equal(refusal.body.error, 'manual_create_disabled')
    assert.ok(refusal.body.message.length > 0)
  })
})

describe('canonical instance', () => {
  it('ignores self-hosted rows and keeps the oldest cloud row', () => {
    const picked = canonicalCloudInstance([
      row('local', '2019-01-01T00:00:00.000Z', 'self_hosted'),
      row('newer', '2024-01-01T00:00:00.000Z', 'online'),
      row('older', '2021-01-01T00:00:00.000Z', 'error'),
    ])
    assert.equal(picked?.id, 'older')
  })

  it('breaks equal timestamps by id', () => {
    const picked = canonicalCloudInstance([
      row('b', '2021-01-01T00:00:00.000Z'),
      row('a', '2021-01-01T00:00:00.000Z'),
    ])
    assert.equal(picked?.id, 'a')
  })
})

describe('ensureOrgCloudInstanceWith', () => {
  it('does not create on free when the org has no VM', async () => {
    let listed = 0
    let created = 0
    const result = await ensureOrgCloudInstanceWith({
      tierId: 'free',
      list: async () => {
        listed += 1
        return []
      },
      create: async () => {
        created += 1
        return row('should-not', '2026-01-01T00:00:00.000Z')
      },
    })
    assert.deepEqual(result, { ok: false, error: 'paid_plan_required' })
    assert.equal(listed, 1)
    assert.equal(created, 0)
  })

  it('reuses a legacy free VM instead of creating another', async () => {
    let created = 0
    const legacy = row('legacy', '2020-05-01T00:00:00.000Z', 'online')
    const result = await ensureOrgCloudInstanceWith({
      tierId: 'free',
      list: async () => [legacy],
      create: async () => {
        created += 1
        return row('new', '2026-01-01T00:00:00.000Z')
      },
    })
    assert.equal(created, 0)
    assert.deepEqual(result, { ok: true, created: false, instance: legacy })
  })

  it('creates the plan size once and ignores a caller size', async () => {
    const store: CloudInstanceRef[] = []
    const seen: Array<{ size: string; name: string }> = []
    const ensure = () =>
      ensureOrgCloudInstanceWith({
        tierId: 'plus',
        size: 'large',
        list: async () => store.slice(),
        create: async (input) => {
          seen.push(input)
          const created = row(`vm-${store.length + 1}`, '2026-03-01T00:00:00.000Z')
          store.push(created)
          return created
        },
      } as Parameters<typeof ensureOrgCloudInstanceWith>[0])

    const first = await ensure()
    const second = await ensure()

    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.equal(first.created, true)
    assert.deepEqual(seen, [{ size: 'small', name: DEFAULT_CLOUD_INSTANCE_NAME }])
    assert.equal(store.length, 1)

    assert.equal(second.ok, true)
    if (!second.ok) return
    assert.equal(second.created, false)
    assert.equal(second.instance.id, first.instance.id)
    assert.equal(seen.length, 1)
  })

  it('uses medium for super and large for ultra', async () => {
    const sizes: string[] = []
    for (const tierId of ['super', 'ultra'] as const) {
      const result = await ensureOrgCloudInstanceWith({
        tierId,
        list: async () => [],
        create: async (input) => {
          sizes.push(input.size)
          return row(tierId, '2026-01-01T00:00:00.000Z')
        },
      })
      assert.equal(result.ok && result.created, true)
    }
    assert.deepEqual(sizes, ['medium', 'large'])
  })

  it('does not resize an existing VM when the plan size differs', async () => {
    let created = 0
    const existing = row('kept', '2022-01-01T00:00:00.000Z', 'stopped')
    const result = await ensureOrgCloudInstanceWith({
      tierId: 'ultra',
      list: async () => [existing],
      create: async () => {
        created += 1
        return row('resized', '2026-01-01T00:00:00.000Z')
      },
    })
    assert.equal(created, 0)
    assert.equal(result.ok && result.instance.id, 'kept')
  })

  it('treats a self-hosted registration as an empty cloud slot', async () => {
    const seen: string[] = []
    const result = await ensureOrgCloudInstanceWith({
      tierId: 'plus',
      list: async () => [row('desk', '2020-01-01T00:00:00.000Z', 'self_hosted')],
      create: async (input) => {
        seen.push(input.size)
        return row('vm', '2026-01-01T00:00:00.000Z')
      },
    })
    assert.deepEqual(seen, ['small'])
    assert.equal(result.ok && result.created, true)
  })

  it('reuses a row that appears before the second list', async () => {
    let listed = 0
    let created = 0
    const raced = row('raced', '2026-02-01T00:00:00.000Z', 'provisioning')
    const result = await ensureOrgCloudInstanceWith({
      tierId: 'plus',
      list: async () => {
        listed += 1
        return listed === 1 ? [] : [raced]
      },
      create: async () => {
        created += 1
        return row('late', '2026-03-01T00:00:00.000Z')
      },
    })
    assert.equal(listed, 2)
    assert.equal(created, 0)
    assert.deepEqual(result, { ok: true, created: false, instance: raced })
  })

  it('names the instance from the caller or the default', () => {
    assert.equal(cloudInstanceName('  Mesa  '), 'Mesa')
    assert.equal(cloudInstanceName('   '), DEFAULT_CLOUD_INSTANCE_NAME)
    assert.equal(cloudInstanceName(null), DEFAULT_CLOUD_INSTANCE_NAME)
  })
})

describe('subscription ensure response', () => {
  it('keeps a free refusal retryable and returns the created id', () => {
    assert.deepEqual(cloudEnsureBody({ ok: false, error: 'paid_plan_required' }), {
      ensured: false,
      reason: 'paid_plan_required',
    })
    assert.deepEqual(
      cloudEnsureBody({ ok: true, created: false, instanceId: 'vm-1' }),
      { ensured: true, created: false, instanceId: 'vm-1' },
    )
  })

  it('refuses to provision when the Fly token is blank', () => {
    assert.throws(() => assertFlyApiToken(undefined), FlyNotConfiguredError)
    assert.throws(() => assertFlyApiToken('   '), FlyNotConfiguredError)
    assert.doesNotThrow(() => assertFlyApiToken('fly-token'))
  })
})

describe('checkout ensure retry', () => {
  it('retries only while checkout return still sees a free plan', async () => {
    const sleeps: number[] = []
    let calls = 0
    const body = await retrySubscriptionCloudEnsure({
      checkoutReturn: true,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      request: async () => {
        calls += 1
        if (calls < 3) return { ensured: false, reason: 'paid_plan_required' }
        return { ensured: true, created: true, instanceId: 'vm' }
      },
    })
    assert.equal(calls, 3)
    assert.equal(body.ensured, true)
    assert.ok(sleeps.length >= 1)
    for (const ms of sleeps) assert.equal(ms, CLOUD_ENSURE_PAID_LAG_DELAY_MS)
  })

  it('does not retry a paid visit or a non-free failure', async () => {
    for (const checkoutReturn of [false, true]) {
      let calls = 0
      const reason = checkoutReturn ? 'request_failed' : 'paid_plan_required'
      const body = await retrySubscriptionCloudEnsure({
        checkoutReturn,
        sleep: async () => {
          throw new Error('should not sleep')
        },
        request: async () => {
          calls += 1
          return { ensured: false, reason }
        },
      })
      assert.equal(calls, 1)
      assert.equal(body.reason, reason)
    }
  })

  it('stops after the checkout lag window while the plan stays free', async () => {
    let calls = 0
    const sleeps: number[] = []
    const body = await retrySubscriptionCloudEnsure({
      checkoutReturn: true,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      request: async () => {
        calls += 1
        return { ensured: false, reason: 'paid_plan_required' }
      },
    })
    assert.ok(CLOUD_ENSURE_MAX_ATTEMPTS >= 2)
    assert.equal(calls, CLOUD_ENSURE_MAX_ATTEMPTS)
    assert.equal(sleeps.length, calls - 1)
    assert.equal(body.ensured, false)
    assert.equal(body.reason, 'paid_plan_required')
  })
})
