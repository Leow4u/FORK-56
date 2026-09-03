// Curation for the Capabilities → Tools list.
//
// Same block-list as apps/desktop/src/lib/desktop-toolsets.ts. `GET /api/tools/toolsets`
// returns the full CONFIGURABLE_TOOLSETS set with no dashboard-specific filter,
// so it surfaces platform-coupled toolsets and internal plumbing that are not
// a user-facing capability. Hiding a row does not change enabled state or
// runtime gating.
//
// Presence / toggleability: keep the name fallbacks in sync with
// `ALWAYS_ON_TOOLSETS` / `_CONFIG_ONLY_TOOLSETS` in work4you_cli/tools_config.py.
const DESKTOP_HIDDEN_TOOLSETS = new Set([
  'discord',
  'discord_admin',
  'yuanbao',
  'context_engine',
  'moa',
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
