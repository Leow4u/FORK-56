import { describe, expect, it } from 'vitest'

import { isPortalSessionReauthReason, isProviderSetupErrorMessage } from './provider-setup-errors'

describe('isProviderSetupErrorMessage', () => {
  it('matches generic missing-provider copy', () => {
    expect(isProviderSetupErrorMessage('No inference provider configured. Run `work4you model` to choose one.')).toBe(
      true
    )
    expect(isProviderSetupErrorMessage('No inference provider is configured.')).toBe(true)
    expect(isProviderSetupErrorMessage('No Work4You provider is configured.')).toBe(true)
    expect(isProviderSetupErrorMessage('set an API key (OPENROUTER_API_KEY) in ~/.work4you/.env')).toBe(true)
  })

  it('matches the exact empty-key warning emitted in session.info', () => {
    expect(
      isProviderSetupErrorMessage("No API key configured for provider 'openrouter'. First message will fail.")
    ).toBe(true)
  })

  it('does not match bare env var mentions from auxiliary warnings', () => {
    expect(isProviderSetupErrorMessage('OPENROUTER_API_KEY not set')).toBe(false)
    expect(isProviderSetupErrorMessage('Run `work4you setup` or set OPENROUTER_API_KEY.')).toBe(false)
    expect(
      isProviderSetupErrorMessage(
        '⚠ No auxiliary LLM provider configured — context compression will drop middle turns without a summary. Run `work4you setup` or set OPENROUTER_API_KEY.'
      )
    ).toBe(false)
    expect(isProviderSetupErrorMessage('OPENAI_API_KEY missing')).toBe(false)
    expect(isProviderSetupErrorMessage('ANTHROPIC_API_KEY not found')).toBe(false)
  })

  it('does not match non-provider runtime failures', () => {
    expect(
      isProviderSetupErrorMessage('Selected runtime is not available. setup.status reports configured credentials.')
    ).toBe(false)
  })

  it('returns false for empty input', () => {
    expect(isProviderSetupErrorMessage('')).toBe(false)
    expect(isProviderSetupErrorMessage(null)).toBe(false)
    expect(isProviderSetupErrorMessage(undefined)).toBe(false)
  })
})

describe('isPortalSessionReauthReason', () => {
  it('matches Portal token / login failures, including the setup.status suffix', () => {
    expect(isPortalSessionReauthReason('No access token found for Work4You Portal login.')).toBe(true)
    expect(
      isPortalSessionReauthReason(
        'No access token found for Work4You Portal login. setup.status reports configured credentials, but runtime resolution still failed.'
      )
    ).toBe(true)
    expect(isPortalSessionReauthReason('Work4You is not logged into Work4You Portal.')).toBe(true)
    expect(
      isPortalSessionReauthReason(
        'Work4You Portal access token is not a usable inference JWT (missing typical claims).'
      )
    ).toBe(true)
    expect(isPortalSessionReauthReason('Session expired and no refresh token is available.')).toBe(true)
  })

  it('does not treat generic checksDisagree or other providers as Portal reauth', () => {
    expect(
      isPortalSessionReauthReason(
        'No usable credentials found for openrouter. setup.status reports configured credentials, but runtime resolution still failed.'
      )
    ).toBe(false)
    expect(
      isPortalSessionReauthReason('setup.status reports configured credentials, but runtime resolution still failed.')
    ).toBe(false)
    expect(isPortalSessionReauthReason('No inference provider is configured.')).toBe(false)
    expect(isPortalSessionReauthReason('')).toBe(false)
    expect(isPortalSessionReauthReason(null)).toBe(false)
  })
})
