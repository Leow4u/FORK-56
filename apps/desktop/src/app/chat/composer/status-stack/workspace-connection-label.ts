/** Composer-strip connection segment. Hidden unless more than one source exists. */
export function workspaceConnectionLabel(connectionCount: number, label: string | null | undefined): string | null {
  if (connectionCount <= 1) {
    return null
  }

  const text = (label ?? '').trim()

  return text || null
}
