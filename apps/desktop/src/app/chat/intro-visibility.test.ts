import { describe, expect, it } from 'vitest'

import { shouldShowIntro } from './intro-visibility'

const showing = {
  activeSessionId: null,
  auxiliaryWindow: false,
  bootInProgress: false,
  enabled: true,
  freshDraftReady: true,
  messagesEmpty: true,
  primary: true,
  restorePending: false,
  routedSessionView: false,
  selectedSessionId: null
} as const

describe('shouldShowIntro', () => {
  it('shows on a fresh draft in the primary window', () => {
    expect(shouldShowIntro(showing)).toBe(true)
  })

  it('hides when the Appearance toggle is off', () => {
    expect(shouldShowIntro({ ...showing, enabled: false })).toBe(false)
  })

  it('keeps the toggle authoritative over every other clause', () => {
    // Off means off: no window, session, draft, or boot state re-enables the splash.
    const inputs = [
      { ...showing, auxiliaryWindow: true, enabled: false },
      { ...showing, enabled: false, freshDraftReady: false },
      { ...showing, bootInProgress: true, enabled: false, freshDraftReady: false },
      { ...showing, enabled: false, primary: false },
      { ...showing, enabled: false, messagesEmpty: false }
    ]

    for (const input of inputs) {
      expect(shouldShowIntro(input)).toBe(false)
    }
  })

  it('hides on surfaces that are not an empty primary draft', () => {
    expect(shouldShowIntro({ ...showing, primary: false })).toBe(false)
    expect(shouldShowIntro({ ...showing, auxiliaryWindow: true })).toBe(false)
    expect(shouldShowIntro({ ...showing, freshDraftReady: false })).toBe(false)
    expect(shouldShowIntro({ ...showing, routedSessionView: true })).toBe(false)
    expect(shouldShowIntro({ ...showing, selectedSessionId: 'session-1' })).toBe(false)
    expect(shouldShowIntro({ ...showing, activeSessionId: 'session-1' })).toBe(false)
    expect(shouldShowIntro({ ...showing, messagesEmpty: false })).toBe(false)
  })

  it('shows during boot before the fresh draft exists, so the empty chat is born on the intro layout', () => {
    expect(shouldShowIntro({ ...showing, bootInProgress: true, freshDraftReady: false })).toBe(true)
  })

  it('keeps every other guard while booting', () => {
    const booting = { ...showing, bootInProgress: true, freshDraftReady: false }

    expect(shouldShowIntro({ ...booting, primary: false })).toBe(false)
    expect(shouldShowIntro({ ...booting, auxiliaryWindow: true })).toBe(false)
    expect(shouldShowIntro({ ...booting, routedSessionView: true })).toBe(false)
    expect(shouldShowIntro({ ...booting, selectedSessionId: 'session-1' })).toBe(false)
    expect(shouldShowIntro({ ...booting, activeSessionId: 'session-1' })).toBe(false)
    expect(shouldShowIntro({ ...booting, messagesEmpty: false })).toBe(false)
  })

  it('stays hidden while a remembered chat is about to be restored', () => {
    // Neither the boot phase nor the fresh draft the route resume starts in the
    // meantime may lift the composer: the restore is going to dock it anyway.
    expect(shouldShowIntro({ ...showing, bootInProgress: true, freshDraftReady: false, restorePending: true })).toBe(
      false
    )
    expect(shouldShowIntro({ ...showing, restorePending: true })).toBe(false)
  })
})
