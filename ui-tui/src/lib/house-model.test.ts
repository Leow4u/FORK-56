import { describe, expect, it } from 'vitest'

import {
  houseModelDisplayName,
  isWork4YouHouseModel,
  WORK4YOU_HOUSE_MODEL_DISPLAY,
  WORK4YOU_HOUSE_MODEL_ID
} from './house-model.js'

describe('house-model display', () => {
  it('maps the Free-plan wire id and trailing slug to Operis', () => {
    expect(WORK4YOU_HOUSE_MODEL_ID).toBe('openai/gpt-6-luna')
    expect(WORK4YOU_HOUSE_MODEL_DISPLAY).toBe('Operis 5.0')
    expect(isWork4YouHouseModel(WORK4YOU_HOUSE_MODEL_ID)).toBe(true)
    expect(isWork4YouHouseModel('gpt-6-luna')).toBe(true)
    expect(isWork4YouHouseModel('gpt-5.6-luna')).toBe(false)
    expect(houseModelDisplayName(WORK4YOU_HOUSE_MODEL_ID)).toBe(WORK4YOU_HOUSE_MODEL_DISPLAY)
    expect(houseModelDisplayName(WORK4YOU_HOUSE_MODEL_ID).toLowerCase()).not.toContain('luna')
  })

  it('does not treat the paid Luna sibling as Operis', () => {
    expect(isWork4YouHouseModel('openai/gpt-5.6-luna-pro')).toBe(false)
    expect(isWork4YouHouseModel('gpt-5.6-luna-pro')).toBe(false)
    expect(houseModelDisplayName('anthropic/claude-opus-4.8')).toBe('Claude Opus 4.8')
    expect(houseModelDisplayName('openai/gpt-5.6-luna-pro')).toBe('GPT-5.6 Luna Pro')
    expect(houseModelDisplayName('google/gemini-3.7-flash')).toBe('Gemini 3.7 Flash')
    expect(houseModelDisplayName('tencent/hy3')).toBe('Hunyuan 3')
  })
})
