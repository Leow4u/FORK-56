// Curation for the Capabilities → Tools list.
//
// Same block-list as apps/desktop/src/lib/desktop-toolsets.ts. Hiding a row
// does not change enabled state or runtime gating. Files sidebar, Skills Hub,
// and Settings → Workspace `code_execution.mode` stay on their own surfaces.
const DESKTOP_HIDDEN_TOOLSETS = new Set([
  'discord',
  'discord_admin',
  'yuanbao',
  'context_engine',
  'moa',
  'web',
  'browser',
  'terminal',
  'file',
  'code_execution',
  'skills',
  'memory',
  'computer_use'
])

const HIDDEN_CAPABILITIES_VENDOR_CREDENTIALS = new Set([
  'BRAVE_SEARCH_API_KEY',
  'BROWSERBASE_API_KEY',
  'BROWSERBASE_PROJECT_ID',
  'BROWSER_USE_API_KEY',
  'CAMOFOX_API_KEY',
  'CAMOFOX_URL',
  'EXA_API_KEY',
  'FIRECRAWL_API_KEY',
  'FIRECRAWL_API_URL',
  'FIRECRAWL_BROWSER_TTL',
  'PARALLEL_API_KEY',
  'SEARXNG_URL',
  'TAVILY_API_KEY',
  'TAVILY_BASE_URL'
])

export function isDesktopToolsetVisible(name: string): boolean {
  return !DESKTOP_HIDDEN_TOOLSETS.has(name)
}

export function isCapabilitiesVendorCredentialHidden(key: string): boolean {
  return HIDDEN_CAPABILITIES_VENDOR_CREDENTIALS.has(key)
}
