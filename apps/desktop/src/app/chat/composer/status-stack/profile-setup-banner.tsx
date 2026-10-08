import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'

import { useComposerScope } from '@/app/chat/composer/scope'
import { StatusRow } from '@/components/chat/status-row'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import {
  $desktopOnboarding,
  $profileCredentialWarning,
  dismissProfileCredentialWarning,
  PORTAL_PROVIDER_ID,
  type ProfileCredentialWarning,
  requestDesktopOnboarding,
  requestDesktopOnboardingWithPortalLogin
} from '@/store/onboarding'
import { $activeGatewayProfile, $activeProfile, normalizeProfileKey } from '@/store/profile-identity'
import { listOAuthProviders } from '@/work4you'

/**
 * The deferred credential warning the status stack should show for THIS
 * composer, or null. The gateway reports a provider gap with the session's
 * runtime info the moment a profile without a provider is opened; the store
 * keeps it for the live gateway profile instead of popping the blocking
 * overlay (see requestDesktopOnboardingForCredentialWarning). Main composer
 * only — the warning is profile-level, so a copy per tile would just repeat
 * it. Hidden while the onboarding overlay is up: it covers the stack anyway,
 * and the row would otherwise flash back the moment the overlay closes.
 */
export function useProfileSetupWarning(): null | ProfileCredentialWarning {
  const scope = useComposerScope()
  const warning = useStore($profileCredentialWarning)
  const activeGatewayProfile = useStore($activeGatewayProfile)
  const onboarding = useStore($desktopOnboarding)

  if (scope.target !== 'main' || !warning || warning.dismissed || onboarding.requested) {
    return null
  }

  return warning.profile === normalizeProfileKey(activeGatewayProfile) ? warning : null
}

/**
 * Calm, in-stack "this profile has no provider yet" row — the non-blocking
 * half of profile onboarding. Uses the shared {@link StatusRow} chrome.
 * One click adopts the Portal login the root already holds (offered only
 * when this profile's backend reports that login, and only on a profile other
 * than the window's primary — the primary IS that login); the other opens the
 * profile-scoped picker. Dismiss hides it until a different warning arrives;
 * the submit gate is unaffected.
 */
export function ProfileSetupBanner({ warning }: { warning: ProfileCredentialWarning }) {
  const { t } = useI18n()
  const activeProfile = useStore($activeProfile)
  const secondary = normalizeProfileKey(activeProfile) !== warning.profile

  // Routed to the live gateway profile, so `logged_in` is what THAT backend
  // sees — including the global-root auth.json fallback a named profile reads.
  const providers = useQuery({
    queryKey: ['onboarding-oauth-providers', warning.profile],
    queryFn: () => listOAuthProviders(),
    enabled: secondary,
    staleTime: 30_000
  })

  const portalSignedIn =
    secondary && Boolean(providers.data?.providers.some(p => p.id === PORTAL_PROVIDER_ID && p.status?.logged_in))

  const copy = t.onboarding.profileSetup

  return (
    <StatusRow
      leading={<Codicon aria-hidden className="text-amber-600 dark:text-amber-400" name="warning" size="0.8rem" />}
      trailing={
        <>
          {portalSignedIn ? (
            <Button
              className="text-foreground/90 hover:text-foreground"
              onClick={() => requestDesktopOnboardingWithPortalLogin(warning.warning)}
              size="micro"
              type="button"
              variant="text"
            >
              {copy.bannerUsePortal}
            </Button>
          ) : null}
          <Button
            className="text-foreground/90 hover:text-foreground"
            onClick={() => requestDesktopOnboarding(warning.warning)}
            size="micro"
            type="button"
            variant="text"
          >
            {copy.bannerChoose}
          </Button>
          <Tip label={copy.bannerDismiss}>
            <Button
              aria-label={copy.bannerDismiss}
              className="size-4 rounded-md text-muted-foreground/60 hover:text-foreground/90"
              onClick={() => dismissProfileCredentialWarning()}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <Codicon name="close" size="0.75rem" />
            </Button>
          </Tip>
        </>
      }
      trailingVisible
    >
      <span className="min-w-0 truncate text-[0.73rem] leading-4 text-foreground/92">{copy.bannerMessage}</span>
    </StatusRow>
  )
}
