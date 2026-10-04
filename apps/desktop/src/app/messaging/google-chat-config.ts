// Pure helpers around the Google Chat channel's two inbound modes: which one
// a saved setup uses, and the project id inside a Pub/Sub subscription path
// (so a mismatch with the separately entered project id shows before the
// gateway subscribes against the wrong project).

import type { MessagingEnvVarInfo } from '@/types/work4you'

export type GoogleChatMode = 'http' | 'pubsub'

/** The project id embedded in a full Pub/Sub subscription path, or null. */
export function subscriptionProject(subscription: string): null | string {
  const match = /^projects\/([^/\s]+)\/subscriptions\/[^/\s]+$/.exec(subscription.trim())

  return match ? match[1] : null
}

const savedValue = (envVars: MessagingEnvVarInfo[], key: string) =>
  envVars.find(field => field.key === key)?.value?.trim() || ''

/** The mode a saved setup uses: HTTP when an events URL is saved and no
 *  subscription is, Pub/Sub otherwise (the recommended default). */
export function googleChatMode(envVars: MessagingEnvVarInfo[]): GoogleChatMode {
  return savedValue(envVars, 'GOOGLE_CHAT_HTTP_EVENTS_URL') && !savedValue(envVars, 'GOOGLE_CHAT_SUBSCRIPTION_NAME')
    ? 'http'
    : 'pubsub'
}
