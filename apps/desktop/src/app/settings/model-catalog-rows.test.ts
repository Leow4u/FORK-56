import { describe, expect, it } from 'vitest'

import { modelVisibilityKey } from '@/store/model-visibility'
import type { ModelOptionProvider } from '@/types/work4you'

import { settingsCatalogRows } from './model-catalog-rows'

function provider(patch: Partial<ModelOptionProvider> = {}): ModelOptionProvider {
  return {
    authenticated: true,
    models: ['operis-5', 'claude-opus-4.8', 'gpt-5.5'],
    name: 'Work4You Portal',
    slug: 'work4you',
    ...patch
  }
}

describe('settingsCatalogRows', () => {
  it('shows the featured shortlist and keeps a model the person switched on', () => {
    const visible = new Set([modelVisibilityKey('work4you', 'operis-5'), modelVisibilityKey('work4you', 'gpt-5.5')])

    const { hasMore, rows } = settingsCatalogRows(
      [provider({ featured_models: ['operis-5', 'claude-opus-4.8'] })],
      visible,
      { query: '', showAll: false }
    )

    expect(rows.map(row => row.family.id)).toEqual(['operis-5', 'claude-opus-4.8', 'gpt-5.5'])
    expect(hasMore).toBe(false)
  })

  it('hides the rest of the catalog until view-all or a search', () => {
    const catalog = provider({
      featured_models: ['operis-5'],
      models: ['operis-5', 'claude-opus-4.8']
    })

    const visible = new Set([modelVisibilityKey('work4you', 'operis-5')])
    const closed = settingsCatalogRows([catalog], visible, { query: '', showAll: false })

    expect(closed.rows.map(row => row.family.id)).toEqual(['operis-5'])
    expect(closed.hasMore).toBe(true)

    const opened = settingsCatalogRows([catalog], visible, { query: '', showAll: true })
    expect(opened.rows.map(row => row.family.id)).toEqual(['operis-5', 'claude-opus-4.8'])

    const found = settingsCatalogRows([catalog], visible, { query: 'opus', showAll: false })
    expect(found.rows.map(row => row.family.id)).toEqual(['claude-opus-4.8'])
  })

  it('leaves mixture-of-agents presets out of the settings list', () => {
    const { rows } = settingsCatalogRows(
      [provider(), provider({ models: ['panel'], name: 'MoA', slug: 'moa' })],
      new Set(),
      { query: '', showAll: true }
    )

    expect(rows.some(row => row.provider.slug === 'moa')).toBe(false)
  })
})
