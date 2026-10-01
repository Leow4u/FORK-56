import { describe, expect, it } from 'vitest'

import { resolveChatModelMark } from './chat-model-mark'

describe('resolveChatModelMark', () => {
  it('uses the product mark, and Operis stays Work4You', () => {
    expect(resolveChatModelMark('openai/gpt-6-luna', 'Operis 5.0')).toBe('work4you')
    expect(resolveChatModelMark('operis-5', 'Operis 5')).toBe('work4you')
    expect(resolveChatModelMark('claude-opus-4.8', 'Claude Opus 4.8')).toBe('claude')
    expect(resolveChatModelMark('gpt-5.6-sol', 'GPT-5.6 Sol')).toBe('openai')
    expect(resolveChatModelMark('gemini-3.7-flash', 'Gemini 3.7 Flash')).toBe('gemini')
    expect(resolveChatModelMark('grok-4.6', 'Grok 4.6')).toBe('grok')
    expect(resolveChatModelMark('qwen-3.8-max', 'Qwen 3.8 Max')).toBe('qwen')
  })

  it('leaves an unknown model without a mark', () => {
    expect(resolveChatModelMark('glm-5.2', 'GLM 5.2')).toBeNull()
  })
})
