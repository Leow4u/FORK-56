// Curation for the desktop "Skills & Tools → Toolsets" list.
//
// `GET /api/tools/toolsets` returns the full CONFIGURABLE_TOOLSETS set with no
// desktop-specific filter — so it surfaces entries that don't belong in a flat
// per-user toggle list on the desktop: platform-coupled toolsets (which
// `work4you tools` already platform-restricts on the CLI) and internal plumbing
// that isn't a user-facing capability. Mirror the curation approach used for
// slash commands (`desktop-slash-commands.ts`): one documented block-list, one
// predicate. Hiding a toolset only removes its Capabilities row. Runtime
// enablement is unchanged unless that toolset is also default-off in
// `work4you_cli/tools_config.py` (`a2a`, `bfl`, `homeassistant`, `spotify`,
// `video`, `x_search`).
//
// Core agent toolsets are also hidden here: the user must not see or configure
// them in Capabilities. Files sidebar, Skills Hub, the Cron page (`/cron`),
// Settings → Workspace `code_execution.mode`, Settings → Memory & Context,
// and Settings → Models are different surfaces and stay. Keep in sync with
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
  'clarify',
  // Specialist plugin, off by default. Hide the catalog row; do not enable it.
  // A later dedicated UI can collect a peer URL/token on top of this plugin.
  'a2a',
  // Native BFL FLUX 3 extras (keyframes / continuation). Hide the catalog
  // row and leave the toolset off — `video_gen` / `video_generate` stays the
  // user-facing video surface. CLI `work4you tools enable bfl` still works.
  'bfl',
  // Agent scheduling tool. Hide the Capabilities row only. Dedicated Cron
  // UI (`/cron`), chat sidebar jobs, CLI `work4you cron`, and the runtime
  // `cronjob` tool stay.
  'cronjob',
  // Smart-home REST tools (ha_*). Already default-off without HASS_TOKEN.
  // Hide the catalog row and leave it off. CLI still lists it; token auto-
  // enable stays so a later opt-in via `work4you tools` / .env still works.
  // The Home Assistant messaging channel is a different surface.
  'homeassistant',
  // Past-conversation recall tool. Hide the Capabilities row only. Session
  // list / sidebar search and CLI stay.
  'session_search',
  // Spotify playback plugin. Already default-off. Hide the catalog row and
  // leave it off. CLI `work4you tools enable spotify` / `work4you auth
  // spotify` still work. Chat Spotify URL embeds are a different surface.
  'spotify',
  // Subagent spawn (`delegate_task`). Hide the Capabilities row only. The
  // Agents page, composer subagent stack, and runtime stay.
  'delegation',
  // `todo` tool. Hide the Capabilities row only. Composer status stack and
  // chat todo UI stay.
  'todo',
  // `video_analyze`. Already default-off. Hide the catalog row and leave it
  // off. `video_gen` / Video Generation stays the user-facing video surface.
  'video',
  // xAI Twitter/X search. Already default-off. Hide the catalog row and leave
  // it off — `XAI_API_KEY` is also a Grok chat-model key and must not turn
  // this toolset on. CLI `work4you tools enable x_search` still works.
  'x_search',
  // Speech-to-Text. Hide the Capabilities row. Runtime stays on — Work4You
  // Subscription (Portal token → openai-audio gateway) is the managed backend.
  // Do not add `stt` to `_DEFAULT_OFF_TOOLSETS`. CLI `work4you tools` still
  // lists it. Settings → Voice is a different surface.
  'stt'
])

// BYOK credentials for hidden Web Search / Browser cloud vendors, Home
// Assistant, and Image Generation vendor backends. Work4You Subscription
// uses the Portal token; users must not paste vendor keys. Keep
// OPENAI_API_KEY / OPENROUTER_API_KEY / XAI_API_KEY visible — they are
// also chat-model credentials.
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
 *  is hidden from the catalog; the same filter still applies if its pane is
 *  opened. BYOK backends and Local Whisper stay off that pane. Other
 *  toolsets (including TTS) are unfiltered. Runtime selection is unchanged. */
export function isCapabilitiesToolsetProviderVisible(toolset: string, providerName: string): boolean {
  if (!SUBSCRIPTION_ONLY_TOOLSETS.has(toolset)) {
    return true
  }

  return providerName === IMAGE_GEN_SUBSCRIPTION_PROVIDER
}
