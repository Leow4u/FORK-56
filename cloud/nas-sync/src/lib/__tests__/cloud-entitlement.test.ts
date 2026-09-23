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
  CLOUD_PROVISION_ERROR_RETRY_MS,
  CLOUD_PROVISION_STALE_MS,
  CLOUD_PARKED_STATUS,
  cloudEnsureBody,
  cloudEntitlement,
  cloudInstanceName,
  cloudInstanceNeedsPark,
  cloudInstanceNeedsResume,
  cloudInstanceNeedsWake,
  cloudInstanceResizeTarget,
  cloudLifecycleActionAllowed,
  cloudResizeShouldStart,
  cloudSizeForTier,
  cloudStatusForFlyState,
  planDiskGb,
  volumeExtendGb,
  DEFAULT_CLOUD_INSTANCE_NAME,
  ensureOrgCloudInstanceWith,
  FlyNotConfiguredError,
  MANUAL_CLOUD_CREATE_ERROR,
  manualCloudCreateRefusal,
  planFlyBirth,
  retrySubscriptionCloudEnsure,
  type CloudInstanceRef,
} from '../cloud-entitlement.ts'
import {
  flyAlreadyExists,
  guestNeedsResize,
  withCloudScaleToZero,
} from '../fly-machines.ts'
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
    let parked = 0
    const legacy = row('legacy', '2020-05-01T00:00:00.000Z', 'online')
    const result = await ensureOrgCloudInstanceWith({
      tierId: 'free',
      list: async () => [legacy],
      create: async () => {
        created += 1
        return row('new', '2026-01-01T00:00:00.000Z')
      },
      park: async (instance) => {
        parked += 1
        return instance
      },
    })
    assert.equal(created, 0)
    assert.equal(parked, 0)
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

  it('resizes the same VM when the paid plan size differs', async () => {
    const cases = [
      { tierId: 'ultra', from: 'small', to: 'large' },
      { tierId: 'plus', from: 'large', to: 'small' },
      { tierId: 'super', from: 'small', to: 'medium' },
    ]
    for (const entry of cases) {
      let created = 0
      let resumed = 0
      let parked = 0
      let woken = 0
      const seen: string[] = []
      const existing = {
        ...row('kept', '2022-01-01T00:00:00.000Z', 'online'),
        size: entry.from,
        flyMachineId: 'mach',
      }
      const result = await ensureOrgCloudInstanceWith({
        tierId: entry.tierId,
        list: async () => [existing],
        create: async () => {
          created += 1
          return row('new', '2026-01-01T00:00:00.000Z')
        },
        resume: async () => {
          resumed += 1
          return existing
        },
        resize: async (instance, size) => {
          seen.push(`${instance.id}:${size}`)
          return { ...instance, size }
        },
        park: async (instance) => {
          parked += 1
          return instance
        },
        wake: async (instance) => {
          woken += 1
          return instance
        },
      })
      assert.equal(created, 0, entry.tierId)
      assert.equal(resumed, 0, entry.tierId)
      assert.equal(parked, 0, entry.tierId)
      assert.equal(woken, 0, entry.tierId)
      assert.deepEqual(seen, [`kept:${entry.to}`])
      assert.equal(result.ok && result.created, false)
      assert.equal(result.ok && result.instance.id, 'kept')
    }
  })

  it('does not resize a matching size or a row with no recorded size', async () => {
    const cases: Array<{ tierId: string; instance: CloudInstanceRef }> = [
      {
        tierId: 'plus',
        instance: {
          ...row('match', '2022-01-01T00:00:00.000Z', 'online'),
          size: 'small',
          flyMachineId: 'mach',
        },
      },
      {
        tierId: 'ultra',
        instance: {
          ...row('unknown', '2022-01-01T00:00:00.000Z', 'stopped'),
          flyMachineId: 'mach',
        },
      },
      {
        tierId: 'ultra',
        instance: {
          ...row('unborn-stopped', '2022-01-01T00:00:00.000Z', 'stopped'),
          size: 'small',
        },
      },
    ]
    for (const entry of cases) {
      let resized = 0
      let created = 0
      let parked = 0
      let woken = 0
      const result = await ensureOrgCloudInstanceWith({
        tierId: entry.tierId,
        list: async () => [entry.instance],
        create: async () => {
          created += 1
          return row('new', '2026-01-01T00:00:00.000Z')
        },
        resize: async (instance) => {
          resized += 1
          return instance
        },
        park: async (instance) => {
          parked += 1
          return instance
        },
        wake: async (instance) => {
          woken += 1
          return instance
        },
      })
      assert.equal(created, 0, entry.instance.id)
      assert.equal(resized, 0, entry.instance.id)
      assert.equal(parked, 0, entry.instance.id)
      assert.equal(woken, 0, entry.instance.id)
      assert.equal(result.ok && result.instance.id, entry.instance.id)
      assert.equal(cloudInstanceResizeTarget(entry.instance, entry.tierId), null)
    }
  })

  it('parks a free machine and keeps the same row', async () => {
    const running = {
      ...row('legacy', '2020-01-01T00:00:00.000Z', 'online'),
      size: 'large',
      flyMachineId: 'mach',
    }
    let created = 0
    let resized = 0
    let resumed = 0
    let woken = 0
    let parked = 0
    const result = await ensureOrgCloudInstanceWith({
      tierId: 'free',
      list: async () => [running],
      create: async () => {
        created += 1
        return row('new', '2026-01-01T00:00:00.000Z')
      },
      resume: async (instance) => {
        resumed += 1
        return instance
      },
      resize: async (instance) => {
        resized += 1
        return instance
      },
      wake: async (instance) => {
        woken += 1
        return instance
      },
      park: async (instance) => {
        parked += 1
        return { ...instance, status: CLOUD_PARKED_STATUS }
      },
    })
    assert.equal(created, 0)
    assert.equal(resized, 0)
    assert.equal(resumed, 0)
    assert.equal(woken, 0)
    assert.equal(parked, 1)
    assert.equal(result.ok && result.created, false)
    assert.equal(result.ok && result.instance.id, 'legacy')
    assert.equal(result.ok && result.instance.status, CLOUD_PARKED_STATUS)
    assert.equal(cloudInstanceResizeTarget(running, 'free'), null)
    assert.equal(cloudInstanceNeedsPark(running, 'free'), true)
    assert.equal(
      cloudInstanceNeedsPark(
        { ...row('failed', '2020-06-01T00:00:00.000Z', 'error'), flyMachineId: 'mach' },
        'free',
      ),
      true,
    )
  })

  it('does not park a user stop, an already parked row, or an unborn free row', async () => {
    const cases: CloudInstanceRef[] = [
      {
        ...row('user-stop', '2020-01-01T00:00:00.000Z', 'stopped'),
        flyMachineId: 'mach',
        size: 'large',
      },
      {
        ...row('already', '2020-02-01T00:00:00.000Z', 'parked'),
        flyMachineId: 'mach',
        size: 'medium',
      },
      row('unborn', '2020-03-01T00:00:00.000Z', 'provisioning'),
      row('legacy-online', '2020-04-01T00:00:00.000Z', 'online'),
      {
        ...row('going', '2020-05-01T00:00:00.000Z', 'deleting'),
        flyMachineId: 'mach',
      },
    ]
    for (const instance of cases) {
      let parked = 0
      let created = 0
      const result = await ensureOrgCloudInstanceWith({
        tierId: 'free',
        list: async () => [instance],
        create: async () => {
          created += 1
          return row('new', '2026-01-01T00:00:00.000Z')
        },
        park: async (row) => {
          parked += 1
          return row
        },
      })
      assert.equal(created, 0, instance.id)
      assert.equal(parked, 0, instance.id)
      assert.equal(result.ok && result.instance.id, instance.id)
      assert.equal(cloudInstanceNeedsPark(instance, 'free'), false)
    }
  })

  it('wakes a parked machine on the same paid size and does not wake a user stop', async () => {
    const parked = {
      ...row('kept', '2022-01-01T00:00:00.000Z', 'parked'),
      size: 'small',
      flyMachineId: 'mach',
    }
    let woken = 0
    let resized = 0
    let created = 0
    const woke = await ensureOrgCloudInstanceWith({
      tierId: 'plus',
      list: async () => [parked],
      create: async () => {
        created += 1
        return row('new', '2026-01-01T00:00:00.000Z')
      },
      resize: async (instance) => {
        resized += 1
        return instance
      },
      wake: async (instance) => {
        woken += 1
        return { ...instance, status: 'online' }
      },
    })
    assert.equal(created, 0)
    assert.equal(resized, 0)
    assert.equal(woken, 1)
    assert.equal(woke.ok && woke.instance.status, 'online')
    assert.equal(cloudInstanceNeedsWake(parked, 'plus'), true)

    const userStop = {
      ...row('halted', '2022-01-01T00:00:00.000Z', 'stopped'),
      size: 'small',
      flyMachineId: 'mach',
    }
    let wakeStop = 0
    const stayed = await ensureOrgCloudInstanceWith({
      tierId: 'plus',
      list: async () => [userStop],
      create: async () => row('new', '2026-01-01T00:00:00.000Z'),
      wake: async (instance) => {
        wakeStop += 1
        return instance
      },
    })
    assert.equal(wakeStop, 0)
    assert.equal(stayed.ok && stayed.instance.status, 'stopped')
    assert.equal(cloudInstanceNeedsWake(userStop, 'plus'), false)
  })

  it('resizes a parked machine onto a new plan size instead of only waking it', async () => {
    const parked = {
      ...row('kept', '2022-01-01T00:00:00.000Z', 'parked'),
      size: 'small',
      flyMachineId: 'mach',
    }
    let woken = 0
    const seen: string[] = []
    const result = await ensureOrgCloudInstanceWith({
      tierId: 'ultra',
      list: async () => [parked],
      create: async () => row('new', '2026-01-01T00:00:00.000Z'),
      wake: async (instance) => {
        woken += 1
        return instance
      },
      resize: async (instance, size) => {
        seen.push(`${instance.id}:${size}`)
        return { ...instance, size, status: 'online' }
      },
    })
    assert.equal(woken, 0)
    assert.deepEqual(seen, ['kept:large'])
    assert.equal(result.ok && result.instance.status, 'online')
    assert.equal(cloudInstanceNeedsWake(parked, 'ultra'), false)
    assert.equal(
      cloudResizeShouldStart({ flyRunning: false, status: 'parked' }),
      true,
    )
    assert.equal(
      cloudResizeShouldStart({ flyRunning: false, status: 'stopped' }),
      false,
    )
    assert.equal(
      cloudResizeShouldStart({ flyRunning: true, status: 'stopped' }),
      true,
    )
  })

  it('lets Free stop a machine and refuses start or update', () => {
    assert.equal(cloudLifecycleActionAllowed('free', 'stop'), true)
    assert.equal(cloudLifecycleActionAllowed('free', 'start'), false)
    assert.equal(cloudLifecycleActionAllowed('free', 'update'), false)
    assert.equal(cloudLifecycleActionAllowed('plus', 'start'), true)
    assert.equal(cloudLifecycleActionAllowed('ultra', 'update'), true)
    assert.equal(cloudLifecycleActionAllowed('plus', 'stop'), true)
    assert.equal(cloudLifecycleActionAllowed('super', 'delete'), false)
  })

  it('grows the disk to the plan and never shrinks it', () => {
    assert.equal(planDiskGb(10, 40), 40)
    assert.equal(planDiskGb(40, 10), 40)
    assert.equal(planDiskGb(10, 10), 10)
    assert.equal(volumeExtendGb(10, 40), 40)
    assert.equal(volumeExtendGb(40, 10), null)
    assert.equal(volumeExtendGb(10, 10), null)
    assert.equal(
      guestNeedsResize(
        { cpu_kind: 'shared', cpus: 2, memory_mb: 1024 },
        { cpu_kind: 'shared', cpus: 2, memory_mb: 2048 },
      ),
      true,
    )
    assert.equal(
      guestNeedsResize(
        { cpu_kind: 'shared', cpus: 2, memory_mb: 1024 },
        { cpu_kind: 'shared', cpus: 2, memory_mb: 1024 },
      ),
      false,
    )
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

  it('resumes a paid row whose machine never landed', async () => {
    const now = Date.parse('2026-06-01T12:00:00.000Z')
    const cases = [
      row('failed', '2026-01-01T00:00:00.000Z', 'error'),
      {
        ...row('stale', '2026-02-01T00:00:00.000Z', 'provisioning'),
        updatedAt: new Date(now - CLOUD_PROVISION_STALE_MS).toISOString(),
      },
      {
        ...row('stale-start', '2026-03-01T00:00:00.000Z', 'starting'),
        updatedAt: new Date(now - CLOUD_PROVISION_STALE_MS - 1).toISOString(),
      },
    ]
    for (const stuck of cases) {
      let created = 0
      let resumed = 0
      let resized = 0
      const result = await ensureOrgCloudInstanceWith({
        tierId: 'ultra',
        now,
        list: async () => [{ ...stuck, size: 'small' }],
        create: async () => {
          created += 1
          return row('new', '2026-06-01T00:00:00.000Z')
        },
        resume: async (instance) => {
          resumed += 1
          return instance
        },
        resize: async (instance) => {
          resized += 1
          return instance
        },
      })
      assert.equal(created, 0)
      assert.equal(resized, 0)
      assert.equal(resumed, 1)
      assert.equal(result.ok && result.created, false)
      assert.equal(result.ok && result.instance.id, stuck.id)
    }
  })

  it('does not resume a live row, a fresh provision, or a free failure', async () => {
    const now = Date.parse('2026-06-01T12:00:00.000Z')
    const fresh = new Date(now - CLOUD_PROVISION_ERROR_RETRY_MS + 1000).toISOString()
    const cases: Array<{ tierId: string; instance: CloudInstanceRef }> = [
      {
        tierId: 'plus',
        instance: {
          ...row('running', '2026-01-01T00:00:00.000Z', 'online'),
          flyMachineId: 'm1',
        },
      },
      {
        tierId: 'plus',
        instance: {
          ...row('stopped', '2022-01-01T00:00:00.000Z', 'stopped'),
          flyMachineId: 'm2',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      },
      {
        tierId: 'ultra',
        instance: {
          ...row('born-error', '2026-01-01T00:00:00.000Z', 'error'),
          flyMachineId: 'm3',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      },
      {
        tierId: 'plus',
        instance: {
          ...row('in-flight', '2026-06-01T00:00:00.000Z', 'provisioning'),
          updatedAt: fresh,
        },
      },
      {
        tierId: 'plus',
        instance: {
          ...row('recent-error', '2026-06-01T00:00:00.000Z', 'error'),
          updatedAt: fresh,
        },
      },
      {
        tierId: 'free',
        instance: row('legacy-error', '2020-01-01T00:00:00.000Z', 'error'),
      },
    ]
    for (const entry of cases) {
      let resumed = 0
      let created = 0
      let parked = 0
      let woken = 0
      const result = await ensureOrgCloudInstanceWith({
        tierId: entry.tierId,
        now,
        list: async () => [entry.instance],
        create: async () => {
          created += 1
          return row('new', '2026-06-02T00:00:00.000Z')
        },
        resume: async (instance) => {
          resumed += 1
          return instance
        },
        park: async (instance) => {
          parked += 1
          return instance
        },
        wake: async (instance) => {
          woken += 1
          return instance
        },
      })
      assert.equal(created, 0, entry.instance.id)
      assert.equal(resumed, 0, entry.instance.id)
      assert.equal(parked, 0, entry.instance.id)
      assert.equal(woken, 0, entry.instance.id)
      assert.equal(result.ok && result.instance.id, entry.instance.id)
    }
    assert.equal(
      cloudInstanceNeedsResume({
        status: 'provisioning',
        updatedAt: new Date(now - CLOUD_PROVISION_STALE_MS + 1000).toISOString(),
      }, now),
      false,
    )
  })

  it('adopts an existing Fly machine and does not plan a second app', () => {
    assert.deepEqual(
      planFlyBirth(
        { appMissing: false, machineIds: ['  ', 'mach-1'], volumeIds: ['vol'] },
        'saved-vol',
      ),
      { action: 'adopt', machineId: 'mach-1' },
    )
    assert.deepEqual(
      planFlyBirth(
        { appMissing: true, machineIds: [], volumeIds: ['vol'] },
        'saved-vol',
      ),
      { action: 'create_machine', createApp: true, volumeId: null },
    )
    assert.deepEqual(
      planFlyBirth(
        { appMissing: false, machineIds: [], volumeIds: ['listed'] },
        'saved-vol',
      ),
      { action: 'create_machine', createApp: false, volumeId: 'saved-vol' },
    )
    assert.deepEqual(
      planFlyBirth({ appMissing: false, machineIds: [], volumeIds: ['listed'] }, ''),
      { action: 'create_machine', createApp: false, volumeId: 'listed' },
    )
    assert.deepEqual(
      planFlyBirth({ appMissing: false, machineIds: [], volumeIds: [] }, null),
      { action: 'create_machine', createApp: false, volumeId: null },
    )
    const taken = new Error('fly POST /apps → 422: name has already been taken')
    ;(taken as Error & { status: number }).status = 422
    assert.equal(flyAlreadyExists(taken), true)
    const other = new Error('fly POST /apps → 500: unavailable')
    ;(other as Error & { status: number }).status = 500
    assert.equal(flyAlreadyExists(other), false)
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

describe('paid idle sleep', () => {
  it('stamps scale-to-zero and the dashboard wake address onto the machine', () => {
    const result = withCloudScaleToZero({
      env: {
        PORT: '8080',
        WORK4YOU_DASHBOARD_PUBLIC_URL: 'https://dash.example/',
      },
      services: [{ protocol: 'tcp', autostop: 'suspend' }],
    })
    assert.equal(result.changed, true)
    assert.equal(result.config.env?.WORK4YOU_SCALE_TO_ZERO, '1')
    assert.equal(result.config.env?.GATEWAY_RELAY_WAKE_URL, 'https://dash.example')
    assert.equal(result.config.env?.PORT, '8080')
    assert.equal(result.config.env?.WORK4YOU_DASHBOARD_PUBLIC_URL, 'https://dash.example/')
    const service = result.config.services?.[0] as {
      protocol?: string
      autostop?: string
      autostart?: boolean
    }
    assert.equal(service.protocol, 'tcp')
    assert.equal(service.autostop, 'off')
    assert.equal(service.autostart, true)
  })

  it('leaves an already stamped machine unchanged', () => {
    const first = withCloudScaleToZero({
      env: { WORK4YOU_DASHBOARD_PUBLIC_URL: 'https://dash.example' },
      services: [{ autostop: 'off', autostart: true }],
    })
    const second = withCloudScaleToZero(first.config)
    assert.equal(second.changed, false)
    assert.equal(second.config, first.config)
  })

  it('does not arm a machine that has no wake address', () => {
    const config = {
      env: { PORT: '8080', WORK4YOU_DASHBOARD_PUBLIC_URL: '   ' },
      services: [{ autostop: 'suspend', autostart: false }],
    }
    const result = withCloudScaleToZero(config)
    assert.equal(result.changed, false)
    assert.equal(result.config, config)
  })

  it('keeps an existing relay wake address', () => {
    const result = withCloudScaleToZero({
      env: {
        PORT: '8080',
        WORK4YOU_DASHBOARD_PUBLIC_URL: 'https://dash.example/',
        GATEWAY_RELAY_WAKE_URL: 'https://relay.example/wake',
      },
      services: [{ protocol: 'tcp' }],
    })
    assert.equal(result.changed, true)
    assert.equal(result.config.env?.GATEWAY_RELAY_WAKE_URL, 'https://relay.example/wake')
    assert.equal(result.config.env?.WORK4YOU_SCALE_TO_ZERO, '1')
    assert.equal(result.config.env?.WORK4YOU_DASHBOARD_PUBLIC_URL, 'https://dash.example/')
    assert.equal(result.config.env?.PORT, '8080')
  })

  it('keeps idle sleep addressable and a real stop stopped', () => {
    assert.deepEqual(cloudStatusForFlyState('online', 'suspended'), {
      status: 'online',
      gateway: 'active',
    })
    assert.deepEqual(cloudStatusForFlyState('parked', 'suspended'), {
      status: 'parked',
      gateway: 'down',
    })
    assert.deepEqual(cloudStatusForFlyState('stopped', 'suspended'), {
      status: 'stopped',
      gateway: 'down',
    })
    assert.deepEqual(cloudStatusForFlyState('online', 'stopped'), {
      status: 'stopped',
      gateway: 'down',
    })
    assert.deepEqual(cloudStatusForFlyState('parked', 'stopped'), {
      status: 'parked',
      gateway: 'down',
    })
    assert.equal(cloudStatusForFlyState('online', 'mystery'), null)
  })
})
