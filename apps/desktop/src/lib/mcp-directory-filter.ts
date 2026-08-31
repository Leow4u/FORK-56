/** Client-side directory filters for the MCP Capabilities tab.
 *
 *  Connected = already in `mcp_servers`. Available = catalog entries not yet
 *  installed. Search matches name + description only — no new catalog fields.
 */
export type McpDirectoryFilter = 'all' | 'connected' | 'available'

export function mcpDirectoryQueryHit(fields: ReadonlyArray<null | string | undefined>, query: string): boolean {
  const needle = query.trim().toLowerCase()

  if (!needle) {
    return true
  }

  return fields.some(field => (field ?? '').toLowerCase().includes(needle))
}

export function mcpDirectoryShowsConnected(filter: McpDirectoryFilter): boolean {
  return filter === 'all' || filter === 'connected'
}

export function mcpDirectoryShowsAvailable(filter: McpDirectoryFilter): boolean {
  return filter === 'all' || filter === 'available'
}

/** OAuth catalog entries use the same install handler; the label is Connect. */
export function mcpCatalogPrimaryAction(authType: string | undefined): 'connect' | 'install' {
  return authType === 'oauth' ? 'connect' : 'install'
}
