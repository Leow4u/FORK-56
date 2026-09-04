// Curation for the Capabilities → Tools list.
//
// Same block-list as apps/desktop/src/lib/desktop-toolsets.ts. `GET /api/tools/toolsets`
// returns the full CONFIGURABLE_TOOLSETS set with no dashboard-specific filter,
// so it surfaces platform-coupled toolsets and internal plumbing that are not
// a user-facing toggle. Hiding a row does not change enabled state or runtime
// gating.
const DESKTOP_HIDDEN_TOOLSETS = new Set([
  'discord',
  'discord_admin',
  'yuanbao',
  'context_engine',
  'moa'
])

// Keep in sync with apps/desktop/src/lib/desktop-toolsets.ts.
const CAPABILITIES_TOGGLE_HIDDEN_TOOLSETS = new Set(['web', 'memory'])
const CAPABILITIES_CONFIG_HIDDEN_TOOLSETS = new Set(['web'])
const HIDDEN_WEB_SEARCH_VENDOR_CREDENTIALS = new Set([
  'BRAVE_SEARCH_API_KEY',
  'EXA_API_KEY',
  'FIRECRAWL_API_KEY',
  'FIRECRAWL_API_URL',
  'PARALLEL_API_KEY',
  'SEARXNG_URL',
  'TAVILY_API_KEY',
  'TAVILY_BASE_URL'
])

export function isDesktopToolsetVisible(name: string): boolean {
  return !DESKTOP_HIDDEN_TOOLSETS.has(name)
}

export function isCapabilitiesToolsetToggleHidden(name: string): boolean {
  return CAPABILITIES_TOGGLE_HIDDEN_TOOLSETS.has(name)
}

export function isCapabilitiesToolsetConfigHidden(name: string): boolean {
  return CAPABILITIES_CONFIG_HIDDEN_TOOLSETS.has(name)
}

export function isWebSearchVendorCredentialHidden(key: string): boolean {
  return HIDDEN_WEB_SEARCH_VENDOR_CREDENTIALS.has(key)
}
