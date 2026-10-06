/**
 * Run: node --experimental-strip-types --import ./cloud/nas-sync/src/lib/__tests__/register-ts-resolve.mjs --test cloud/nas-sync/src/lib/__tests__/prorated-upgrade-credits.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getTier, proratedUpgradeCredits } from '../tiers.ts'

describe('proratedUpgradeCredits', () => {
  it('keeps the current balance and adds the remaining share of the delta', () => {
    const next = proratedUpgradeCredits({
      currentCreditsUsd: '10',
      fromMonthlyCredits: getTier('plus').monthlyCredits,
      toMonthlyCredits: getTier('super').monthlyCredits,
      remainingFraction: 0.5,
    })
    const delta =
      Number(getTier('super').monthlyCredits) - Number(getTier('plus').monthlyCredits)
    assert.equal(Number(next), 10 + delta / 2)
  })

  it('never lowers the balance when the target allowance is not higher', () => {
    const next = proratedUpgradeCredits({
      currentCreditsUsd: '7.5',
      fromMonthlyCredits: getTier('super').monthlyCredits,
      toMonthlyCredits: getTier('plus').monthlyCredits,
      remainingFraction: 0.9,
    })
    assert.equal(Number(next), 7.5)
  })

  it('clamps the fraction and floors the grant to cents', () => {
    const full = proratedUpgradeCredits({
      currentCreditsUsd: '0',
      fromMonthlyCredits: '0',
      toMonthlyCredits: '10',
      remainingFraction: 4,
    })
    assert.equal(Number(full), 10)

    const tiny = proratedUpgradeCredits({
      currentCreditsUsd: '1',
      fromMonthlyCredits: '0',
      toMonthlyCredits: '0.01',
      remainingFraction: 0.99,
    })
    assert.equal(Number(tiny), 1)

    const bad = proratedUpgradeCredits({
      currentCreditsUsd: '',
      fromMonthlyCredits: '0',
      toMonthlyCredits: '10',
      remainingFraction: Number.NaN,
    })
    assert.equal(Number(bad), 0)
  })
})
