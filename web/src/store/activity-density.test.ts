// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetTestLocalStorage } from '@/chat/test-local-storage'

const STORAGE_KEY = 'work4you.desktop.activityDensity'

describe('activity density', () => {
  beforeEach(() => {
    resetTestLocalStorage()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('defaults to balanced', async () => {
    const { $activityDensity } = await import('@/store/activity-density')

    expect($activityDensity.get()).toBe('balanced')
  })

  it('restores a stored choice and falls back on anything else', async () => {
    for (const [stored, expected] of [
      ['compact', 'compact'],
      ['detailed', 'detailed'],
      ['technical', 'balanced']
    ] as const) {
      window.localStorage.setItem(STORAGE_KEY, stored)
      vi.resetModules()

      const { $activityDensity } = await import('@/store/activity-density')

      expect($activityDensity.get()).toBe(expected)
    }
  })

  it('persists a change, and the tool view follows it', async () => {
    const { setActivityDensity } = await import('@/store/activity-density')
    const { $toolViewMode } = await import('@/store/tool-view')

    setActivityDensity('detailed')

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('detailed')
    expect($toolViewMode.get()).toBe('technical')

    setActivityDensity('compact')

    expect($toolViewMode.get()).toBe('product')
  })
})
