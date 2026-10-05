import { afterEach, describe, expect, it, vi } from 'vitest'

describe('tool view', () => {
  afterEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  // The standalone technical toggle is retired; its stored choice must not
  // smuggle the technical view back in. Density alone decides.
  it('ignores a technical choice stored by the retired toggle', async () => {
    window.localStorage.setItem('work4you.desktop.toolView.technical', 'true')
    vi.resetModules()

    const { $toolViewMode } = await import('@/store/tool-view')

    expect($toolViewMode.get()).toBe('product')
  })

  it('is technical exactly when the transcript is detailed', async () => {
    const { $toolViewMode } = await import('@/store/tool-view')
    const { setActivityDensity } = await import('@/store/activity-density')

    for (const density of ['compact', 'balanced', 'detailed'] as const) {
      setActivityDensity(density)
      expect($toolViewMode.get()).toBe(density === 'detailed' ? 'technical' : 'product')
    }
  })
})
