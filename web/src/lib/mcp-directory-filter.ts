/** Client-side directory filters for the dashboard MCP tab.
 *
 *  Same rules as the desktop helper: connected = configured servers,
 *  available = catalog entries not yet installed. Search is name+description.
 */
export type McpDirectoryFilter = "all" | "connected" | "available";

export function mcpDirectoryQueryHit(
  fields: ReadonlyArray<string | null | undefined>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}

export function mcpDirectoryShowsConnected(filter: McpDirectoryFilter): boolean {
  return filter === "all" || filter === "connected";
}

export function mcpDirectoryShowsAvailable(filter: McpDirectoryFilter): boolean {
  return filter === "all" || filter === "available";
}

export function mcpCatalogPrimaryAction(
  authType: string | undefined,
): "connect" | "install" {
  return authType === "oauth" ? "connect" : "install";
}
