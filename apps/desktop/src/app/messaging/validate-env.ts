// Client-side sanity checks for messaging credentials, mirrored from the web
// dashboard's ChannelsPage validator and the gateway's own parsers. These only
// catch shape mistakes (truncated token, a @username where a numeric id
// belongs) before a save → restart → startup_failed round trip; the backend
// remains the authority on whether a credential actually works.

export const TELEGRAM_USER_ID_RE = /^\d+$/
const TELEGRAM_BOT_TOKEN_RE = /^\d+:[A-Za-z0-9_-]{30,}$/
const SLACK_MEMBER_ID_RE = /^[UW][A-Z0-9]{2,}$/
// Phone digits with an optional +; separators users paste from contact cards
// are stripped before matching. Entries containing "@" are full WhatsApp JIDs
// (user/group/LID forms) the gateway accepts verbatim, so they skip this check.
export const WHATSAPP_PHONE_RE = /^\+?\d{5,20}$/

const SLACK_TOKEN_PREFIXES: Record<string, string> = {
  SLACK_BOT_TOKEN: 'xoxb-',
  SLACK_APP_TOKEN: 'xapp-'
}

export type MessagingEnvError =
  | { code: 'slackMemberId'; value: string }
  | { code: 'slackTokenPrefix'; prefix: string }
  | { code: 'telegramToken' }
  | { code: 'telegramUserId'; value: string }
  | { code: 'whatsappNumber'; value: string }

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
