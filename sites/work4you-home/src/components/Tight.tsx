import { splitPunct } from '../lib/typography'

/**
 * Em peso 800 com tracking negativo, o ponto e a vírgula da Plus Jakarta Sans ficam soltos da palavra
 * (o recuo lateral do glifo não acompanha o tracking). Recolhe só esses sinais.
 */
export function Tight({ text }: { text: string }) {
  return splitPunct(text).map((part, index) =>
    part.punct ? (
      <span className="punct" key={index}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  )
}
