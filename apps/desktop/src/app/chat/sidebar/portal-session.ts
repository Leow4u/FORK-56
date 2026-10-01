import { FEATURED_ID } from '@/components/onboarding'
import { requestDesktopOnboarding } from '@/store/onboarding'
import { disconnectOAuthProvider } from '@/work4you'

/** The account menu re-reads after Settings saves the name or signs out. */
export const PORTAL_ACCOUNT_CHANGED = 'work4you-portal-account'

export function notifyPortalAccountChanged(): void {
  window.dispatchEvent(new Event(PORTAL_ACCOUNT_CHANGED))
}

/** Ends the Portal login on this app: the agent credential and the desktop cookie session. */
export async function signOutOfPortal(): Promise<void> {
  await disconnectOAuthProvider(FEATURED_ID)
  void window.work4youDesktop?.cloud?.logout?.().catch(() => undefined)
  requestDesktopOnboarding()
}
