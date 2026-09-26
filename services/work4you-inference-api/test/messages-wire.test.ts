import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { costUsdFromUsage } from '../src/billing.ts'
import {
  billedTokenCount,
  consumeSseDataLines,
  mergeUsage,
  normalizeUsageForBilling,
  prepareMessagesUpstreamBody,
} from '../src/messages-wire.ts'
import { estimateRequestTokens } from '../src/rate-limit.ts'
import { metersFromOpenRouterUsage } from '../src/usage-meters.ts'

describe('prepareMessagesUpstreamBody', () => {
  it('keeps the Anthropic body and drops portal-only tags', () => {
    const body = {
      model: 'anthropic/claude-opus-5',
      max_tokens: 128000,
      stream: true,
      system: [{ type: 'text', text: 'You are Work4You.', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: [{ type: 'text', text: 'olá?' }] }],
      tools: [{ name: 'read_file', input_schema: { type: 'object' } }],
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'medium' },
      session_id: 'sess-abc',
      tags: ['product=work4you'],
    }

    const upstream = prepareMessagesUpstreamBody(body) as Record<string, unknown>

    assert.equal(upstream.model, 'anthropic/claude-opus-5')
    assert.equal(upstream.stream, true)
    assert.deepEqual(upstream.system, body.system)
    assert.deepEqual(upstream.messages, body.messages)
    assert.deepEqual(upstream.tools, body.tools)
    assert.deepEqual(upstream.thinking, body.thinking)
    assert.deepEqual(upstream.output_config, body.output_config)
    assert.equal(upstream.session_id, 'sess-abc')
    assert.equal('tags' in upstream, false)
    assert.deepEqual(body.tags, ['product=work4you'])
  })
})

describe('Anthropic SSE usage', () => {
  it('merges message_start input with message_delta output', () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"usage":{"input_tokens":25,"output_tokens":1,"cache_read_input_tokens":4,"cache_creation_input_tokens":8}}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Oi"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}',
    ].join('\n')

    const parsed = consumeSseDataLines(sse, null, true)
    const usage = normalizeUsageForBilling(parsed.usage)

    assert.equal(usage?.prompt_tokens, 25)
    assert.equal(usage?.completion_tokens, 15)
    assert.equal(usage?.cache_read_tokens, 4)
    assert.equal(usage?.cache_write_tokens, 8)
    assert.equal(billedTokenCount(parsed.usage), 40)

    const meters = metersFromOpenRouterUsage(usage)
    assert.equal(meters.inputTokens, 25)
    assert.equal(meters.outputTokens, 15)
    assert.equal(meters.cacheReadTokens, 4)
    assert.equal(meters.cacheWriteTokens, 8)

    const cost = costUsdFromUsage(usage, { prompt: '0.000003', completion: '0.000015' })
    assert.ok(Math.abs(cost - (25 * 0.000003 + 15 * 0.000015)) < 1e-12)
  })

  it('keeps a trailing usage line that has no closing newline', () => {
    const partial = 'data: {"usage":{"output_tokens":9}}'
    const held = consumeSseDataLines(partial, { input_tokens: 3 }, false)
    assert.equal(held.usage?.input_tokens, 3)
    assert.equal(held.buffer, partial)

    const flushed = consumeSseDataLines(held.buffer, held.usage, true)
    assert.deepEqual(normalizeUsageForBilling(flushed.usage), {
      input_tokens: 3,
      output_tokens: 9,
      prompt_tokens: 3,
      completion_tokens: 9,
    })
  })

  it('still reads an OpenAI chat usage chunk', () => {
    const chunk =
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n' +
      'data: {"usage":{"prompt_tokens":10,"completion_tokens":2,"cost":0.01}}\n\n' +
      'data: [DONE]\n'

    const parsed = consumeSseDataLines(chunk, null, true)
    assert.equal(parsed.usage?.cost, 0.01)
    assert.equal(billedTokenCount(parsed.usage), 12)
    assert.equal(costUsdFromUsage(parsed.usage, { prompt: '1', completion: '1' }), 0.01)
  })

  it('does not let a later partial object erase earlier input tokens', () => {
    const merged = mergeUsage(
      { input_tokens: 100, output_tokens: 1 },
      { output_tokens: 40 },
    )
    assert.equal(merged?.input_tokens, 100)
    assert.equal(merged?.output_tokens, 40)
  })
})

describe('estimateRequestTokens', () => {
  it('counts Anthropic system blocks toward the prompt', () => {
    const withSystem = estimateRequestTokens({
      max_tokens: 100,
      system: [{ type: 'text', text: 'x'.repeat(400) }],
      messages: [{ role: 'user', content: 'olá?' }],
    })
    const withoutSystem = estimateRequestTokens({
      max_tokens: 100,
      messages: [{ role: 'user', content: 'olá?' }],
    })
    assert.ok(withSystem > withoutSystem)
  })
})
