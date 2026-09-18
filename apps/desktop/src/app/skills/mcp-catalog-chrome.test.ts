import { describe, expect, it } from 'vitest'

import { PAGE_MAX_W } from '../layout-constants'
import { RAIL_ZONE_SURFACE_CLASS } from '../shell/stage-chrome'

import {
  MCP_CATALOG_COLUMN_CLASS,
  MCP_CATALOG_GRID_CLASS,
  MCP_CONNECTOR_CARD_CLASS,
  MCP_DIRECTORY_VIEW_IDS
} from './mcp-catalog-chrome'

describe('MCP directory views', () => {
  it('keeps Discover and Connected, not All or Available', () => {
    expect(MCP_DIRECTORY_VIEW_IDS).toEqual(['discover', 'connected'])
    expect(MCP_DIRECTORY_VIEW_IDS).not.toContain('all')
    expect(MCP_DIRECTORY_VIEW_IDS).not.toContain('available')
  })
})

describe('MCP catalog column', () => {
  it('reuses the existing overlay page cap', () => {
    expect(MCP_CATALOG_COLUMN_CLASS).toContain(PAGE_MAX_W)
    expect(MCP_CATALOG_COLUMN_CLASS).toContain('mx-auto')
  })
})

describe('MCP catalog grid', () => {
  it('stops at two columns', () => {
    expect(MCP_CATALOG_GRID_CLASS).toContain('sm:grid-cols-2')
    expect(MCP_CATALOG_GRID_CLASS).not.toMatch(/grid-cols-3|xl:grid-cols/)
  })
})

describe('MCP connector card', () => {
  it('sits on the paper and paints the rail on hover', () => {
    expect(MCP_CONNECTOR_CARD_CLASS).toContain('hover:bg-(--ui-sidebar-surface-background)')
    expect(MCP_CONNECTOR_CARD_CLASS).toContain('focus-within:bg-(--ui-sidebar-surface-background)')
    expect(RAIL_ZONE_SURFACE_CLASS).toContain('--ui-sidebar-surface-background')
    expect(MCP_CONNECTOR_CARD_CLASS).not.toMatch(/bg-muted|ui-bg-secondary|min-h-/)
  })
})
