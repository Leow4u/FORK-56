import { describe, expect, it } from 'vitest'

import { TRANSLATIONS } from './catalog'

describe('empty-chat placeholder copy', () => {
  it('keeps a rotating new-session placeholder pool', () => {
    for (const locale of Object.values(TRANSLATIONS)) {
      const pool = locale.composer.newSessionPlaceholders

      expect(pool.length).toBeGreaterThan(1)
      expect(new Set(pool).size).toBe(pool.length)

      for (const line of pool) {
        expect(line.trim().length).toBeGreaterThan(0)
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
