import { describe, expect, it } from 'vitest'

import {
  agentPluginCategory,
  type AgentPluginRow,
  isAgentPluginInstalled,
  isDesktopRelevantPlugin
} from './agent-plugins'

const row = (partial: Partial<AgentPluginRow>): AgentPluginRow => ({
  name: 'plugin',
  version: '',
  description: '',
  source: 'bundled',
  status: 'not enabled',
  ...partial
})

describe('isDesktopRelevantPlugin', () => {
  it('hides the bundled kinds and category dirs other surfaces own, and keeps the rest', () => {
    expect(isDesktopRelevantPlugin(row({ key: 'browser/browserbase', kind: 'backend' }))).toBe(false)
    expect(isDesktopRelevantPlugin(row({ key: 'platforms/telegram', kind: 'platform' }))).toBe(false)
    expect(isDesktopRelevantPlugin(row({ key: 'observability/langfuse', kind: 'standalone' }))).toBe(true)
    expect(isDesktopRelevantPlugin(row({ key: 'cron_providers/chronos', kind: 'standalone' }))).toBe(true)
    // A top-level backend plugin is a capability the user toggles on this
    // page — it must not vanish once the backend starts reporting its kind.
    expect(isDesktopRelevantPlugin(row({ key: 'spotify', kind: 'backend' }))).toBe(true)
    expect(isDesktopRelevantPlugin(row({ key: 'spotify' }))).toBe(true)
  })

  it('falls back to the surface-owned category dirs when the backend omits the kind', () => {
    expect(isDesktopRelevantPlugin(row({ key: 'browser/browserbase' }))).toBe(false)
    expect(isDesktopRelevantPlugin(row({ key: 'web/tavily' }))).toBe(false)
    expect(isDesktopRelevantPlugin(row({ key: 'observability/langfuse' }))).toBe(true)
    expect(isDesktopRelevantPlugin(row({ key: 'disk-cleanup' }))).toBe(true)
  })

  it("always lists the user's own plugins, whatever kind they declare", () => {
    expect(isDesktopRelevantPlugin(row({ key: 'image_gen/mine', kind: 'backend', source: 'user' }))).toBe(true)
    expect(isDesktopRelevantPlugin(row({ key: 'image_gen/legacy', source: 'user' }))).toBe(true)
    // Portable packages carry no kind at all.
    expect(isDesktopRelevantPlugin(row({ key: 'pack', kind: null, source: 'git' }))).toBe(true)
    // Pre-key backends: nothing to hide by.
    expect(isDesktopRelevantPlugin(row({ source: 'user' }))).toBe(true)
  })

  it('never lists the categories other surfaces own, whatever the source', () => {
    expect(isDesktopRelevantPlugin(row({ key: 'model-providers/deepinfra', source: 'user' }))).toBe(false)
    expect(isDesktopRelevantPlugin(row({ key: 'platforms/telegram', source: 'user', kind: 'standalone' }))).toBe(false)
    expect(isDesktopRelevantPlugin(row({ key: 'dashboard_auth/basic' }))).toBe(false)
  })
})

describe('isAgentPluginInstalled', () => {
  it('counts every user plugin, and a bundled one only once the user decided on it', () => {
    expect(isAgentPluginInstalled(row({ source: 'user', status: 'not enabled' }))).toBe(true)
    expect(isAgentPluginInstalled(row({ source: 'git', status: 'disabled' }))).toBe(true)
    expect(isAgentPluginInstalled(row({ status: 'enabled' }))).toBe(true)
    expect(isAgentPluginInstalled(row({ status: 'disabled' }))).toBe(true)
    expect(isAgentPluginInstalled(row({ status: 'not enabled' }))).toBe(false)
  })
})

describe('agentPluginCategory', () => {
  it('reads the registry dir off the key, general for top-level plugins', () => {
    expect(agentPluginCategory(row({ key: 'observability/langfuse' }))).toBe('observability')
    expect(agentPluginCategory(row({ key: 'disk-cleanup' }))).toBe('general')
    expect(agentPluginCategory(row({}))).toBe('general')
  })
})
