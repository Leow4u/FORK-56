import type { Translations } from '@/i18n'
import type { MessagingPlatformInfo } from '@/types/work4you'

/** What is on the other end of a channel: a person writing to the bot
 *  (conversation) or a system that triggers it or calls it (integration). */
export type ChannelKind = 'conversation' | 'integration'

// The channels where no person types a message: they receive events or
// expose the bot to other programs — in the order Discover lists them, the
// common triggers first. Every other channel is a place people talk to the
// bot, which is also what an unknown plugin channel is taken for.
const INTEGRATION_CHANNELS = ['webhook', 'api_server', 'a2a', 'msgraph_webhook', 'relay']

export function channelKind(platformId: string): ChannelKind {
  return INTEGRATION_CHANNELS.includes(platformId) ? 'integration' : 'conversation'
}

/** Where an integration sits in Discover's Integrations group; unknown ones
 *  keep their backend order after the listed ones. */
export function integrationRank(platformId: string): number {
  const rank = INTEGRATION_CHANNELS.indexOf(platformId)

  return rank === -1 ? INTEGRATION_CHANNELS.length : rank
}

export function channelKindLabel(kind: ChannelKind, m: Translations['messaging']): string {
  return kind === 'integration' ? m.kindIntegration : m.kindConversation
}

// What a Discover card says the channel is for — the use, not the transport.
// The backend's description stays the fallback for channels not listed here
// (plugin channels, hidden ones a profile already enabled).
const CHANNEL_CARD_COPY: Record<string, string> = {
  a2a: 'Let other agents call the bot, and the bot call them.',
  api_server: 'Give your tools and scripts an OpenAI-compatible endpoint to the bot.',
  discord: 'Bring the bot into your Discord DMs, channels and threads.',
  email: 'Write to the bot and get its replies in your inbox.',
  google_chat: 'Chat with the bot from Google Chat spaces.',
  msgraph_webhook: 'React to Teams meetings and Microsoft 365 changes.',
  slack: 'Chat with the bot from Slack, for you or your team.',
  sms: 'Text the bot from any phone, through Twilio.',
  teams: 'Chat with the bot from Teams.',
  telegram: 'Chat with the bot from Telegram — DMs, groups and topics.',
  webhook: 'Let GitHub, GitLab and other services trigger the bot.',
  whatsapp: 'Chat with the bot on WhatsApp, from your own number or a dedicated one.',
  whatsapp_cloud: "Meta's official number for your business, to serve clients at scale."
}

export function channelCardDescription(platform: MessagingPlatformInfo, m: Translations['messaging']): string {
  return m.channelDescriptions[platform.id] || CHANNEL_CARD_COPY[platform.id] || platform.description
}
