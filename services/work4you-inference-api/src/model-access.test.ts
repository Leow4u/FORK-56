/**
 * Free-plan house-model gate contracts.
 * Run: cd services/work4you-inference-api && npm test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  HOUSE_MODEL_ID,
  isAllowedOnFreePlan,
  isHouseModel,
  isLegacyHouseModel,
} from './model-access.js'

describe('isHouseModel', () => {
  it('accepts the current Operis wire id with any vendor prefix', () => {
    assert.equal(isHouseModel(HOUSE_MODEL_ID), true)
    assert.equal(isHouseModel('gpt-6-luna'), true)
    assert.equal(isHouseModel('openrouter/gpt-6-luna'), true)
    assert.equal(isHouseModel(' OpenAI/GPT-6-Luna '), true)
  })

  it('accepts the retired Operis 4.0 wire id so stale clients keep Operis', () => {
    assert.equal(isHouseModel('openai/gpt-5.6-luna'), true)
    assert.equal(isHouseModel('gpt-5.6-luna'), true)
    assert.equal(isLegacyHouseModel('openai/gpt-5.6-luna'), true)
    assert.equal(isLegacyHouseModel(HOUSE_MODEL_ID), false)
  })

  it('keeps paid siblings out of the house identity', () => {
    assert.equal(isHouseModel('openai/gpt-5.6-luna-pro'), false)
    assert.equal(isHouseModel('openai/gpt-5.6-sol'), false)
    assert.equal(isHouseModel('anthropic/claude-opus-5'), false)
    assert.equal(isHouseModel(''), false)
  })
})

describe('isAllowedOnFreePlan', () => {
  it('unlocks the current and retired Operis ids regardless of pricing', () => {
    const paid = { prompt: '0.0002', completion: '0.0012' }
    assert.equal(isAllowedOnFreePlan(HOUSE_MODEL_ID, paid), true)
    assert.equal(isAllowedOnFreePlan('openai/gpt-5.6-luna', paid), true)
  })

  it('locks everything else on Free, even $0 ids', () => {
    const zero = { prompt: '0', completion: '0' }
    assert.equal(isAllowedOnFreePlan('openrouter/free', zero), false)
    assert.equal(isAllowedOnFreePlan('openai/gpt-5.6-luna-pro', null), false)
  })
})
