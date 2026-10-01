import { describe, expect, it } from 'vitest'

import { modelMarks } from './model-mark'

describe('modelMarks', () => {
  it('takes one letter from each of the first two words', () => {
    expect(modelMarks(['Flux Pro'])).toEqual(['FP'])
  })

  it('uses two letters when the name is a single word', () => {
    expect(modelMarks(['Veo'])).toEqual(['VE'])
  })

  it('ignores a parenthetical subtitle', () => {
    expect(modelMarks(['Nano Banana 2 (Gemini 3.1 Flash Image)'])).toEqual(['NB'])
  })

  it('gives a shared opening a distinct second mark from the last word', () => {
    expect(modelMarks(['Nano Banana 2', 'Nano Banana Pro'])).toEqual(['NB', 'NP'])
  })

  it('falls back to a question mark when the label has no letters', () => {
    expect(modelMarks([''])).toEqual(['?'])
  })
})
