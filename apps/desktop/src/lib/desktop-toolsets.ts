// Curation for the desktop "Skills & Tools → Toolsets" list.
//
// `GET /api/tools/toolsets` returns the full CONFIGURABLE_TOOLSETS set with no
// desktop-specific filter — so it surfaces entries that don't belong in a flat
// per-user toggle list on the desktop: platform-coupled toolsets (which
// `work4you tools` already platform-restricts on the CLI) and internal plumbing
// that isn't a user-facing capability. Mirror the curation approach used for
// slash commands (`desktop-slash-commands.ts`): one documented block-list, one
// predicate. Hiding a toolset only removes its row — its enabled state and
// runtime gating are untouched.
const DESKTOP_HIDDEN_TOOLSETS = new Set([
  // Platform-coupled — only meaningful when that platform is the active
  // adapter; `work4you tools` restricts these off the CLI too.
  'discord',
  'discord_admin',
  'yuanbao',
  // Internal plumbing, not a user capability toggle.
  'context_engine',
  'moa'
])

// Capabilities rows that stay visible, but without an on/off switch. Runtime
// enablement is unchanged (CLI `work4you tools` still owns that). Keep in sync
// with web/src/lib/desktop-toolsets.ts.
const CAPABILITIES_TOGGLE_HIDDEN_TOOLSETS = new Set(['web', 'memory'])

// Capabilities detail that must not expose a vendor picker or key fields.
// Memory has no provider matrix here (Settings → Memory & Context owns that).
const CAPABILITIES_CONFIG_HIDDEN_TOOLSETS = new Set(['web'])

// BYOK web-search credentials. Work4You Subscription uses the Portal token
// against firecrawl-gateway.work4you.ai; users must not paste vendor keys.
// Keep XAI_API_KEY visible — it is also the Grok model credential.
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
