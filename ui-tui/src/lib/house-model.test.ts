import { describe, expect, it } from 'vitest'

import {
  houseModelDisplayName,
  isWork4YouHouseModel,
  WORK4YOU_HOUSE_MODEL_DISPLAY,
  WORK4YOU_HOUSE_MODEL_ID
} from './house-model.js'

describe('house-model display', () => {
  it('maps the Free-plan wire id and trailing slug to Operis', () => {
    expect(WORK4YOU_HOUSE_MODEL_ID).toBe('openai/gpt-5.6-luna')
    expect(WORK4YOU_HOUSE_MODEL_DISPLAY).toBe('Operis 4.0')
    expect(isWork4YouHouseModel(WORK4YOU_HOUSE_MODEL_ID)).toBe(true)
    expect(isWork4YouHouseModel('gpt-5.6-luna')).toBe(true)
    expect(isWork4YouHouseModel('gemini-3.8-flash')).toBe(true)
    expect(isWork4YouHouseModel('openrouter/gemini-3.8-flash')).toBe(true)
    expect(isWork4YouHouseModel('deepseek-v4-flash-0731')).toBe(true)
    expect(isWork4YouHouseModel('openrouter/deepseek-v4-flash-0731')).toBe(true)
    expect(houseModelDisplayName(WORK4YOU_HOUSE_MODEL_ID)).toBe(WORK4YOU_HOUSE_MODEL_DISPLAY)
    expect(houseModelDisplayName('gemini-3.8-flash')).toBe(WORK4YOU_HOUSE_MODEL_DISPLAY)
    expect(houseModelDisplayName('deepseek-v4-flash-0731')).toBe(WORK4YOU_HOUSE_MODEL_DISPLAY)
    expect(houseModelDisplayName(WORK4YOU_HOUSE_MODEL_ID).toLowerCase()).not.toContain('flash')
    expect(houseModelDisplayName(WORK4YOU_HOUSE_MODEL_ID).toLowerCase()).not.toContain('luna')
  })

  it('does not treat paid Luna, DeepSeek, or Gemini siblings as Operis', () => {
    expect(isWork4YouHouseModel('openai/gpt-5.6-luna-pro')).toBe(false)
    expect(isWork4YouHouseModel('gpt-5.6-luna-pro')).toBe(false)
    expect(isWork4YouHouseModel('deepseek/deepseek-v4-flash')).toBe(false)
    expect(isWork4YouHouseModel('google/gemini-3.7-flash')).toBe(false)
    expect(houseModelDisplayName('deepseek/deepseek-v4-flash')).toBe('deepseek-v4-flash')
    expect(houseModelDisplayName('anthropic/claude-opus-4.8')).toBe('Claude Opus 4.8')
    expect(houseModelDisplayName('openai/gpt-5.6-luna-pro')).toBe('GPT-5.6 Luna Pro')
    expect(houseModelDisplayName('google/gemini-3.7-flash')).toBe('Gemini 3.7 Flash')
    expect(houseModelDisplayName('tencent/hy3')).toBe('Hunyuan 3')
  })
})
