import { describe, expect, it } from 'vitest'

import { currentPickerSelection, displayModelName, formatModelStatusLabel } from './model-status-label'
import { reasoningEffortLabel } from './reasoning-effort'

describe('model-status-label', () => {
  it('formats display names consistently', () => {
    expect(displayModelName('openai/gpt-5.6-luna')).toBe('Operis 4.0')
    expect(displayModelName('gpt-5.6-luna')).toBe('Operis 4.0')
    expect(displayModelName('google/gemini-3.8-flash')).toBe('Operis 4.0')
    expect(displayModelName('gemini-3.8-flash')).toBe('Operis 4.0')
    expect(displayModelName('deepseek/deepseek-v4-flash-0731')).toBe('Operis 4.0')
    expect(displayModelName('deepseek-v4-flash-0731')).toBe('Operis 4.0')
    expect(displayModelName('openai/gpt-5.6-luna-pro')).toBe('GPT-5.6 Luna Pro')
    expect(displayModelName('anthropic/claude-opus-4.8-fast')).toBe('Claude Opus 4.8')
    expect(displayModelName('anthropic/claude-opus-5')).toBe('Claude Opus 5')
    expect(displayModelName('openai/gpt-5.5-fast')).toBe('GPT-5.5')
    expect(displayModelName('deepseek/deepseek-v4-pro-thinking')).toBe('Deepseek V4 Pro')
    expect(displayModelName('openai/gpt-5.5')).toBe('GPT-5.5')
    expect(displayModelName('google/gemini-3.1-pro-preview')).toBe('Gemini 3.1 Pro')
    expect(displayModelName('tencent/hy3')).toBe('Hunyuan 3')
    expect(displayModelName('z-ai/glm-5.2')).toBe('GLM 5.2')
  })

  it('strips trailing date-pin snapshots from the display name', () => {
    expect(displayModelName('claude-opus-4-5-20251101')).toBe('Opus 4 5')
    expect(displayModelName('anthropic/claude-haiku-4-5-20251001')).toBe('Haiku 4 5')
  })

  it('maps reasoning effort to compact labels', () => {
    expect(reasoningEffortLabel('high')).toBe('High')
    expect(reasoningEffortLabel('xhigh')).toBe('XHigh')
    expect(reasoningEffortLabel('max')).toBe('Max')
    expect(reasoningEffortLabel('ultra')).toBe('Ultra')
    expect(reasoningEffortLabel('')).toBe('')
  })

  it('appends fast + effort session state to the status label', () => {
    expect(formatModelStatusLabel('openai/gpt-5.5', { fastMode: true, reasoningEffort: 'high' })).toBe(
      'GPT-5.5 · Fast High'
    )
  })

  it('falls back to the profile default effort, then to medium', () => {
    expect(formatModelStatusLabel('openai/gpt-5.5', { reasoningEffort: 'medium' })).toBe('GPT-5.5 · Med')
    expect(formatModelStatusLabel('openai/gpt-5.5')).toBe('GPT-5.5 · Med')
    // No session-level effort → the configured profile default is advertised,
    // not Work4You' built-in medium.
    expect(formatModelStatusLabel('openai/gpt-5.5', { defaultEffort: 'high' })).toBe('GPT-5.5 · High')
    // An explicit session effort still wins over the profile default.
    expect(formatModelStatusLabel('openai/gpt-5.5', { defaultEffort: 'high', reasoningEffort: 'low' })).toBe(
      'GPT-5.5 · Low'
    )
  })

  it('shows Claude Max and folds other ceilings into Extra High', () => {
    expect(formatModelStatusLabel('anthropic/claude-sonnet-5', { reasoningEffort: 'max' })).toBe(
      'Claude Sonnet 5 · Max'
    )
    expect(formatModelStatusLabel('anthropic/claude-sonnet-5', { reasoningEffort: 'ultra' })).toBe(
      'Claude Sonnet 5 · Max'
    )
    expect(formatModelStatusLabel('x-ai/grok-4.7', { reasoningEffort: 'max' })).toBe('Grok 4.7 · XHigh')
  })

  it('returns just the placeholder name when there is no model', () => {
    expect(formatModelStatusLabel('')).toBe('No model')
  })

  describe('currentPickerSelection', () => {
    const store = { model: 'opus', provider: 'anthropic' }
    const options = { model: 'work4you-4', provider: 'work4you' }

    it('prefers the sticky composer pick over the profile default pre-session', () => {
      expect(currentPickerSelection(store, options)).toEqual(store)
    })

    it('keeps the SessionView selection when a stale options response disagrees', () => {
      expect(currentPickerSelection(store, options)).toEqual(store)
    })

    it('falls back to options when the store is empty', () => {
      expect(currentPickerSelection({ model: '', provider: '' }, options)).toEqual(options)
    })

    it('uses the complete options pair instead of mixing a partial store selection', () => {
      expect(currentPickerSelection({ model: 'opus', provider: '' }, options)).toEqual(options)
    })

    it('falls back to the store while options are still loading', () => {
      expect(currentPickerSelection(store, undefined)).toEqual(store)
    })
  })
})
