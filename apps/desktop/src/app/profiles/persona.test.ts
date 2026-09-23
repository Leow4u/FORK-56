import { describe, expect, it } from 'vitest'

import { personaLead } from './persona'

describe('personaLead', () => {
  it('returns the first sentence and collapses whitespace', () => {
    expect(personaLead('  You are Work4You.\nYou help with tasks.')).toBe('You are Work4You.')
  })

  it('keeps a fragment that has no sentence end', () => {
    expect(personaLead('helpful and direct')).toBe('helpful and direct')
  })

  it('is empty for blank persona text', () => {
    expect(personaLead(' \n\t ')).toBe('')
  })
})
