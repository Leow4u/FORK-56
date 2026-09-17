import { describe, expect, it } from 'vitest'

import { work4youTheme } from '@/themes/presets'

import { isMainStageZone, MAIN_STAGE_TAB_STRIP_CLASS, mainStageCornerClass } from './stage-chrome'

describe('mainStageCornerClass', () => {
  it('rounds only the top corner that faces the sidebar', () => {
    expect(mainStageCornerClass(true)).toBe('rounded-tl-(--ui-stage-radius)')
    expect(mainStageCornerClass(false)).toBe('rounded-tr-(--ui-stage-radius)')
  })

  it('does not inset the stage or round the bottom', () => {
    expect(mainStageCornerClass(true)).not.toMatch(/rounded-bl|m-|p-|inset/)
    expect(mainStageCornerClass(false)).not.toMatch(/rounded-br|m-|p-|inset/)
  })
})

describe('isMainStageZone', () => {
  const isStagePane = (id: string) => id === 'workspace' || id.startsWith('session-tile:')

  it('marks the conversation zone, not side chrome', () => {
    expect(isMainStageZone(['workspace', 'session-tile:abc'], isStagePane)).toBe(true)
    expect(isMainStageZone(['sessions', 'files'], isStagePane)).toBe(false)
  })
})

describe('main stage tab strip', () => {
  it('paints the strip on the chat surface instead of the sidebar rail', () => {
    expect(MAIN_STAGE_TAB_STRIP_CLASS).toContain('--ui-chat-surface-background')
    expect(MAIN_STAGE_TAB_STRIP_CLASS).not.toContain('sidebar-surface')
  })
})

describe('work4you light rail vs stage', () => {
  it('keeps the sidebar a step below the canvas without a new hue', () => {
    const { background, sidebarBackground } = work4youTheme.colors

    expect(sidebarBackground).toBeDefined()
    expect(sidebarBackground).not.toBe(background)
    expect(sidebarBackground!.startsWith('#')).toBe(true)
    expect(background.startsWith('#')).toBe(true)
  })
})
