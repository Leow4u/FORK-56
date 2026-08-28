import { afterEach, describe, expect, it } from 'vitest'

import { onboardingPreviewMode } from './preview'

describe('onboardingPreviewMode', () => {
  const originalLocation = window.location

  const setSearch = (search: string) => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search }
    })
  }

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('maps 1 and picker to the picker preview', () => {
    setSearch('?onboarding=1')
    expect(onboardingPreviewMode()).toBe('picker')

    setSearch('?onboarding=picker')
    expect(onboardingPreviewMode()).toBe('picker')
  })

  it('maps login and confirm previews', () => {
    setSearch('?onboarding=login')
    expect(onboardingPreviewMode()).toBe('login')

    setSearch('?onboarding=confirm')
    expect(onboardingPreviewMode()).toBe('confirm')
  })

  it('ignores unknown values', () => {
    setSearch('?onboarding=nope')
    expect(onboardingPreviewMode()).toBeNull()

    setSearch('')
    expect(onboardingPreviewMode()).toBeNull()
  })
})
