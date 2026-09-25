import { SKILLS_ROUTE } from '../routes'

/** Tabs whose pages left the Settings menu. Bookmarks land on Billing. */
const RETIRED_TO_BILLING = new Set(['connections', 'gateway'])

export function settingsTabReplacement(tab: string | null): 'billing' | null {
  if (tab && RETIRED_TO_BILLING.has(tab)) {
    return 'billing'
  }

  return null
}

/** Tools, keys, and plugins left Settings. Bookmarks open Capabilities. */
export function capabilitiesSettingsRedirect(tab: string | null, search = ''): string | null {
  if (tab === 'keys') {
    return SKILLS_ROUTE
  }

  if (tab === 'plugins') {
    const plugin = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('plugin')

    return plugin ? `${SKILLS_ROUTE}?tab=plugins&plugin=${encodeURIComponent(plugin)}` : `${SKILLS_ROUTE}?tab=plugins`
  }

  return null
}
