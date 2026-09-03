// Curation for the desktop "Skills & Tools → Toolsets" list.
//
// `GET /api/tools/toolsets` returns the full CONFIGURABLE_TOOLSETS set with no
// desktop-specific filter — so it surfaces entries that don't belong in a flat
// per-user list on the desktop: platform-coupled toolsets (which
// `work4you tools` already platform-restricts on the CLI) and internal plumbing
// that isn't a user-facing capability. Mirror the curation approach used for
// slash commands (`desktop-slash-commands.ts`): one documented block-list, one
// predicate. Hiding a toolset only removes its row — its enabled state and
// runtime gating are untouched.
//
// Presence / toggleability: keep the name fallbacks in sync with
// `ALWAYS_ON_TOOLSETS` / `_CONFIG_ONLY_TOOLSETS` in work4you_cli/tools_config.py.
// Newer backends send `presence` + `toggleable` on each row; those win.
const DESKTOP_HIDDEN_TOOLSETS = new Set([
  // Platform-coupled — only meaningful when that platform is the active
  // adapter; `work4you tools` restricts these off the CLI too.
  'discord',
  'discord_admin',
  'yuanbao',
  // Internal plumbing, not a user capability toggle.
  'context_engine',
  'moa',
  // Not a model toolset — Speech-to-Text lives in Voice settings.
  'stt'
])

/** Core agent work. Capabilities must not offer an on/off switch. */
export const ALWAYS_ON_TOOLSETS = new Set([
  'web',
  'browser',
  'terminal',
  'file',
  'code_execution',
  'vision',
  'skills',
  'todo',
  'memory',
  'session_search',
  'clarify',
  'delegation',
  'cronjob',
  'computer_use'
])

export const CONFIG_ONLY_TOOLSETS = new Set(['stt'])

export interface ToolsetPresenceRow {
  name: string
  presence?: string
  toggleable?: boolean
}

export function isDesktopToolsetVisible(name: string): boolean {
  return !DESKTOP_HIDDEN_TOOLSETS.has(name)
}

export function isToolsetToggleable(toolset: ToolsetPresenceRow): boolean {
  if (typeof toolset.toggleable === 'boolean') {
    return toolset.toggleable
  }
  if (toolset.presence === 'always_on' || toolset.presence === 'config_only') {
    return false
  }
  return !ALWAYS_ON_TOOLSETS.has(toolset.name) && !CONFIG_ONLY_TOOLSETS.has(toolset.name)
}
