import type { MessagingHomeChannelWrite } from '@/types/work4you'

export function buildHomeChannelPayload(chatId: string, displayName?: string): MessagingHomeChannelWrite {
  const id = chatId.trim()

  return {
    chat_id: id,
    name: (displayName || id).trim()
  }
}

export function defaultHomeFromChoices(candidates: string[]): string {
  const unique = Array.from(new Set(candidates.map(value => value.trim()).filter(Boolean)))

  return unique[0] ?? ''
}
