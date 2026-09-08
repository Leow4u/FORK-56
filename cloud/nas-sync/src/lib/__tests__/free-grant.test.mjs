/**
 * Free grant + hide-dollars helpers.
 * Run: node --test cloud/nas-sync/src/lib/__tests__/free-grant.test.mjs
 *
 * Mirrors shouldRolloverFreeCycle / shouldUpgradeLegacyFreeGrant (tiers.ts)
 * and isFreePlanPayload / catalogTierCopy / isCurrentCatalogTier /
 * markCatalogCurrent (billing-client.ts) so we don't need the Next/Prisma graph.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

const LEGACY_FREE_MONTHLY_CREDITS = '0.10'

function isFreeTierId(id) {
  return !id || id === 'free'
}

function moneyCmp(a, b) {
  return Number(a || 0) - Number(b || 0)
}

function shouldRolloverFreeCycle(tierId, cycleEndsAt, now = new Date()) {
  if (!isFreeTierId(tierId)) return false
  if (!cycleEndsAt) return false
  return cycleEndsAt.getTime() <= now.getTime()
}

function shouldUpgradeLegacyFreeGrant(params) {
  if (!isFreeTierId(params.tierId)) return false
  if (moneyCmp(params.spentThisPeriodUsd || '0', '0') !== 0) return false
  return moneyCmp(params.creditsUsd || '0', LEGACY_FREE_MONTHLY_CREDITS) === 0
}

function isFreePlanPayload(billing, subscription) {
  const current = subscription?.current
  if (current?.tierId && current.tierId !== 'free') return false
  const plan = (current?.tierName || billing?.planName || '').trim().toLowerCase()
  if (plan && plan !== 'free') return false
  if (current?.tierId === 'free' || plan === 'free') return true
  if (billing?.subscriptionTierId && billing.subscriptionTierId !== 'free') {
    return false
  }
  if (billing?.subscriptionTierId === 'free') return true
  return subscription != null && current == null
}

function isFreeCatalogTier(tier) {
  if ((tier.name || '').trim().toLowerCase() === 'free') return true
  return (tier.tierId || '').trim().toLowerCase() === 'free'
}

function formatUsdDisplay(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return `$${raw}`
  if (Number.isInteger(n)) return `$${n}`
  return `$${n.toFixed(2)}`
}

function catalogTierCopy(tier) {
  if (isFreeCatalogTier(tier)) {
    return { bonus: 'Allowance mensal', title: tier.name }
  }
  return {
    bonus: `${formatUsdDisplay(tier.monthlyCredits)} créditos mensais`,
    title: `${tier.name} (${formatUsdDisplay(tier.dollarsPerMonthDisplay)}/mês)`,
  }
}

describe('shouldRolloverFreeCycle', () => {
  it('refills Free when cycleEndsAt is due', () => {
    assert.equal(
      shouldRolloverFreeCycle('free', new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z')),
      true,
    )
  })

  it('does not refill paid or a live Free cycle', () => {
    const now = new Date('2026-02-01T00:00:00Z')
    assert.equal(shouldRolloverFreeCycle('plus', new Date('2026-01-01T00:00:00Z'), now), false)
    assert.equal(shouldRolloverFreeCycle('free', new Date('2026-03-01T00:00:00Z'), now), false)
    assert.equal(shouldRolloverFreeCycle('free', null, now), false)
  })
})

describe('shouldUpgradeLegacyFreeGrant', () => {
  it('lifts unused leftover 0.10 on Free', () => {
    assert.equal(
      shouldUpgradeLegacyFreeGrant({
        tierId: 'free',
        creditsUsd: '0.10',
        spentThisPeriodUsd: '0',
      }),
      true,
    )
  })

  it('skips orgs that already spent this cycle', () => {
    assert.equal(
      shouldUpgradeLegacyFreeGrant({
        tierId: 'free',
        creditsUsd: '0.10',
        spentThisPeriodUsd: '0.02',
      }),
      false,
    )
  })

  it('skips paid and already-upgraded grants', () => {
    assert.equal(
      shouldUpgradeLegacyFreeGrant({
        tierId: 'plus',
        creditsUsd: '0.10',
        spentThisPeriodUsd: '0',
      }),
      false,
    )
    assert.equal(
      shouldUpgradeLegacyFreeGrant({
        tierId: 'free',
        creditsUsd: '5',
        spentThisPeriodUsd: '0',
      }),
      false,
    )
  })
})

describe('isFreePlanPayload', () => {
  it('treats NAS Free (current null + plan Free) as Free', () => {
    assert.equal(
      isFreePlanPayload({ planName: 'Free', subscriptionTierId: 'free' }, { current: null }),
      true,
    )
  })

  it('does not hide dollars on Plus or unknown', () => {
    assert.equal(
      isFreePlanPayload(
        { planName: 'Plus', subscriptionTierId: 'plus' },
        { current: { tierId: 'plus', tierName: 'Plus' } },
      ),
      false,
    )
    assert.equal(isFreePlanPayload(undefined, undefined), false)
  })
})

describe('catalogTierCopy', () => {
  it('never names the Free grant in dollars', () => {
    const copy = catalogTierCopy({
      tierId: 'free',
      name: 'Free',
      dollarsPerMonthDisplay: '0',
      monthlyCredits: '5',
    })
    assert.equal(copy.title, 'Free')
    assert.equal(copy.bonus, 'Allowance mensal')
    assert.equal(/\$/.test(copy.title + (copy.bonus || '')), false)
  })

  it('keeps paid plan prices', () => {
    const copy = catalogTierCopy({
      tierId: 'plus',
      name: 'Plus',
      dollarsPerMonthDisplay: '20',
      monthlyCredits: '22',
    })
    assert.equal(copy.title, 'Plus ($20/mês)')
    assert.equal(copy.bonus, '$22 créditos mensais')
  })
})

function isPaidSubscriptionCurrent(current) {
  if (!current?.tierId || current.tierId === 'free') return false
  return (current.tierName || '').trim().toLowerCase() !== 'free'
}

function isCurrentCatalogTier(tier, current) {
  if (!isPaidSubscriptionCurrent(current)) {
    return isFreeCatalogTier(tier)
  }
  return Boolean(tier.isCurrent) || tier.tierId === current.tierId
}

function markCatalogCurrent(tiers, current) {
  return tiers.map((tier) => ({
    ...tier,
    isCurrent: isPaidSubscriptionCurrent(current)
      ? tier.tierId === current.tierId
      : isFreeCatalogTier(tier),
  }))
}

const PAID_ONLY = [
  { tierId: 'plus', name: 'Plus', isCurrent: true },
  { tierId: 'super', name: 'Super', isCurrent: false },
  { tierId: 'ultra', name: 'Ultra', isCurrent: false },
]

describe('isCurrentCatalogTier', () => {
  it('never treats Plus as current when subscription.current is null', () => {
    assert.equal(isCurrentCatalogTier(PAID_ONLY[0], null), false)
    assert.equal(isCurrentCatalogTier({ tierId: 'free', name: 'Free' }, null), true)
  })

  it('matches a paid current by tier id', () => {
    assert.equal(
      isCurrentCatalogTier(PAID_ONLY[0], { tierId: 'plus', tierName: 'Plus' }),
      true,
    )
    assert.equal(
      isCurrentCatalogTier(PAID_ONLY[1], { tierId: 'plus', tierName: 'Plus' }),
      false,
    )
  })
})

describe('markCatalogCurrent', () => {
  it('stamps only Free when current is null, even if Plus arrived as isCurrent', () => {
    const stamped = markCatalogCurrent(
      [{ tierId: 'free', name: 'Free' }, ...PAID_ONLY],
      null,
    )
    assert.deepEqual(
      stamped.map((t) => [t.tierId, t.isCurrent]),
      [
        ['free', true],
        ['plus', false],
        ['super', false],
        ['ultra', false],
      ],
    )
  })

  it('stamps the matching paid tier', () => {
    const stamped = markCatalogCurrent(PAID_ONLY, { tierId: 'super', tierName: 'Super' })
    assert.equal(stamped.find((t) => t.tierId === 'super')?.isCurrent, true)
    assert.equal(stamped.find((t) => t.tierId === 'plus')?.isCurrent, false)
  })
})
