import { describe, expect, it } from 'vitest'

import { reasoningHeadline, separateGluedReasoningBlocks } from '@/lib/reasoning-blocks'

describe('separateGluedReasoningBlocks', () => {
  it('splits heading-onto-heading parts (the `****` run)', () => {
    const glued =
      '**Investigating likely culprit PRs****Inspecting message schema****Analyzing interrupted tool call impact**'

    expect(separateGluedReasoningBlocks(glued)).toBe(
      [
        '**Investigating likely culprit PRs**',
        '',
        '**Inspecting message schema**',
        '',
        '**Analyzing interrupted tool call impact**'
      ].join('\n')
    )
  })

  it('splits prose-onto-heading parts (vercel/ai#6742 repro)', () => {
    const glued =
      '**Simulating a greeting stream**\n\nIt feels like a streaming interaction!**Simulating a greeting stream**\n\nI want to meet the request.'

    expect(separateGluedReasoningBlocks(glued)).toContain('interaction!\n\n**Simulating')
    expect(separateGluedReasoningBlocks(glued)).not.toContain('interaction!**')
  })

  it('is idempotent on already-separated text', () => {
    const separated = '**One**\n\n**Two**'

    expect(separateGluedReasoningBlocks(separated)).toBe(separated)
  })

  it('leaves emphasis inside prose alone', () => {
    const prose = 'Looking at the logs, the **signature** field is missing — so the replay 400s.'

    expect(separateGluedReasoningBlocks(prose)).toBe(prose)
  })

  it('leaves an unclosed emphasis run alone', () => {
    expect(separateGluedReasoningBlocks('weighing options **')).toBe('weighing options **')
  })

  it('does not split a heading that already opens the text', () => {
    expect(separateGluedReasoningBlocks('**Only one part**')).toBe('**Only one part**')
  })
})

describe('reasoningHeadline', () => {
  it('names the newest summary part', () => {
    expect(reasoningHeadline('**Checking the layout**\n\nFolders first.\n\n**Counting files**\n\nBy extension.')).toBe(
      'Counting files'
    )
  })

  it('finds headings the wire glued together', () => {
    expect(reasoningHeadline('**Investigating likely culprit PRs****Inspecting message schema**')).toBe(
      'Inspecting message schema'
    )
  })

  it('has no name for reasoning without a heading line', () => {
    expect(reasoningHeadline('I should read the brief, then the brand kit.')).toBe('')
    expect(reasoningHeadline('Looking at the **signature** field, the replay fails.')).toBe('')
    expect(reasoningHeadline('')).toBe('')
  })
})
