/** Tabs whose pages left the Settings menu. Bookmarks land on Billing. */
const RETIRED_TO_BILLING = new Set(['connections', 'gateway'])

export function settingsTabReplacement(tab: string | null): 'billing' | null {
  if (tab && RETIRED_TO_BILLING.has(tab)) {
    return 'billing'
  }

  return null
}
