const WORD = /[a-z0-9]/i

function tokensOf(label: string): string[] {
  return label
    .replace(/\s*\(.*$/, '')
    .trim()
    .split(/[\s._/+-]+/)
    .filter(part => WORD.test(part))
}

function charAt(token: string, index: number): string {
  return (token.match(/[a-z0-9]/gi) ?? [])[index]?.toUpperCase() ?? ''
}

function baseMark(label: string): string {
  const parts = tokensOf(label)
  const head = charAt(parts[0] ?? '', 0)

  if (!head) {
    return '?'
  }

  const digit = label.replace(/\s*\(.*$/, '').match(/\d/)?.[0]

  if (digit) {
    return `${head}${digit}`
  }

  if (parts.length >= 2) {
    return `${head}${charAt(parts[1] ?? '', 0)}`
  }

  return `${head}${charAt(parts[0] ?? '', 1) || head}`
}

function alternateMark(label: string): string {
  const parts = tokensOf(label)
  const head = charAt(parts[0] ?? '', 0) || '?'
  const tail = charAt(parts[parts.length - 1] ?? '', 0)

  return `${head}${tail || head}`
}

/** Two-letter mark for a model row. Drawn from the label, and unique within the list. */
export function modelMarks(labels: readonly string[]): string[] {
  const used = new Set<string>()

  return labels.map(label => {
    const base = baseMark(label)

    if (!used.has(base)) {
      used.add(base)

      return base
    }

    const alternate = alternateMark(label)

    if (!used.has(alternate)) {
      used.add(alternate)

      return alternate
    }

    const letters = (label.match(/[a-z0-9]/gi) ?? []).map(ch => ch.toUpperCase())
    const head = base[0] ?? '?'

    for (const ch of letters) {
      const next = `${head}${ch}`

      if (!used.has(next)) {
        used.add(next)

        return next
      }
    }

    used.add(base)

    return base
  })
}
