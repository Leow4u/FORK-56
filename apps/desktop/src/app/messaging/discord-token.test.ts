import { describe, expect, it } from 'vitest'

import {
  decodeDiscordApplicationId,
  DISCORD_BOT_TOKEN_RE,
  discordBotSettingsUrl,
  discordInviteUrl,
  normalizeDiscordBotToken
} from './discord-token'

const APP_ID = '1086042810000000000'
// Real tokens base64url-encode the application id in their first segment.
const tokenFor = (id: string) => `${btoa(id).replace(/=+$/, '')}.GXk2ap.tW0abcDEFghiJKLmnoPQRstuVWxyz1234567890`

describe('normalizeDiscordBotToken', () => {
  it('strips whitespace and the "Bot " Authorization-header prefix', () => {
    expect(normalizeDiscordBotToken(`  Bot ${tokenFor(APP_ID)} `)).toBe(tokenFor(APP_ID))
    expect(normalizeDiscordBotToken('bot abc.def.ghi')).toBe('abc.def.ghi')
  })
})

describe('DISCORD_BOT_TOKEN_RE', () => {
  it('accepts the three dot-separated base64url segments the portal issues', () => {
    expect(DISCORD_BOT_TOKEN_RE.test(tokenFor(APP_ID))).toBe(true)
  })

  it('rejects truncated pastes and tokens from other platforms', () => {
    expect(DISCORD_BOT_TOKEN_RE.test(tokenFor(APP_ID).split('.')[0])).toBe(false)
    // A Telegram-shaped token must not pass as a Discord one.
    expect(DISCORD_BOT_TOKEN_RE.test('123456789:AAF0abcDEF-ghiJKLmnoPQRstuVWxyz123')).toBe(false)
  })
})

describe('decodeDiscordApplicationId', () => {
  it('decodes the numeric application id from the first token segment', () => {
    expect(decodeDiscordApplicationId(tokenFor(APP_ID))).toBe(APP_ID)
    expect(decodeDiscordApplicationId(`Bot ${tokenFor(APP_ID)}`)).toBe(APP_ID)
  })

  it('returns null when the first segment does not hold a snowflake', () => {
    // Decodes fine, but to text — not a numeric id.
    expect(decodeDiscordApplicationId(`${btoa('not-a-snowflake')}.GXk2ap.rest`)).toBeNull()
    expect(decodeDiscordApplicationId('')).toBeNull()
    // Invalid base64 in the first segment must not throw.
    expect(decodeDiscordApplicationId('!!!.def.ghi')).toBeNull()
  })
})

describe('deep links', () => {
  it('builds the OAuth invite URL with bot + slash-command scopes', () => {
    const url = discordInviteUrl(APP_ID)

    expect(url).toContain(`client_id=${APP_ID}`)
    expect(url).toContain('scope=bot+applications.commands')
    expect(url).toContain('permissions=')
  })

  it('deep-links the Bot page where the privileged intents live', () => {
    expect(discordBotSettingsUrl(APP_ID)).toBe(`https://discord.com/developers/applications/${APP_ID}/bot`)
  })
})
