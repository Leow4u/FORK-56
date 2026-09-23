import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REASONING_EFFORT,
  isReasoningEffort,
  isThinkingEnabled,
  menuReasoningEffort,
  REASONING_EFFORT_VALUES,
  REASONING_EFFORTS,
  reasoningEffortLabel,
  resolveReasoningEffort,
  visibleReasoningEfforts
} from './reasoning-effort'

describe('reasoning-effort', () => {
  it('keeps the scale ascending and `none` off it', () => {
    expect(REASONING_EFFORTS).not.toContain('none')
    expect(REASONING_EFFORT_VALUES[0]).toBe('none')
    expect(REASONING_EFFORT_VALUES).toHaveLength(REASONING_EFFORTS.length + 1)
  })

  it('labels every level it claims to support', () => {
    for (const effort of REASONING_EFFORT_VALUES) {
      expect(reasoningEffortLabel(effort)).not.toBe('')
    }

    expect(reasoningEffortLabel('')).toBe('')
    // Unknown values pass through rather than silently reading as a real level.
    expect(reasoningEffortLabel('bogus')).toBe('bogus')
  })

  it('recognizes only real scale levels', () => {
    expect(isReasoningEffort(DEFAULT_REASONING_EFFORT)).toBe(true)
    expect(isReasoningEffort('HIGH')).toBe(true)
    expect(isReasoningEffort('none')).toBe(false)
    expect(isReasoningEffort('bogus')).toBe(false)
  })

  it('treats empty as inherit and only `none` as off', () => {
    expect(isThinkingEnabled('none')).toBe(false)
    expect(isThinkingEnabled('high')).toBe(true)
    // Empty inherits the fallback, so an off fallback reads as off.
    expect(isThinkingEnabled('', 'none')).toBe(false)
    expect(isThinkingEnabled('', 'high')).toBe(true)
  })

  it('resolves a scale value: inherit, off, or clamp', () => {
    expect(resolveReasoningEffort('high')).toBe('high')
    // Empty inherits the profile default rather than snapping to medium.
    expect(resolveReasoningEffort('', 'ultra')).toBe('ultra')
    // Off selects nothing on the scale.
    expect(resolveReasoningEffort('none')).toBe('')
    expect(resolveReasoningEffort('bogus')).toBe(DEFAULT_REASONING_EFFORT)
  })

  it('offers four levels, and Max only on Claude', () => {
    expect(visibleReasoningEfforts('x-ai/grok-4.7')).toEqual(['low', 'medium', 'high', 'xhigh'])
    expect(visibleReasoningEfforts('anthropic/claude-sonnet-5')).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    expect(visibleReasoningEfforts('claude-opus-5')).toContain('max')
    expect(visibleReasoningEfforts('openai/gpt-5.5')).not.toContain('max')
    expect(visibleReasoningEfforts('anthropic/claude-sonnet-5')).not.toContain('minimal')
    expect(visibleReasoningEfforts('anthropic/claude-sonnet-5')).not.toContain('ultra')
  })

  it('maps stored aliases onto the visible choice without dropping Claude Max', () => {
    expect(menuReasoningEffort('minimal', 'x-ai/grok-4.7')).toBe('low')
    expect(menuReasoningEffort('ultra', 'x-ai/grok-4.7')).toBe('xhigh')
    expect(menuReasoningEffort('max', 'x-ai/grok-4.7')).toBe('xhigh')
    expect(menuReasoningEffort('ultra', 'anthropic/claude-sonnet-5')).toBe('max')
    expect(menuReasoningEffort('max', 'anthropic/claude-opus-5')).toBe('max')
    expect(menuReasoningEffort('xhigh', 'anthropic/claude-fable-5')).toBe('xhigh')
    expect(menuReasoningEffort('none', 'anthropic/claude-sonnet-5')).toBe('none')
  })
})
