import { describe, expect, it } from 'vitest'

import { work4youTheme } from '@/themes/presets'

import {
  isMainStageZone,
  MAIN_STAGE_SURFACE_CLASS,
  MAIN_STAGE_TAB_STRIP_CLASS,
  mainStageCornerClass,
  RAIL_ZONE_SURFACE_CLASS,
  WINDOW_TITLEBAR_RAIL_CLASS
} from './stage-chrome'

describe('mainStageCornerClass', () => {
  it('rounds both top corners into the rail', () => {
    expect(mainStageCornerClass()).toBe('rounded-tl-(--ui-stage-radius) rounded-tr-(--ui-stage-radius)')
  })

  it('does not inset the stage or round the bottom', () => {
    expect(mainStageCornerClass()).not.toMatch(/rounded-bl|rounded-br|m-|p-|inset/)
  })
})

describe('isMainStageZone', () => {
  const isStagePane = (id: string) => id === 'workspace' || id.startsWith('session-tile:')

  it('marks the conversation zone, not side chrome', () => {
    expect(isMainStageZone(['workspace', 'session-tile:abc'], isStagePane)).toBe(true)
    expect(isMainStageZone(['sessions', 'files'], isStagePane)).toBe(false)
  })

  it('does not treat a main-placement chrome tile as the stage', () => {
    expect(isMainStageZone(['work4you-bots:routines'], isStagePane)).toBe(false)
    expect(isMainStageZone(['sessions', 'work4you-bots:pane'], isStagePane)).toBe(false)
  })
})

describe('window titlebar rail', () => {
  it('paints the titlebar with the sidebar, not the chat stage', () => {
    expect(WINDOW_TITLEBAR_RAIL_CLASS).toContain('--ui-sidebar-surface-background')
    expect(WINDOW_TITLEBAR_RAIL_CLASS).not.toContain('chat-surface')
  })
})

describe('zone surfaces', () => {
  it('keeps side chrome on the rail and the conversation on the stage', () => {
    expect(RAIL_ZONE_SURFACE_CLASS).toContain('--ui-sidebar-surface-background')
    expect(RAIL_ZONE_SURFACE_CLASS).not.toContain('chat-surface')
    expect(MAIN_STAGE_SURFACE_CLASS).toContain('--ui-chat-surface-background')
    expect(MAIN_STAGE_SURFACE_CLASS).not.toContain('sidebar-surface')
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
