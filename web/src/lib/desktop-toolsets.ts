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

export function isDesktopToolsetVisible(name: string): boolean {
  return !DESKTOP_HIDDEN_TOOLSETS.has(name)
}
