// Pure helpers around the Discord bot token format. A bot token is three
// dot-separated base64url segments; the FIRST segment is the bot's numeric
// application id encoded as base64. Decoding it client-side lets the setup
// flow build the OAuth invite URL and deep-link the Developer Portal without
// asking the user to hunt down the Application ID separately.

export const DISCORD_BOT_TOKEN_RE = /^[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}$/

const SNOWFLAKE_RE = /^\d{15,22}$/

// The docs' "Recommended" permission set: View Channels, Send Messages,
// Read Message History, Attach Files, Embed Links, Send Messages in
// Threads, Add Reactions (website/docs/user-guide/messaging/discord.md).
export const DISCORD_INVITE_PERMISSIONS = '274878286912'

/** Strip the "Bot " prefix some snippets prepend to Authorization headers —
 *  people paste it along with the token more often than you'd think. */
export function normalizeDiscordBotToken(value: string): string {
  return value.trim().replace(/^Bot\s+/i, '')
}

/** Decode the numeric application id from a bot token's first segment, or
 *  null when the token does not carry a decodable snowflake. */
export function decodeDiscordApplicationId(token: string): null | string {
  const first = normalizeDiscordBotToken(token).split('.')[0]

  if (!first) {
    return null
  }

  const base64 = first.replace(/-/g, '+').replace(/_/g, '/')

  try {
    const decoded = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))

    return SNOWFLAKE_RE.test(decoded) ? decoded : null
  } catch {
    return null
  }
}

export function discordInviteUrl(applicationId: string): string {
  return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot+applications.commands&permissions=${DISCORD_INVITE_PERMISSIONS}`
}

/** Privileged Gateway Intents page for the app — the #1 setup mistake is
 *  leaving Message Content / Server Members intents off on this page. */
export function discordBotSettingsUrl(applicationId: string): string {
  return `https://discord.com/developers/applications/${applicationId}/bot`
}
