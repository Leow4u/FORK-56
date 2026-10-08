import { describe, expect, it } from 'vitest'

import { TRANSLATIONS } from '@/i18n/catalog'

import { chatErrorDescription } from './chat-error-presentation'

const copy = TRANSLATIONS.pt.assistant.thread.errorCard

describe('chat error presentation', () => {
  it.each([
    [
      'HTTP 402: This request would exceed your available credits given your current in-flight requests.',
      'inFlightCredits'
    ],
    ['HTTP 402: Payment required', 'billing'],
    ["Error code: 402 - {'error': 'payment required'}", 'billing'],
    ['HTTP 401: Invalid credentials', 'authentication'],
    ['HTTP 403: Forbidden', 'authentication'],
    ['HTTP 429: Too many requests', 'rateLimit'],
    ['HTTP 429: insufficient_quota', 'billing'],
    ['HTTP 408: Request timeout', 'timeout'],
    ['HTTP 504: Gateway timeout', 'timeout'],
    ['HTTP 503: Service unavailable', 'unavailable'],
    ['HTTP 500: Internal server error', 'unavailable'],
    ['HTTP 400: context_length_exceeded', 'context'],
    ['Your credit balance is too low to access the API.', 'billing'],
    ['Connection error.', 'connection'],
    ['Request timed out.', 'timeout'],
    ['No inference provider configured', 'setup'],
    ['Session expired and no refresh token is available', 'authentication']
  ] as const)('localizes %s without exposing provider copy', (raw, key) => {
    expect(chatErrorDescription(raw, copy)).toBe(copy[key])
  })

  it.each(['', 'Unexpected provider response', 'Falha inesperada', 'Could not open /tmp/402.txt', 'Model 503 failed'])(
    'uses honest generic copy for unknown errors: %s',
    raw => {
      expect(chatErrorDescription(raw, copy)).toBe(copy.generic)
    }
  )

  it('does not let a nested error override the outer HTTP status', () => {
    expect(chatErrorDescription('HTTP 503: Upstream HTTP 401: authentication_error', copy)).toBe(copy.unavailable)
  })

  it('selects copy from every supported locale, without an English fallback', () => {
    const english = TRANSLATIONS.en.assistant.thread.errorCard

    for (const [locale, translations] of Object.entries(TRANSLATIONS)) {
      const localized = translations.assistant.thread.errorCard
      expect(chatErrorDescription('HTTP 402: in-flight requests', localized)).toBe(localized.inFlightCredits)
      expect(chatErrorDescription('unknown', localized)).toBe(localized.generic)

      for (const key of Object.keys(english) as (keyof typeof english)[]) {
        expect(localized[key].trim()).not.toBe('')

        if (locale !== 'en') {
          expect(localized[key]).not.toBe(english[key])
        }
      }
    }
  })
})
