import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { en } from '@/i18n/en'

import { useComposerPlaceholder } from './use-composer-placeholder'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider configClient={{ getConfig: async () => ({}), saveConfig: async () => ({ ok: true }) }}>
      {children}
    </I18nProvider>
  )
}

function placeholder(options: { disabled: boolean; reconnecting: boolean; sessionId: null | string }) {
  return renderHook(() => useComposerPlaceholder(options), { wrapper }).result.current
}

describe('useComposerPlaceholder', () => {
  it('shows the resting starter from the first frame of a cold start', () => {
    // The box is disabled until the gateway opens; the text does not announce it.
    const text = placeholder({ disabled: true, reconnecting: false, sessionId: null })

    expect(en.composer.newSessionPlaceholders).toContain(text)
  })

  it('says the connection is being restored after a drop', () => {
    expect(placeholder({ disabled: true, reconnecting: true, sessionId: null })).toBe(
      en.composer.placeholderReconnecting
    )
  })

  it('picks a starter for a new chat and a continuation for an existing one', () => {
    expect(en.composer.newSessionPlaceholders).toContain(
      placeholder({ disabled: false, reconnecting: false, sessionId: null })
    )
    expect(en.composer.followUpPlaceholders).toContain(
      placeholder({ disabled: false, reconnecting: false, sessionId: 'session-1' })
    )
  })
})
