/** Fly dashboard base URL → default chat entry (same as CloudPage). */
export function cloudAgentChatUrl(dashboardUrl: string | null | undefined): string | null {
  if (!dashboardUrl || typeof dashboardUrl !== 'string') return null
  const trimmed = dashboardUrl.trim()
  if (!trimmed) return null
  return `${trimmed.replace(/\/$/, '')}/chat`
}
