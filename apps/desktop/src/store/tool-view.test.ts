import { afterEach, describe, expect, it, vi } from 'vitest'

describe('tool view', () => {
  afterEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('stays on product when a technical choice was stored', async () => {
    window.localStorage.setItem('work4you.desktop.toolView.technical', 'true')
    vi.resetModules()

    const { $toolViewMode } = await import('@/store/tool-view')

    expect($toolViewMode.get()).toBe('product')
    expect(window.localStorage.getItem('work4you.desktop.toolView.technical')).toBe('false')
  })
})
