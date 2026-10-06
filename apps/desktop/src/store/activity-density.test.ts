import { afterEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'work4you.desktop.activityDensity'

describe('activity density', () => {
  afterEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('defaults to compact', async () => {
    const { $activityDensity } = await import('@/store/activity-density')

    expect($activityDensity.get()).toBe('compact')
  })

  it('restores a stored choice and falls back on anything else', async () => {
    for (const [stored, expected] of [
      ['balanced', 'balanced'],
      ['detailed', 'detailed'],
      ['technical', 'compact']
    ] as const) {
      window.localStorage.setItem(STORAGE_KEY, stored)
      vi.resetModules()

      const { $activityDensity } = await import('@/store/activity-density')

      expect($activityDensity.get()).toBe(expected)
    }
  })

  it('persists a change', async () => {
    const { setActivityDensity } = await import('@/store/activity-density')

    setActivityDensity('balanced')

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('balanced')
  })
})
