/** Org-scoped nav — workspace (agent) vs account (dashboard). */
export interface PortalNavItem {
  id: string
  label: string
  /** Path under `/orgs/:orgId` — empty = org home (agent). */
  segment: string
}

/** Agent-first sidebar: chat home + where the agent runs. */
export const PORTAL_WORKSPACE_NAV: PortalNavItem[] = [
  { id: 'agent', label: 'Agente', segment: '' },
  { id: 'cloud', label: 'Instância Cloud', segment: 'agents' },
  { id: 'local', label: 'Dashboards locais', segment: 'local-dashboards' },
]

/** Billing, keys, and admin — secondary to the agent surface. */
export const PORTAL_ACCOUNT_NAV: PortalNavItem[] = [
  { id: 'billing', label: 'Billing', segment: 'billing' },
  { id: 'api-keys', label: 'API keys', segment: 'api-keys' },
  { id: 'usage', label: 'Usage', segment: 'usage' },
  { id: 'login-sessions', label: 'Sessões OAuth', segment: 'login-sessions' },
  { id: 'settings', label: 'Definições', segment: 'settings' },
  { id: 'info', label: 'Info', segment: 'info' },
]

/** Full list — Info page and legacy callers. */
export const PORTAL_NAV: PortalNavItem[] = [
  ...PORTAL_WORKSPACE_NAV,
  ...PORTAL_ACCOUNT_NAV,
]

export function navPath(orgId: string, segment: string): string {
  return segment ? `/orgs/${orgId}/${segment}` : `/orgs/${orgId}`
}
