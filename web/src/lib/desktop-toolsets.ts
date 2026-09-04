// Curation for the Capabilities → Tools list.
//
// Same block-list as apps/desktop/src/lib/desktop-toolsets.ts. Hiding a row
// does not change enabled state unless that toolset is also default-off in
// `work4you_cli/tools_config.py` (`a2a`, `bfl`). Files sidebar, Skills Hub,
// the Cron page (`/cron`), Settings → Workspace `code_execution.mode`,
// Settings → Memory & Context, and Settings → Models stay on their own surfaces.
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
  'computer_use',
  'vision',
  'clarify',
  // Specialist plugin, off by default. Hide the catalog row; do not enable it.
  'a2a',
  // Native BFL FLUX 3 extras. Hide the catalog row; leave the toolset off.
  // `video_gen` stays visible. CLI `work4you tools enable bfl` still works.
  'bfl',
  // Agent scheduling tool. Hide the Capabilities row only. Dedicated Cron
  // UI (`/cron`), chat sidebar jobs, CLI `work4you cron`, and the runtime
  // `cronjob` tool stay.
  'cronjob'
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
