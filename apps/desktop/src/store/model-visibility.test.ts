import { describe, expect, it } from 'vitest'

import type { ModelOptionProvider } from '@/types/work4you'

import {
  collapseModelFamilies,
  defaultVisibleKeys,
  effectiveVisibleKeys,
  emptyProviderSentinelKey,
  isProviderSentinel,
  modelVisibilityKey,
  resolveVisibleKeys,
  setProviderVisibility,
  toggleModelVisibility
} from './model-visibility'

const provider = (slug: string, models: string[]): ModelOptionProvider => ({
  models,
  name: slug,
  slug
})

describe('model visibility', () => {
  it('keeps newly configured providers visible when stored choices are stale', () => {
    const stored = new Set([modelVisibilityKey('copilot', 'claude-sonnet-4.6')])

    const visible = effectiveVisibleKeys(stored, [
      provider('copilot', ['claude-sonnet-4.6']),
      provider('local-ollama', ['qwen3:latest', 'llama3.2:latest'])
    ])

    expect(visible.has(modelVisibilityKey('copilot', 'claude-sonnet-4.6'))).toBe(true)
    expect(visible.has(modelVisibilityKey('local-ollama', 'qwen3:latest'))).toBe(true)
    expect(visible.has(modelVisibilityKey('local-ollama', 'llama3.2:latest'))).toBe(true)
  })

  it('does not re-add models from a provider that already has stored choices', () => {
    const stored = new Set([modelVisibilityKey('local-ollama', 'qwen3:latest')])

    const visible = effectiveVisibleKeys(stored, [provider('local-ollama', ['qwen3:latest', 'llama3.2:latest'])])

    expect(visible.has(modelVisibilityKey('local-ollama', 'qwen3:latest'))).toBe(true)
    expect(visible.has(modelVisibilityKey('local-ollama', 'llama3.2:latest'))).toBe(false)
  })

  it('preserves hidden-provider sentinel without re-adding defaults', () => {
    // User explicitly hid all models for "work4you" — sentinel marks this choice.
    const stored = new Set([emptyProviderSentinelKey('work4you')])

    const visible = effectiveVisibleKeys(stored, [
      provider('work4you', ['work4you-3-llama-3.1-70b', 'work4you-3-llama-3.1-8b']),
      provider('ollama', ['qwen3:latest'])
    ])

    expect(visible.has(modelVisibilityKey('work4you', 'work4you-3-llama-3.1-70b'))).toBe(false)
    expect(visible.has(modelVisibilityKey('work4you', 'work4you-3-llama-3.1-8b'))).toBe(false)
    // Sentinel itself is stripped from the result.
    expect(visible.has(emptyProviderSentinelKey('work4you'))).toBe(false)
    // Other providers still get defaults.
    expect(visible.has(modelVisibilityKey('ollama', 'qwen3:latest'))).toBe(true)
  })

  it('restores model when toggling on after hiding all', () => {
    // Simulates: user hid all "work4you" models, then toggles one back on.
    const stored = new Set([emptyProviderSentinelKey('work4you'), modelVisibilityKey('ollama', 'qwen3:latest')])

    // After toggle: sentinel removed, one model added.
    const afterToggle = new Set(stored)
    afterToggle.delete(emptyProviderSentinelKey('work4you'))
    afterToggle.add(modelVisibilityKey('work4you', 'work4you-3-llama-3.1-70b'))

    const visible = effectiveVisibleKeys(afterToggle, [
      provider('work4you', ['work4you-3-llama-3.1-70b', 'work4you-3-llama-3.1-8b']),
      provider('ollama', ['qwen3:latest'])
    ])

    expect(visible.has(modelVisibilityKey('work4you', 'work4you-3-llama-3.1-70b'))).toBe(true)
    expect(visible.has(modelVisibilityKey('work4you', 'work4you-3-llama-3.1-8b'))).toBe(false)
  })

  it('folds a date-pinned snapshot into its rolling alias when present', () => {
    const families = collapseModelFamilies(['claude-opus-4-5', 'claude-opus-4-5-20251101'])

    expect(families.map(f => f.id)).toEqual(['claude-opus-4-5'])
  })

  it('keeps a date-pinned snapshot standing alone when it has no alias', () => {
    const families = collapseModelFamilies(['claude-opus-4-5-20251101', 'claude-haiku-4-5-20251001'])

    expect(families.map(f => f.id)).toEqual(['claude-opus-4-5-20251101', 'claude-haiku-4-5-20251001'])
  })

  it('sentinel key helper produces correct format', () => {
    expect(emptyProviderSentinelKey('openai')).toBe('openai::')
    expect(isProviderSentinel('openai::')).toBe(true)
    expect(isProviderSentinel('openai::gpt-4o')).toBe(false)
  })

  it('resolveVisibleKeys preserves sentinels that effectiveVisibleKeys strips', () => {
    const stored = new Set([emptyProviderSentinelKey('work4you')])
    const providers = [provider('work4you', ['work4you-x', 'work4you-y']), provider('ollama', ['qwen3:latest'])]

    const resolved = resolveVisibleKeys(stored, providers)
    expect(resolved.has(emptyProviderSentinelKey('work4you'))).toBe(true)
    expect(resolved.has(modelVisibilityKey('work4you', 'work4you-x'))).toBe(false)
    // Un-customized providers still expand to their defaults.
    expect(resolved.has(modelVisibilityKey('ollama', 'qwen3:latest'))).toBe(true)

    // Display variant drops the sentinel.
    expect(effectiveVisibleKeys(stored, providers).has(emptyProviderSentinelKey('work4you'))).toBe(false)
  })
})

describe('toggleModelVisibility', () => {
  const providers = [provider('openai', ['gpt-a', 'gpt-b']), provider('work4you', ['work4you-x', 'work4you-y'])]

  // Drive the handler the way the dialog does: feed each result back in as the
  // next `stored`, so the persisted set is what the next toggle starts from.
  const apply = (stored: Set<string> | null, slug: string, model: string) =>
    toggleModelVisibility(stored, providers, slug, model)

  it('records a hide-all sentinel when the last model of a provider is toggled off', () => {
    let stored: Set<string> | null = null
    stored = apply(stored, 'openai', 'gpt-a')
    stored = apply(stored, 'openai', 'gpt-b')

    expect(stored.has(emptyProviderSentinelKey('openai'))).toBe(true)
    expect(effectiveVisibleKeys(stored, providers).has(modelVisibilityKey('openai', 'gpt-a'))).toBe(false)
    expect(effectiveVisibleKeys(stored, providers).has(modelVisibilityKey('openai', 'gpt-b'))).toBe(false)
  })

  it('keeps a hidden provider hidden when a different provider is toggled (regression for #43485)', () => {
    // Hide ALL of work4you — its sentinel is now stored.
    let stored: Set<string> | null = null
    stored = apply(stored, 'work4you', 'work4you-x')
    stored = apply(stored, 'work4you', 'work4you-y')
    expect(stored.has(emptyProviderSentinelKey('work4you'))).toBe(true)

    // Toggle a model in another provider. work4you must NOT snap back on.
    stored = apply(stored, 'openai', 'gpt-a')

    expect(stored.has(emptyProviderSentinelKey('work4you'))).toBe(true)
    const visible = effectiveVisibleKeys(stored, providers)
    expect(visible.has(modelVisibilityKey('work4you', 'work4you-x'))).toBe(false)
    expect(visible.has(modelVisibilityKey('work4you', 'work4you-y'))).toBe(false)
  })

  it('clears only the toggled provider sentinel when a model is re-enabled', () => {
    let stored: Set<string> | null = new Set([emptyProviderSentinelKey('openai'), emptyProviderSentinelKey('work4you')])

    stored = apply(stored, 'openai', 'gpt-a')

    expect(stored.has(emptyProviderSentinelKey('openai'))).toBe(false)
    expect(stored.has(emptyProviderSentinelKey('work4you'))).toBe(true)
    const visible = effectiveVisibleKeys(stored, providers)
    expect(visible.has(modelVisibilityKey('openai', 'gpt-a'))).toBe(true)
    expect(visible.has(modelVisibilityKey('work4you', 'work4you-x'))).toBe(false)
  })

  it('re-enabling one model of a hidden-all provider restores ONLY that model, not the curated defaults', () => {
    // openai hidden-all, work4you untouched.
    let stored: Set<string> | null = new Set([emptyProviderSentinelKey('openai')])

    stored = apply(stored, 'openai', 'gpt-a')

    const visible = effectiveVisibleKeys(stored, providers)
    expect(visible.has(modelVisibilityKey('openai', 'gpt-a'))).toBe(true)
    // gpt-b is NOT restored — "you hid everything, you get back only what you re-enable".
    expect(visible.has(modelVisibilityKey('openai', 'gpt-b'))).toBe(false)
  })

  it('re-hiding the last re-enabled model re-adds the sentinel (full round-trip)', () => {
    let stored: Set<string> | null = new Set([emptyProviderSentinelKey('openai')])

    // Re-enable gpt-a (clears sentinel, set = {gpt-a}), then toggle it back off.
    stored = apply(stored, 'openai', 'gpt-a')
    expect(stored.has(emptyProviderSentinelKey('openai'))).toBe(false)
    stored = apply(stored, 'openai', 'gpt-a')

    expect(stored.has(emptyProviderSentinelKey('openai'))).toBe(true)
    expect(effectiveVisibleKeys(stored, providers).has(modelVisibilityKey('openai', 'gpt-a'))).toBe(false)
  })

  it('toggling from an empty (non-null) stored set adds the model without expanding defaults', () => {
    // Empty-but-not-null = "everything hidden". resolveVisibleKeys short-circuits to {}.
    const stored = new Set<string>()

    const next = apply(stored, 'openai', 'gpt-a')

    expect(next.has(modelVisibilityKey('openai', 'gpt-a'))).toBe(true)
    // No curated defaults were expanded for any provider.
    expect(next.has(modelVisibilityKey('openai', 'gpt-b'))).toBe(false)
    expect(next.has(modelVisibilityKey('work4you', 'work4you-x'))).toBe(false)
  })

  it('toggling off one default model from null stored keeps the rest of the curated defaults', () => {
    // null = "never customized": resolveVisibleKeys expands all defaults first.
    const next = apply(null, 'openai', 'gpt-a')

    expect(next.has(modelVisibilityKey('openai', 'gpt-a'))).toBe(false)
    expect(next.has(modelVisibilityKey('openai', 'gpt-b'))).toBe(true)
    expect(next.has(modelVisibilityKey('work4you', 'work4you-x'))).toBe(true)
    // Other models remain, so no sentinel.
    expect(next.has(emptyProviderSentinelKey('openai'))).toBe(false)
  })

  it('tolerates a provider with zero models (defensive — dialog filters these out)', () => {
    const ps = [provider('empty', []), provider('openai', ['gpt-a'])]
    const next = toggleModelVisibility(new Set([modelVisibilityKey('openai', 'gpt-a')]), ps, 'empty', 'ghost')

    // No crash; the phantom key is recorded but no defaults are invented.
    expect([...next].some(k => k.startsWith('empty::') && !isProviderSentinel(k))).toBe(true)
    expect(next.has(modelVisibilityKey('openai', 'gpt-a'))).toBe(true)
  })
})

describe('resolveVisibleKeys', () => {
  const providers = [provider('openai', ['gpt-a', 'gpt-b']), provider('work4you', ['work4you-x', 'work4you-y'])]

  it('returns the curated defaults verbatim for null stored', () => {
    expect(resolveVisibleKeys(null, providers)).toEqual(defaultVisibleKeys(providers))
  })

  it('returns an empty set for an empty (non-null) stored set', () => {
    expect([...resolveVisibleKeys(new Set(), providers)]).toEqual([])
  })
})

describe('featured defaults', () => {
  const featuredProvider = (slug: string, models: string[], featured_models: string[]): ModelOptionProvider => ({
    featured_models,
    models,
    name: slug,
    slug
  })

  it('defaults to the featured shortlist when a provider publishes one', () => {
    const work4you = featuredProvider(
      'work4you',
      ['anthropic/opus', 'anthropic/haiku', 'google/gemini', 'x-ai/grok'],
      ['anthropic/opus', 'google/gemini', 'x-ai/grok']
    )

    const visible = defaultVisibleKeys([work4you])

    // Featured are visible; the non-featured model is hidden by default.
    expect(visible.has(modelVisibilityKey('work4you', 'anthropic/opus'))).toBe(true)
    expect(visible.has(modelVisibilityKey('work4you', 'google/gemini'))).toBe(true)
    expect(visible.has(modelVisibilityKey('work4you', 'x-ai/grok'))).toBe(true)
    expect(visible.has(modelVisibilityKey('work4you', 'anthropic/haiku'))).toBe(false)
  })

  it('falls back to top-N when a provider ships no featured list', () => {
    const plain = provider('ollama', ['qwen3:latest', 'llama3.2:latest'])

    const visible = defaultVisibleKeys([plain])

    // No featured_models → every model stays a default (top-N, N ≫ 2 here).
    expect(visible.has(modelVisibilityKey('ollama', 'qwen3:latest'))).toBe(true)
    expect(visible.has(modelVisibilityKey('ollama', 'llama3.2:latest'))).toBe(true)
  })

  it('ignores an empty featured list and falls back to top-N', () => {
    const plain = featuredProvider('ollama', ['qwen3:latest', 'llama3.2:latest'], [])

    const visible = defaultVisibleKeys([plain])

    expect(visible.has(modelVisibilityKey('ollama', 'qwen3:latest'))).toBe(true)
    expect(visible.has(modelVisibilityKey('ollama', 'llama3.2:latest'))).toBe(true)
  })
})

describe('setProviderVisibility', () => {
  const providers = [provider('openai', ['gpt-a', 'gpt-b']), provider('work4you', ['work4you-x', 'work4you-y'])]

  it('enabling a provider makes every one of its models visible', () => {
    // Start from a hidden-all openai; flip it on.
    const stored = new Set([emptyProviderSentinelKey('openai')])

    const next = setProviderVisibility(stored, providers, 'openai', true)

    const visible = effectiveVisibleKeys(next, providers)
    expect(visible.has(modelVisibilityKey('openai', 'gpt-a'))).toBe(true)
    expect(visible.has(modelVisibilityKey('openai', 'gpt-b'))).toBe(true)
    // Sentinel is cleared.
    expect(next.has(emptyProviderSentinelKey('openai'))).toBe(false)
  })

  it('disabling a provider hides all its models and records the sentinel', () => {
    const next = setProviderVisibility(null, providers, 'openai', false)

    expect(next.has(emptyProviderSentinelKey('openai'))).toBe(true)
    const visible = effectiveVisibleKeys(next, providers)
    expect(visible.has(modelVisibilityKey('openai', 'gpt-a'))).toBe(false)
    expect(visible.has(modelVisibilityKey('openai', 'gpt-b'))).toBe(false)
  })

  it('leaves other providers untouched (their sentinels survive)', () => {
    const stored = new Set([emptyProviderSentinelKey('work4you')])

    // Turn openai fully on; work4you must stay hidden.
    const next = setProviderVisibility(stored, providers, 'openai', true)

    expect(next.has(emptyProviderSentinelKey('work4you'))).toBe(true)
    const visible = effectiveVisibleKeys(next, providers)
    expect(visible.has(modelVisibilityKey('work4you', 'work4you-x'))).toBe(false)
    expect(visible.has(modelVisibilityKey('openai', 'gpt-a'))).toBe(true)
  })

  it('round-trips: enable then disable returns to a clean hidden-all', () => {
    const enabled = setProviderVisibility(null, providers, 'openai', true)
    const disabled = setProviderVisibility(enabled, providers, 'openai', false)

    expect(disabled.has(emptyProviderSentinelKey('openai'))).toBe(true)
    // No stray real keys left for the provider.
    expect([...disabled].some(k => k.startsWith('openai::') && !isProviderSentinel(k))).toBe(false)
  })

  it('collapses model families to one key per family when enabling', () => {
    // A base + its -fast sibling collapse to a single family row/key.
    const ps = [provider('work4you', ['model', 'model-fast'])]

    const next = setProviderVisibility(null, ps, 'work4you', true)

    expect(next.has(modelVisibilityKey('work4you', 'model'))).toBe(true)
    // The -fast sibling is represented by its base family, not its own key.
    expect(next.has(modelVisibilityKey('work4you', 'model-fast'))).toBe(false)
  })
})
