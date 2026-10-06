/** Open Fly dashboard chat; optionally kick NAS start in parallel with the HTTP wake. */
export async function primeCloudChatWake(args: {
  agentId: string
  orgId: string | undefined
  getAccessToken: () => Promise<string | null | undefined>
}): Promise<void> {
  const token = await args.getAccessToken()
  if (!token) return
  try {
    await fetch(`/api/agents/${encodeURIComponent(args.agentId)}/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ org: args.orgId }),
      keepalive: true,
    })
  } catch {
    /* Fly autostart on /chat may still succeed */
  }
}

export function openCloudChatTab(chatUrl: string): void {
  window.open(chatUrl, '_blank', 'noopener,noreferrer')
}

export async function openCloudChat(args: {
  chatUrl: string
  wakeOnOpen: boolean
  agentId?: string
  orgId?: string
  getAccessToken?: () => Promise<string | null | undefined>
}): Promise<void> {
  if (args.wakeOnOpen && args.agentId && args.getAccessToken) {
    void primeCloudChatWake({
      agentId: args.agentId,
      orgId: args.orgId,
      getAccessToken: args.getAccessToken,
    })
  }
  openCloudChatTab(args.chatUrl)
}
