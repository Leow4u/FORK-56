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

  it('gives Select project its own palette hint', () => {
    for (const locale of Object.values(TRANSLATIONS)) {
      const { searchPlaceholder, selectWorkspacePlaceholder } = locale.commandCenter

      expect(selectWorkspacePlaceholder.trim().length).toBeGreaterThan(0)
      expect(selectWorkspacePlaceholder).not.toBe(searchPlaceholder)
      expect(selectWorkspacePlaceholder).not.toMatch(/remote|リモート|远程|遠端|عن بُعد/i)
    }
  })

  it('names the composer chip after a project, not a workspace', () => {
    // The chip selects a saved project; calling it a workspace promised a
    // folder picker it never was.
    for (const locale of Object.values(TRANSLATIONS)) {
      expect(locale.commandCenter.selectWorkspace).not.toMatch(/workspace|ワークスペース|工作区|工作區|مساحة العمل/i)
      expect(locale.sidebar.projects.createDesc).not.toMatch(/workspace|ワークスペース|工作区|工作區|مساحة العمل/i)
    }
  })
})
