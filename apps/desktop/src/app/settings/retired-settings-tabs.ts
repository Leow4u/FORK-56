import { SKILLS_ROUTE } from '../routes'

/** Tabs whose pages left the Settings menu. */
const BILLING_TABS = new Set<string>(['connections', 'gateway'])
const CHAT_TABS = new Set<string>(['sessions'])

export function settingsTabReplacement(tab: string | null): 'billing' | 'config:chat' | null {
  if (!tab) {
    return null
  }

  if (BILLING_TABS.has(tab)) {
    return 'billing'
  }

  if (CHAT_TABS.has(tab)) {
    return 'config:chat'
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
