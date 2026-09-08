export type OnboardingPreviewMode = 'confirm' | 'login' | 'picker' | 'reauth'

// Dev affordance, sibling of `?connecting=1`: force the onboarding overlay so
// the welcome / picker / sign-in / confirm / Portal-reauth screens can be
// reviewed without an empty WORK4YOU_HOME. Stripped from the production bundle.
export function onboardingPreviewMode(): OnboardingPreviewMode | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null
  }

  try {
    const value = new URLSearchParams(window.location.search).get('onboarding')

    if (value === '1' || value === 'picker') {
      return 'picker'
    }

    if (value === 'login' || value === 'confirm' || value === 'reauth') {
      return value
    }
  } catch {
    return null
  }

  return null
}

/** Loop the cold-boot connecting overlay. Boot failure stays out of the way. */
export function connectingPreviewMode(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  try {
    return new URLSearchParams(window.location.search).get('connecting') === '1'
  } catch {
    return false
  }
}
