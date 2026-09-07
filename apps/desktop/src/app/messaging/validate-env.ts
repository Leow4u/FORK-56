// Client-side sanity checks for messaging credentials, mirrored from the web
// dashboard's ChannelsPage validator and the gateway's own parsers. These only
// catch shape mistakes (truncated token, a @username where a numeric id
// belongs) before a save → restart → startup_failed round trip; the backend
// remains the authority on whether a credential actually works.

import { DISCORD_BOT_TOKEN_RE, normalizeDiscordBotToken } from './discord-token'

export const TELEGRAM_USER_ID_RE = /^\d+$/
export const EMAIL_ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Twilio Account SIDs are "AC" + 32 hex chars, verbatim from the console.
export const TWILIO_ACCOUNT_SID_RE = /^AC[0-9a-fA-F]{32}$/
// Strict E.164 — Twilio numbers and the SMS allowlist require the + form.
export const E164_PHONE_RE = /^\+[1-9]\d{1,14}$/
// A bare hostname: users paste "https://imap.gmail.com" or values with spaces
// often enough that both are worth catching before a failed connect.
const EMAIL_HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/
const TELEGRAM_BOT_TOKEN_RE = /^\d+:[A-Za-z0-9_-]{30,}$/
const SLACK_MEMBER_ID_RE = /^[UW][A-Z0-9]{2,}$/
// Discord user ids are numeric snowflakes (17-20 digits today; the regex
// leaves headroom on both ends for old/future ids).
const DISCORD_USER_ID_RE = /^\d{15,22}$/
// Phone digits with an optional +; separators users paste from contact cards
// are stripped before matching. Entries containing "@" are full WhatsApp JIDs
// (user/group/LID forms) the gateway accepts verbatim, so they skip this check.
export const WHATSAPP_PHONE_RE = /^\+?\d{5,20}$/

const SLACK_TOKEN_PREFIXES: Record<string, string> = {
  SLACK_BOT_TOKEN: 'xoxb-',
  SLACK_APP_TOKEN: 'xapp-'
}

// Full Pub/Sub resource path — the adapter passes it verbatim to the
// subscriber client, so a bare subscription name fails at gateway start.
export const GOOGLE_CHAT_SUBSCRIPTION_RE = /^projects\/[^/\s]+\/subscriptions\/[^/\s]+$/
// GCP project ids: 6-30 chars, lowercase letters / digits / hyphens, starts
// with a letter, doesn't end with a hyphen (cloud.google.com naming rules).
export const GOOGLE_CLOUD_PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/

// Mirrors _PLACEHOLDER_SECRET_VALUES in work4you_cli/auth.py — the gateway's
// startup guard rejects these outright, so catch them before a save.
const API_SERVER_KEY_PLACEHOLDERS = new Set([
  '*',
  '**',
  '***',
  'changeme',
  'your_api_key',
  'your_api_key_here',
  'your-api-key',
  'placeholder',
  'example',
  'dummy',
  'null',
  'none'
])

/** Same strength bar as the adapter's startup guard (has_usable_secret with
 *  min_length=16): the API server refuses to start on anything weaker. */
export function isUsableApiServerKey(value: string): boolean {
  const cleaned = value.trim()

  return cleaned.length >= 16 && !API_SERVER_KEY_PLACEHOLDERS.has(cleaned.toLowerCase())
}

/** The webhook adapter treats "INSECURE_NO_AUTH" as a skip-HMAC sentinel meant
 *  for curl testing only — as the GLOBAL secret it silently disables signature
 *  validation on every route that falls back to it. Reject it (any casing)
 *  plus the usual placeholders and anything too short to be a real HMAC key. */
export function isUsableWebhookSecret(value: string): boolean {
  const cleaned = value.trim()

  return (
    cleaned.length >= 16 &&
    cleaned.toUpperCase() !== 'INSECURE_NO_AUTH' &&
    !API_SERVER_KEY_PLACEHOLDERS.has(cleaned.toLowerCase())
  )
}

export type MessagingEnvError =
  | { code: 'apiServerCorsOrigin'; value: string }
  | { code: 'apiServerHost'; value: string }
  | { code: 'apiServerKey' }
  | { code: 'discordToken' }
  | { code: 'discordUserId'; value: string }
  | { code: 'emailAddress'; value: string }
  | { code: 'emailHost'; value: string }
  | { code: 'emailPort'; value: string }
  | { code: 'googleChatEventsUrl'; value: string }
  | { code: 'googleChatProjectId'; value: string }
  | { code: 'googleChatSubscription'; value: string }
  | { code: 'slackMemberId'; value: string }
  | { code: 'slackTokenPrefix'; prefix: string }
  | { code: 'smsNumber'; value: string }
  | { code: 'smsWebhookUrl'; value: string }
  | { code: 'telegramToken' }
  | { code: 'telegramUserId'; value: string }
  | { code: 'twilioAccountSid' }
  | { code: 'webhookSecret' }
  | { code: 'whatsappNumber'; value: string }

/** First allowlist entry that is neither an email address nor the "*"
 *  wildcard the gateway honors — or null when the list looks fine. */
export function findInvalidEmailSender(value: string): null | string {
  return (
    value
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .find(part => part !== '*' && !EMAIL_ADDRESS_RE.test(part)) ?? null
  )
}

/** First allowlist entry that is neither a numeric snowflake nor the "*"
 *  wildcard the gateway honors — or null when the list looks fine. */
export function findInvalidDiscordUser(value: string): null | string {
  return (
    value
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .find(part => part !== '*' && !DISCORD_USER_ID_RE.test(part)) ?? null
  )
}

/** First allowlist entry that is neither a phone number, a full JID, nor the
 *  "*" wildcard the gateway honors — or null when the list looks fine. */
export function findInvalidWhatsAppUser(value: string): null | string {
  return (
    value
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .find(part => part !== '*' && !part.includes('@') && !WHATSAPP_PHONE_RE.test(part.replace(/[\s()-]/g, ''))) ??
    null
  )
}

/** Returns a structured error for a known-bad value, or null when the value
 *  is empty (clearing is always allowed) or has no client-checkable shape. */
export function validateMessagingEnv(key: string, value: string): MessagingEnvError | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (key === 'TELEGRAM_BOT_TOKEN' && !TELEGRAM_BOT_TOKEN_RE.test(trimmed)) {
    return { code: 'telegramToken' }
  }

  if (key === 'DISCORD_BOT_TOKEN' && !DISCORD_BOT_TOKEN_RE.test(normalizeDiscordBotToken(trimmed))) {
    return { code: 'discordToken' }
  }

  if (key === 'DISCORD_ALLOWED_USERS') {
    const invalid = findInvalidDiscordUser(trimmed)

    if (invalid) {
      return { code: 'discordUserId', value: invalid }
    }
  }

  if (key === 'TELEGRAM_ALLOWED_USERS') {
    const invalid = trimmed
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .find(part => !TELEGRAM_USER_ID_RE.test(part))

    if (invalid) {
      return { code: 'telegramUserId', value: invalid }
    }
  }

  const expectedPrefix = SLACK_TOKEN_PREFIXES[key]

  if (expectedPrefix && !trimmed.startsWith(expectedPrefix)) {
    return { code: 'slackTokenPrefix', prefix: expectedPrefix }
  }

  if (key === 'WHATSAPP_ALLOWED_USERS') {
    const invalid = findInvalidWhatsAppUser(trimmed)

    if (invalid) {
      return { code: 'whatsappNumber', value: invalid }
    }
  }

  if (key === 'EMAIL_ADDRESS' && !EMAIL_ADDRESS_RE.test(trimmed)) {
    return { code: 'emailAddress', value: trimmed }
  }

  if (key === 'EMAIL_ALLOWED_USERS') {
    const invalid = findInvalidEmailSender(trimmed)

    if (invalid) {
      return { code: 'emailAddress', value: invalid }
    }
  }

  if ((key === 'EMAIL_IMAP_HOST' || key === 'EMAIL_SMTP_HOST') && !EMAIL_HOST_RE.test(trimmed)) {
    return { code: 'emailHost', value: trimmed }
  }

  if (key === 'EMAIL_IMAP_PORT' || key === 'EMAIL_SMTP_PORT') {
    const port = Number(trimmed)

    if (!/^\d+$/.test(trimmed) || port < 1 || port > 65535) {
      return { code: 'emailPort', value: trimmed }
    }
  }

  if (key === 'TWILIO_ACCOUNT_SID' && !TWILIO_ACCOUNT_SID_RE.test(trimmed)) {
    return { code: 'twilioAccountSid' }
  }

  if (key === 'TWILIO_PHONE_NUMBER' && !E164_PHONE_RE.test(trimmed)) {
    return { code: 'smsNumber', value: trimmed }
  }

  if (key === 'SMS_ALLOWED_USERS') {
    const invalid = trimmed
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .find(part => part !== '*' && !E164_PHONE_RE.test(part))

    if (invalid) {
      return { code: 'smsNumber', value: invalid }
    }
  }

  if (key === 'SMS_WEBHOOK_URL' && (!/^https?:\/\/\S+$/.test(trimmed) || trimmed.includes(' '))) {
    return { code: 'smsWebhookUrl', value: trimmed }
  }

  if (key === 'GOOGLE_CHAT_SUBSCRIPTION_NAME' && !GOOGLE_CHAT_SUBSCRIPTION_RE.test(trimmed)) {
    return { code: 'googleChatSubscription', value: trimmed }
  }

  if (key === 'GOOGLE_CHAT_PROJECT_ID' && !GOOGLE_CLOUD_PROJECT_ID_RE.test(trimmed)) {
    return { code: 'googleChatProjectId', value: trimmed }
  }

  if (key === 'GOOGLE_CHAT_ALLOWED_USERS') {
    const invalid = findInvalidEmailSender(trimmed)

    if (invalid) {
      return { code: 'emailAddress', value: invalid }
    }
  }

  if (key === 'GOOGLE_CHAT_HTTP_EVENTS_URL' && (!/^https?:\/\/\S+$/.test(trimmed) || trimmed.includes(' '))) {
    return { code: 'googleChatEventsUrl', value: trimmed }
  }

  if (key === 'GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL' && !EMAIL_ADDRESS_RE.test(trimmed)) {
    return { code: 'emailAddress', value: trimmed }
  }

  if (key === 'API_SERVER_KEY' && !isUsableApiServerKey(trimmed)) {
    return { code: 'apiServerKey' }
  }

  if (key === 'API_SERVER_PORT') {
    const port = Number(trimmed)

    if (!/^\d+$/.test(trimmed) || port < 1 || port > 65535) {
      return { code: 'emailPort', value: trimmed }
    }
  }

  // Loose on purpose (hostnames, IPv4, IPv6, 0.0.0.0 are all fine) — only
  // catch pasted URLs ("http://…", trailing paths) and stray whitespace,
  // which make the bind fail at gateway start.
  if (key === 'API_SERVER_HOST' && (/\s/.test(trimmed) || trimmed.includes('://') || trimmed.includes('/'))) {
    return { code: 'apiServerHost', value: trimmed }
  }

  if (key === 'WEBHOOK_PORT') {
    const port = Number(trimmed)

    if (!/^\d+$/.test(trimmed) || port < 1 || port > 65535) {
      return { code: 'emailPort', value: trimmed }
    }
  }

  if (key === 'WEBHOOK_SECRET' && !isUsableWebhookSecret(trimmed)) {
    return { code: 'webhookSecret' }
  }

  if (key === 'API_SERVER_CORS_ORIGINS') {
    const invalid = trimmed
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .find(part => part !== '*' && !/^https?:\/\/\S+$/.test(part))

    if (invalid) {
      return { code: 'apiServerCorsOrigin', value: invalid }
    }
  }

  if (key === 'SLACK_ALLOWED_USERS') {
    // Mirror the gateway's parse (gateway/platforms/slack.py): drop empty
    // entries so a trailing/interior comma isn't rejected here. "*" is the
    // allow-all wildcard the gateway honors.
    const invalid = trimmed
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .find(part => part !== '*' && !SLACK_MEMBER_ID_RE.test(part))

    if (invalid) {
      return { code: 'slackMemberId', value: invalid }
    }
  }

  return null
}
