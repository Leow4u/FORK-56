import { describe, expect, it } from 'vitest'

import { TRANSLATIONS } from './catalog'

describe('empty-chat placeholder copy', () => {
  it('keeps the composer hint a short statement, not a second headline', () => {
    for (const locale of Object.values(TRANSLATIONS)) {
      const pool = locale.composer.newSessionPlaceholders

      expect(pool.length).toBeGreaterThan(0)
      expect(pool.length).toBeLessThanOrEqual(2)

      for (const line of pool) {
        expect(line.trim().length).toBeGreaterThan(0)
        expect(line).not.toMatch(/[?？]/)
      }
    }
  })

  it('gives Select workspace its own palette hint', () => {
    for (const locale of Object.values(TRANSLATIONS)) {
      const { searchPlaceholder, selectWorkspacePlaceholder } = locale.commandCenter

      expect(selectWorkspacePlaceholder.trim().length).toBeGreaterThan(0)
      expect(selectWorkspacePlaceholder).not.toBe(searchPlaceholder)
    }
  })
})
