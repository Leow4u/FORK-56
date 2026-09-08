export type OnboardingPreviewMode = 'confirm' | 'login' | 'picker' | 'reauth'

// Dev affordance, sibling of `?connecting=1`: force the first-run overlay so
// the picker / sign-in / confirm / Portal-reauth screens can be reviewed
// without an empty WORK4YOU_HOME. Stripped from the production bundle.
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
