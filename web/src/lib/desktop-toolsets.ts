// Curation for the Capabilities → Tools list.
//
// Same block-list as apps/desktop/src/lib/desktop-toolsets.ts. Hiding a row
// does not change enabled state unless that toolset is also default-off in
// `work4you_cli/tools_config.py` (`a2a`, `bfl`, `homeassistant`, `spotify`,
// `video`, `x_search`). Files sidebar, Skills Hub,
// the Cron page (`/cron`), Settings → Workspace `code_execution.mode`,
// Settings → Memory & Context, Settings → Models, and Settings → Voice stay
// on their own surfaces.
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
  'cronjob',
  // Smart-home REST tools (ha_*). Already default-off without HASS_TOKEN.
  // Hide the catalog row and leave it off. Messaging Home Assistant is a
  // different surface.
  'homeassistant',
  // Past-conversation recall. Hide the Capabilities row only.
  'session_search',
  // Already default-off. Hide the catalog row and leave it off.
  'spotify',
  // Subagent spawn. Hide the Capabilities row only.
  'delegation',
  // `todo` tool. Hide the Capabilities row only. Composer todo UI stays.
  'todo',
  // `video_analyze`. Already default-off. `video_gen` stays visible.
  'video',
  // xAI Twitter/X search. Already default-off. Leave it off — Grok keys
  // must not auto-enable it. CLI `work4you tools enable x_search` still works.
  'x_search',
  // Speech-to-Text. Hide the Capabilities row. Runtime stays on with Work4You
  // Subscription. Do not default-off. CLI and Settings → Voice stay.
  'stt',
  // Text-to-Speech. Hide the Capabilities row. Runtime stays on with Work4You
  // Subscription. Voice and model stay in Settings → Voice. Do not default-off.
  'tts'
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
  'TAVILY_BASE_URL',
  'HASS_TOKEN',
  'HASS_URL',
  'FAL_KEY',
  'KREA_API_KEY',
  'DEEPINFRA_API_KEY'
])

/** Exact picker-row name of the managed Subscription backend. Do not
 *  prefix-match — browser uses "Work4You Subscription (Browser Use cloud)". */
export const IMAGE_GEN_SUBSCRIPTION_PROVIDER = 'Work4You Subscription'

const SUBSCRIPTION_ONLY_TOOLSETS = new Set(['image_gen', 'stt'])

export function isDesktopToolsetVisible(name: string): boolean {
  return !DESKTOP_HIDDEN_TOOLSETS.has(name)
}

export function isCapabilitiesVendorCredentialHidden(key: string): boolean {
  return HIDDEN_CAPABILITIES_VENDOR_CREDENTIALS.has(key)
}

/** Image Generation keeps only the managed Subscription row. Speech-to-Text
 *  and Text-to-Speech are hidden from the catalog; the STT filter still applies
 *  if its pane is opened. Settings → Voice is the TTS surface. */
export function isCapabilitiesToolsetProviderVisible(toolset: string, providerName: string): boolean {
  if (!SUBSCRIPTION_ONLY_TOOLSETS.has(toolset)) {
    return true
  }

  return providerName === IMAGE_GEN_SUBSCRIPTION_PROVIDER
}
