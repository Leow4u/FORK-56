/**
 * Run: node --import ./cloud/nas-sync/src/lib/__tests__/register-ts-resolve.mjs --test cloud/nas-sync/src/lib/__tests__/prorated-upgrade-credits.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { proratedUpgradeCredits } from '../tiers.ts'

describe('proratedUpgradeCredits', () => {
  it('returns zero when target allowance is not higher', () => {
    const end = new Date('2026-06-01T00:00:00.000Z')
    const start = new Date('2026-05-01T00:00:00.000Z')
    assert.equal(
      proratedUpgradeCredits({
        currentMonthlyCredits: '110',
        targetMonthlyCredits: '22',
        cycleEndsAt: end,
        cycleStartedAt: start,
        effectiveAt: new Date('2026-05-15T00:00:00.000Z'),
      }),
      '0',
    )
  })

  it('prorates by remaining fraction of the cycle', () => {
    const end = new Date('2026-06-01T00:00:00.000Z')
    const start = new Date('2026-05-01T00:00:00.000Z')
    const mid = new Date('2026-05-16T00:00:00.000Z')
    const grant = proratedUpgradeCredits({
      currentMonthlyCredits: '22',
      targetMonthlyCredits: '110',
      cycleEndsAt: end,
      cycleStartedAt: start,
      effectiveAt: mid,
    })
    assert.ok(Number(grant) > 0)
    assert.ok(Number(grant) < 88)
  })

  it('floors at cents', () => {
    const end = new Date('2026-06-01T00:00:00.000Z')
    const start = new Date('2026-05-01T00:00:00.000Z')
    const grant = proratedUpgradeCredits({
      currentMonthlyCredits: '22',
      targetMonthlyCredits: '22.01',
      cycleEndsAt: end,
      cycleStartedAt: start,
      effectiveAt: new Date('2026-05-31T23:59:00.000Z'),
    })
    assert.match(grant, /^\d+\.\d{2}$/)
  })
})
