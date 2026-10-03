import { LIBRARY_PAGE_MAX_W } from '../layout-constants'

/** Desktop MCP browse tabs. Discover already lists what is not connected. */
export const MCP_DIRECTORY_VIEW_IDS = ['discover', 'connected'] as const

export type McpDirectoryViewId = (typeof MCP_DIRECTORY_VIEW_IDS)[number]

/** Centered catalog column — the Capabilities column, same as the header and
 *  the other tabs. */
export const MCP_CATALOG_COLUMN_CLASS = `mx-auto w-full ${LIBRARY_PAGE_MAX_W}`

/** Two columns, not a wall-to-wall three-up grid. */
export const MCP_CATALOG_GRID_CLASS = 'grid grid-cols-1 gap-2 sm:grid-cols-2'

/**
 * Discover card: a hairline border on the paper at rest, sidebar rail on
 * hover/focus. No muted well — that gray is what made the directory look
 * dated. (Connected is a table, not cards — see mcp-connected-table.)
 */
export const MCP_CONNECTOR_CARD_CLASS =
  'group/card flex min-w-0 flex-col rounded-xl border border-(--ui-stroke-quaternary) px-3 py-2.5 hover:bg-(--ui-sidebar-surface-background) focus-within:bg-(--ui-sidebar-surface-background)'
