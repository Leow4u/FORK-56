import { describe, expect, it } from 'vitest'

import { validateMessagingEnv } from './validate-env'

describe('validateMessagingEnv', () => {
  it('accepts empty values so clearing a field is never blocked', () => {
    expect(validateMessagingEnv('TELEGRAM_BOT_TOKEN', '')).toBeNull()
    expect(validateMessagingEnv('TELEGRAM_BOT_TOKEN', '   ')).toBeNull()
  })

  it('rejects a truncated Telegram bot token and accepts a real-shaped one', () => {
    // The classic paste mistake: only the numeric bot id half of the token.
    expect(validateMessagingEnv('TELEGRAM_BOT_TOKEN', '123456789')).toEqual({ code: 'telegramToken' })
    expect(validateMessagingEnv('TELEGRAM_BOT_TOKEN', '123456789:AAF0abcDEF-ghiJKLmnoPQRstuVWxyz123')).toBeNull()
  })

  it('flags the first non-numeric Telegram allowed-user entry by value', () => {
    expect(validateMessagingEnv('TELEGRAM_ALLOWED_USERS', '12345, @carla, 678')).toEqual({
      code: 'telegramUserId',
      value: '@carla'
    })
    expect(validateMessagingEnv('TELEGRAM_ALLOWED_USERS', '12345, 678,')).toBeNull()
  })

  it('requires the Slack token family prefixes', () => {
    expect(validateMessagingEnv('SLACK_BOT_TOKEN', 'xapp-1-A1')).toEqual({
      code: 'slackTokenPrefix',
      prefix: 'xoxb-'
    })
    expect(validateMessagingEnv('SLACK_APP_TOKEN', 'xoxb-abc')).toEqual({
      code: 'slackTokenPrefix',
      prefix: 'xapp-'
    })
    expect(validateMessagingEnv('SLACK_BOT_TOKEN', 'xoxb-abc')).toBeNull()
    expect(validateMessagingEnv('SLACK_APP_TOKEN', 'xapp-1-A1')).toBeNull()
  })

  it('validates Slack member ids but honors the * allow-all wildcard', () => {
    expect(validateMessagingEnv('SLACK_ALLOWED_USERS', 'U01ABC2DEF3, *')).toBeNull()
    expect(validateMessagingEnv('SLACK_ALLOWED_USERS', 'U01ABC2DEF3,, ')).toBeNull()
    expect(validateMessagingEnv('SLACK_ALLOWED_USERS', 'carla')).toEqual({
      code: 'slackMemberId',
      value: 'carla'
    })
  })

  it('flags the first non-phone WhatsApp allowlist entry by value', () => {
    expect(validateMessagingEnv('WHATSAPP_ALLOWED_USERS', '15551234567, carla, 15557654321')).toEqual({
      code: 'whatsappNumber',
      value: 'carla'
    })
    expect(validateMessagingEnv('WHATSAPP_ALLOWED_USERS', '15551234567,15557654321,')).toBeNull()
  })

  it('accepts +, contact-card separators, JIDs, and the * wildcard for WhatsApp', () => {
    expect(validateMessagingEnv('WHATSAPP_ALLOWED_USERS', '+1 (555) 123-4567')).toBeNull()
    // Full JIDs (group/LID/user forms) are gateway-native identifiers.
    expect(validateMessagingEnv('WHATSAPP_ALLOWED_USERS', '120363041234567890@g.us')).toBeNull()
    expect(validateMessagingEnv('WHATSAPP_ALLOWED_USERS', '*')).toBeNull()
    // Too short to be a phone number — a typo, not a country-code quirk.
    expect(validateMessagingEnv('WHATSAPP_ALLOWED_USERS', '123')).toEqual({
      code: 'whatsappNumber',
      value: '123'
    })
  })

  it('rejects a malformed Discord bot token and accepts a real-shaped one', () => {
    expect(validateMessagingEnv('DISCORD_BOT_TOKEN', 'anything-goes')).toEqual({ code: 'discordToken' })
    // Three dot-separated base64url segments, as issued by the Developer
    // Portal. Assembled at runtime so no token-shaped literal lives in the
    // source (GitHub push protection flags those).
    const token = [
      btoa('1086042810000000000').replace(/=+$/, ''),
      'GXk2ap',
      'tW0abcDEFghiJKLmnoPQRstuVWxyz1234567890'
    ].join('.')

    expect(validateMessagingEnv('DISCORD_BOT_TOKEN', token)).toBeNull()
    // "Bot <token>" pastes from Authorization-header snippets are normalized.
    expect(validateMessagingEnv('DISCORD_BOT_TOKEN', `Bot ${token}`)).toBeNull()
  })

  it('validates Discord snowflake ids but honors the * allow-all wildcard', () => {
    expect(validateMessagingEnv('DISCORD_ALLOWED_USERS', '123456789012345678, *')).toBeNull()
    expect(validateMessagingEnv('DISCORD_ALLOWED_USERS', '123456789012345678,, ')).toBeNull()
    expect(validateMessagingEnv('DISCORD_ALLOWED_USERS', '123456789012345678, @carla')).toEqual({
      code: 'discordUserId',
      value: '@carla'
    })
  })

  it('validates the email address and each allowlisted sender', () => {
    expect(validateMessagingEnv('EMAIL_ADDRESS', 'agent@example.com')).toBeNull()
    expect(validateMessagingEnv('EMAIL_ADDRESS', 'not-an-address')).toEqual({
      code: 'emailAddress',
      value: 'not-an-address'
    })
    expect(validateMessagingEnv('EMAIL_ALLOWED_USERS', 'you@example.com, *')).toBeNull()
    expect(validateMessagingEnv('EMAIL_ALLOWED_USERS', 'you@example.com, carla')).toEqual({
      code: 'emailAddress',
      value: 'carla'
    })
  })

  it('rejects mail hosts pasted with a scheme and out-of-range ports', () => {
    expect(validateMessagingEnv('EMAIL_IMAP_HOST', 'imap.gmail.com')).toBeNull()
    expect(validateMessagingEnv('EMAIL_IMAP_HOST', 'https://imap.gmail.com')).toEqual({
      code: 'emailHost',
      value: 'https://imap.gmail.com'
    })
    expect(validateMessagingEnv('EMAIL_SMTP_HOST', 'smtp host')).toEqual({
      code: 'emailHost',
      value: 'smtp host'
    })
    expect(validateMessagingEnv('EMAIL_SMTP_PORT', '587')).toBeNull()
    expect(validateMessagingEnv('EMAIL_IMAP_PORT', '993')).toBeNull()
    expect(validateMessagingEnv('EMAIL_SMTP_PORT', 'abc')).toEqual({ code: 'emailPort', value: 'abc' })
    expect(validateMessagingEnv('EMAIL_IMAP_PORT', '70000')).toEqual({ code: 'emailPort', value: '70000' })
  })

  it('leaves keys without a client-checkable shape alone', () => {
    expect(validateMessagingEnv('MATTERMOST_TOKEN', 'anything-goes')).toBeNull()
    expect(validateMessagingEnv('TELEGRAM_PROXY', 'socks5://127.0.0.1:1080')).toBeNull()
  })
})
