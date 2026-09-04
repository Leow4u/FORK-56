// Curation for the desktop "Skills & Tools → Toolsets" list.
//
// `GET /api/tools/toolsets` returns the full CONFIGURABLE_TOOLSETS set with no
// desktop-specific filter — so it surfaces entries that don't belong in a flat
// per-user toggle list on the desktop: platform-coupled toolsets (which
// `work4you tools` already platform-restricts on the CLI) and internal plumbing
// that isn't a user-facing capability. Mirror the curation approach used for
// slash commands (`desktop-slash-commands.ts`): one documented block-list, one
// predicate. Hiding a toolset only removes its Capabilities row — enabled
// state, tool registration, and runtime gating stay exactly as they are.
//
// Core agent toolsets are also hidden here: the user must not see or configure
// them in Capabilities. Files sidebar, Skills Hub, Settings → Workspace
// `code_execution.mode`, Settings → Memory & Context, and Settings → Models
// are different surfaces and stay. Keep in sync with
// web/src/lib/desktop-toolsets.ts.
const DESKTOP_HIDDEN_TOOLSETS = new Set([
  // Platform-coupled — only meaningful when that platform is the active
  // adapter; `work4you tools` restricts these off the CLI too.
  'discord',
  'discord_admin',
  'yuanbao',
  // Internal plumbing, not a user capability toggle.
  'context_engine',
  'moa',
  // Always-on agent work — not a Capabilities catalog the user configures.
  'web',
  'browser',
  'terminal',
  'file',
  'code_execution',
  'skills',
  'memory',
  'computer_use',
  'vision',
  'clarify'
])

// BYOK credentials for hidden Web Search / Browser cloud vendors.
// Work4You Subscription uses the Portal token; users must not paste vendor keys.
// Keep XAI_API_KEY visible — it is also the Grok model credential.
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
