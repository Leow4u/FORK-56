import type { Translations } from '@/i18n/types'
import { isPortalSessionReauthReason, isProviderSetupErrorMessage } from '@/lib/provider-setup-errors'

type ErrorCopy = Translations['assistant']['thread']['errorCard']
type ErrorDescription = Exclude<keyof ErrorCopy, 'title' | 'details'>

const BILLING_ERROR =
  /\b(?:insufficient_quota|insufficient credits|insufficient funds|credit balance is too low|out of credits)\b/i

// These signatures select presentation copy only. They must never change
// billing state, retries, provider selection, or the persisted error payload.
const ERROR_DESCRIPTIONS: readonly [RegExp, ErrorDescription][] = [
  [/\bcontext_length_exceeded\b|\bmaximum context length\b|\bprompt is too long\b/i, 'context'],
  [BILLING_ERROR, 'billing'],
  [/\b(?:authentication_error|invalid_api_key|invalid api key)\b/i, 'authentication'],
  [/\b(?:rate_limit_exceeded|rate limit exceeded|too many requests)\b/i, 'rateLimit'],
  [/\b(?:timed out|timeout|ETIMEDOUT)\b/i, 'timeout'],
  [/\b(?:connection error|connection refused|failed to fetch|network error|ECONNRESET|ECONNREFUSED)\b/i, 'connection']
]

export function chatErrorDescription(error: string, copy: ErrorCopy): string {
  if (isProviderSetupErrorMessage(error)) {
    return copy.setup
  }

  if (isPortalSessionReauthReason(error)) {
    return copy.authentication
  }

  // Read explicit HTTP/SDK status markers, not arbitrary numbers in paths,
  // model names, or error bodies. Prefer the outer status over nested causes.
  const status = Number(error.match(/\b(?:HTTP(?:\/\d(?:\.\d)?)?|Error code:)\s+(\d{3})\b/i)?.[1])

  if (status === 402) {
    return /\bin-flight requests\b/i.test(error) ? copy.inFlightCredits : copy.billing
  }

  if (status === 401 || status === 403) {
    return copy.authentication
  }

  if (status === 429) {
    // Some APIs also use 429 for an exhausted quota, not a transient rate limit.
    return BILLING_ERROR.test(error) ? copy.billing : copy.rateLimit
  }

  if (status === 408 || status === 504) {
    return copy.timeout
  }

  if (status >= 500 && status <= 599) {
    return copy.unavailable
  }

  const match = ERROR_DESCRIPTIONS.find(([pattern]) => pattern.test(error))

  return match ? copy[match[1]] : copy.generic
}
