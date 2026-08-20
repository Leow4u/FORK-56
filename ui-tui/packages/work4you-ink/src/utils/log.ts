export function logError(error: unknown): void {
  if (!process.env.WORK4YOU_INK_DEBUG_ERRORS) {
    return
  }

  console.error(error)
}
