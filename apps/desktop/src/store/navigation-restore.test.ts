import { beforeEach, describe, expect, it } from 'vitest'

import { _resetLegacyDiscardForTests, setRememberedRoute, setRememberedSessionId } from '@/store/session'

import {
  $navigationRestorePending,
  _resetNavigationRestoreForTests,
  navigationRestoreExpected,
  rememberBootProfile,
  rememberedBootProfile,
  settleNavigationRestore
} from './navigation-restore'

describe('navigationRestoreExpected', () => {
  it('expects a restore when a remembered session route is waiting', () => {
    expect(navigationRestoreExpected({ pathname: '/', rememberedRoute: '/session-1', rememberedSessionId: null })).toBe(
      true
    )
  })

  it('expects a restore when a remembered page route is waiting', () => {
    expect(navigationRestoreExpected({ pathname: '/', rememberedRoute: '/skills', rememberedSessionId: null })).toBe(
      true
    )
  })

  it('expects a restore from the remembered session id alone', () => {
    expect(navigationRestoreExpected({ pathname: '/', rememberedRoute: null, rememberedSessionId: 'session-1' })).toBe(
      true
    )
  })

  it('expects nothing with no remembered navigation', () => {
    expect(navigationRestoreExpected({ pathname: '/', rememberedRoute: null, rememberedSessionId: null })).toBe(false)
    expect(navigationRestoreExpected({ pathname: '/', rememberedRoute: '/', rememberedSessionId: '  ' })).toBe(false)
  })

  it('ignores an overlay route the restore itself skips', () => {
    expect(navigationRestoreExpected({ pathname: '/', rememberedRoute: '/settings', rememberedSessionId: null })).toBe(
      false
    )
  })

  it('expects nothing when the window already opened on a destination', () => {
    expect(
      navigationRestoreExpected({ pathname: '/session-9', rememberedRoute: '/session-1', rememberedSessionId: 's' })
    ).toBe(false)
    expect(
      navigationRestoreExpected({
        pathname: '/skills?tab=mcp',
        rememberedRoute: '/session-1',
        rememberedSessionId: 's'
      })
    ).toBe(false)
  })
})

describe('boot profile memory', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('reads as the default profile until a boot remembers one', () => {
    expect(rememberedBootProfile()).toBe('default')
    rememberBootProfile('coder')
    expect(rememberedBootProfile()).toBe('coder')
    rememberBootProfile('')
    expect(rememberedBootProfile()).toBe('default')
  })
})

describe('$navigationRestorePending', () => {
  beforeEach(() => {
    window.localStorage.clear()
    _resetLegacyDiscardForTests()
    window.location.hash = ''
  })

  it('is seeded from the remembered profile navigation at load', () => {
    _resetNavigationRestoreForTests()
    expect($navigationRestorePending.get()).toBe(false)

    rememberBootProfile('coder')
    setRememberedSessionId('session-1', 'coder')
    _resetNavigationRestoreForTests()
    expect($navigationRestorePending.get()).toBe(true)

    // Another profile's memory does not hold this profile's first frame.
    setRememberedSessionId(null, 'coder')
    setRememberedRoute('/session-2', 'default')
    _resetNavigationRestoreForTests()
    expect($navigationRestorePending.get()).toBe(false)
  })

  it('settles once and stays settled', () => {
    _resetNavigationRestoreForTests(true)
    settleNavigationRestore()
    expect($navigationRestorePending.get()).toBe(false)
    settleNavigationRestore()
    expect($navigationRestorePending.get()).toBe(false)
  })
})
