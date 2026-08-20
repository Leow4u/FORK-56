import { describe, expect, it } from 'vitest'

import {
  normalizeWork4YouOpenString,
  pathFromWork4YouDeepLink,
  pathFromOpenDeepLink,
  resolveWork4YouOpenPath
} from './work4you-open-target'

describe('normalizeWork4YouOpenString', () => {
  it('accepts hash-router paths and strips a leading hash', () => {
    expect(normalizeWork4YouOpenString('/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeWork4YouOpenString('#/index-network/intent/1')).toBe('/index-network/intent/1')
  })

  it('maps plugin-scoped work4you:// deep links to the same path', () => {
    expect(normalizeWork4YouOpenString('work4you://index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeWork4YouOpenString('work4you://index-network/intent/1?focus=true')).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('maps work4you://open/… deep links by stripping the open host', () => {
    expect(normalizeWork4YouOpenString('work4you://open/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeWork4YouOpenString('work4you://open/settings/plugins')).toBe('/settings/plugins')
  })

  it('rejects reserved work4you kinds and unsafe paths', () => {
    expect(normalizeWork4YouOpenString('work4you://blueprint/morning-brief')).toBeNull()
    expect(normalizeWork4YouOpenString('work4you://plugin/install')).toBeNull()
    expect(normalizeWork4YouOpenString('https://example.com/x')).toBeNull()
    expect(normalizeWork4YouOpenString('/../etc/passwd')).toBeNull()
    expect(normalizeWork4YouOpenString('index-network')).toBeNull()
  })
})

describe('resolveWork4YouOpenPath', () => {
  it('merges structured path + params', () => {
    expect(resolveWork4YouOpenPath({ path: '/index-network/intent/1', params: { focus: 'true' } })).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('resolves href the same as a bare string', () => {
    expect(resolveWork4YouOpenPath({ href: 'work4you://index-network/intent/1' })).toBe('/index-network/intent/1')
  })
})

describe('pathFromWork4YouDeepLink', () => {
  it('builds the navigate path from a plugin-scoped deep-link payload', () => {
    expect(pathFromWork4YouDeepLink('index-network', 'intent/1')).toBe('/index-network/intent/1')
  })

  it('builds the navigate path from work4you://open/… payloads', () => {
    expect(pathFromOpenDeepLink('index-network/intent/1')).toBe('/index-network/intent/1')
    expect(pathFromWork4YouDeepLink('open', 'agent/42')).toBe('/agent/42')
  })

  it('ignores reserved kinds', () => {
    expect(pathFromWork4YouDeepLink('blueprint', 'morning-brief')).toBeNull()
    expect(pathFromWork4YouDeepLink('plugin', 'install')).toBeNull()
  })
})
