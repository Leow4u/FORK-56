const PROVIDER_SETUP_ERROR_RE =
  /No (?:inference|Work4You) provider(?: is)? configured|no_provider_configured|set an API key/i

const SESSION_INFO_CREDENTIAL_WARNING_RE = /^No API key configured for provider '[^']*'\. First message will fail\.$/

// Portal-token resolution failures from work4you_cli/auth.py. These are the
// returning-user "session expired" door — not generic checksDisagree (e.g. an
// empty OpenRouter key). The concatenated setup.status suffix is not enough
// on its own.
const PORTAL_SESSION_REAUTH_RE =
  /No access token found for Work4You Portal login|Work4You is not logged into Work4You Portal|Work4You Portal access token is not a usable inference JWT|Session expired and no refresh token is available/i

export function isProviderSetupErrorMessage(message: null | string | undefined): boolean {
  const text = message?.trim()

  if (!text) {
    return false
  }

  return PROVIDER_SETUP_ERROR_RE.test(text) || SESSION_INFO_CREDENTIAL_WARNING_RE.test(text)
}

export function isPortalSessionReauthReason(message: null | string | undefined): boolean {
  const text = message?.trim()

  if (!text) {
    return false
  }

  return PORTAL_SESSION_REAUTH_RE.test(text)
}
