/** First sentence of a persona, collapsed to one line. Empty when there is nothing to show. */
export function personaLead(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim()

  if (!flat) {
    return ''
  }

  const sentence = flat.match(/^.*?[.!?](?=\s|$)/)

  return (sentence?.[0] ?? flat).trim()
}
