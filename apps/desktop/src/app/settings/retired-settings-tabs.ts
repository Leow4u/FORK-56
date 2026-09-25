import { SKILLS_ROUTE } from '../routes'

/** Tabs whose pages left the Settings menu. Bookmarks land on Billing. */
const RETIRED_TO_BILLING = new Set(['connections', 'gateway'])

export function settingsTabReplacement(tab: string | null): 'billing' | null {
  if (tab && RETIRED_TO_BILLING.has(tab)) {
    return 'billing'
  }

  return null
}

/** Tools & keys left Settings. Bookmarks open Capabilities, where integrations live. */
export function capabilitiesSettingsRedirect(tab: string | null): string | null {
  if (tab === 'keys') {
    return SKILLS_ROUTE
  }

  return null
}
