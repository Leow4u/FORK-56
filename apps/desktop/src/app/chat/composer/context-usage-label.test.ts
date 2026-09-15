import { describe, expect, it } from 'vitest'

import type { ContextBreakdown, UsageStats } from '@/types/work4you'

import { contextUsagePercent, contextUsagePercentLabel, mergeContextGaugeUsage } from './context-usage-label'

const usage: UsageStats = {
  calls: 1,
  context_max: 272_000,
  context_percent: 47.4,
  context_used: 128_200,
  input: 0,
  output: 0,
  total: 0
}

describe('contextUsagePercent', () => {
  it('rounds and clamps occupancy, including a session with no max', () => {
    expect(contextUsagePercent(usage)).toBe(47)
    expect(contextUsagePercent({ context_percent: 140 })).toBe(100)
    expect(contextUsagePercent({ context_percent: -4 })).toBe(0)
    expect(contextUsagePercent({})).toBe(0)
    expect(contextUsagePercentLabel({})).toBe('0%')
    expect(contextUsagePercentLabel(usage)).toBe('47%')
  })
})

describe('mergeContextGaugeUsage', () => {
  it('lets the session breakdown override streamed occupancy', () => {
    const breakdown: ContextBreakdown = {
      categories: [],
      context_max: 200_000,
      context_percent: 89,
      context_used: 178_000,
      estimated_total: 178_000,
      model: 'test-model'
    }

    expect(mergeContextGaugeUsage(usage, null)).toBe(usage)
    expect(mergeContextGaugeUsage(usage, breakdown)).toMatchObject({
      context_max: 200_000,
      context_percent: 89,
      context_used: 178_000
    })
  })
})
