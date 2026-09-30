export interface TextPart {
  punct: boolean
  text: string
}

/** Separa vírgulas e pontos colados numa palavra, para puxá-los de volta nos títulos de tracking apertado. */
export function splitPunct(text: string): TextPart[] {
  return text
    .split(/(?<=\p{L})([.,])/u)
    .filter((part) => part !== '')
    .map((part) => ({ punct: part === '.' || part === ',', text: part }))
}
