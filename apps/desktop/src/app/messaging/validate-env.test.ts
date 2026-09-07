import { describe, expect, it } from 'vitest'

import { isUsableApiServerKey, validateMessagingEnv } from './validate-env'

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

  it('requires the AC-prefixed 32-hex shape for Twilio Account SIDs', () => {
    // Built at runtime so the literal never matches credential-shaped push
    // protection patterns.
    const sid = 'AC' + 'a'.repeat(32)

    expect(validateMessagingEnv('TWILIO_ACCOUNT_SID', sid)).toBeNull()
    expect(validateMessagingEnv('TWILIO_ACCOUNT_SID', 'SK' + 'a'.repeat(32))).toEqual({ code: 'twilioAccountSid' })
    expect(validateMessagingEnv('TWILIO_ACCOUNT_SID', 'AC123')).toEqual({ code: 'twilioAccountSid' })
  })

  it('requires strict E.164 for the Twilio from-number', () => {
    expect(validateMessagingEnv('TWILIO_PHONE_NUMBER', '+15551234567')).toBeNull()
    expect(validateMessagingEnv('TWILIO_PHONE_NUMBER', '15551234567')).toEqual({
      code: 'smsNumber',
      value: '15551234567'
    })
    expect(validateMessagingEnv('TWILIO_PHONE_NUMBER', '+1 555 123 4567')).toEqual({
      code: 'smsNumber',
      value: '+1 555 123 4567'
    })
  })

  it('validates the SMS allowlist as E.164, honoring the * wildcard', () => {
    expect(validateMessagingEnv('SMS_ALLOWED_USERS', '+15551234567, *,')).toBeNull()
    expect(validateMessagingEnv('SMS_ALLOWED_USERS', '+15551234567, 5559876543')).toEqual({
      code: 'smsNumber',
      value: '5559876543'
    })
  })

  it('requires a scheme on the SMS webhook URL', () => {
    expect(validateMessagingEnv('SMS_WEBHOOK_URL', 'https://example.com/webhooks/twilio')).toBeNull()
    expect(validateMessagingEnv('SMS_WEBHOOK_URL', 'http://example.com/webhooks/twilio')).toBeNull()
    expect(validateMessagingEnv('SMS_WEBHOOK_URL', 'example.com/webhooks/twilio')).toEqual({
      code: 'smsWebhookUrl',
      value: 'example.com/webhooks/twilio'
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

  it('requires the full Pub/Sub subscription path for Google Chat', () => {
    expect(
      validateMessagingEnv('GOOGLE_CHAT_SUBSCRIPTION_NAME', 'projects/my-project/subscriptions/work4you-chat')
    ).toBeNull()
    expect(validateMessagingEnv('GOOGLE_CHAT_SUBSCRIPTION_NAME', 'work4you-chat')).toEqual({
      code: 'googleChatSubscription',
      value: 'work4you-chat'
    })
    expect(validateMessagingEnv('GOOGLE_CHAT_SUBSCRIPTION_NAME', 'projects/my-project/topics/work4you-chat')).toEqual({
      code: 'googleChatSubscription',
      value: 'projects/my-project/topics/work4you-chat'
    })
  })

  it('validates the Google Cloud project id shape', () => {
    expect(validateMessagingEnv('GOOGLE_CHAT_PROJECT_ID', 'my-project-id')).toBeNull()
    expect(validateMessagingEnv('GOOGLE_CHAT_PROJECT_ID', 'My Project!')).toEqual({
      code: 'googleChatProjectId',
      value: 'My Project!'
    })
    // Too short — GCP project ids are at least 6 characters.
    expect(validateMessagingEnv('GOOGLE_CHAT_PROJECT_ID', 'abc')).toEqual({
      code: 'googleChatProjectId',
      value: 'abc'
    })
  })

  it('validates Google Chat allowlist emails, the events URL, and the SA email', () => {
    expect(validateMessagingEnv('GOOGLE_CHAT_ALLOWED_USERS', 'you@yourcompany.com, *')).toBeNull()
    expect(validateMessagingEnv('GOOGLE_CHAT_ALLOWED_USERS', 'you@yourcompany.com, carla')).toEqual({
      code: 'emailAddress',
      value: 'carla'
    })
    expect(validateMessagingEnv('GOOGLE_CHAT_HTTP_EVENTS_URL', 'https://example.com/chat/events')).toBeNull()
    expect(validateMessagingEnv('GOOGLE_CHAT_HTTP_EVENTS_URL', 'example.com/chat/events')).toEqual({
      code: 'googleChatEventsUrl',
      value: 'example.com/chat/events'
    })
    expect(
      validateMessagingEnv(
        'GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL',
        'work4you-chat@my-project.iam.gserviceaccount.com'
      )
    ).toBeNull()
    expect(validateMessagingEnv('GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL', 'not-an-email')).toEqual({
      code: 'emailAddress',
      value: 'not-an-email'
    })
  })

  it('mirrors the API server startup guard on the key (16+ chars, no placeholders)', () => {
    expect(validateMessagingEnv('API_SERVER_KEY', 'a'.repeat(16))).toBeNull()
    expect(validateMessagingEnv('API_SERVER_KEY', 'short-key')).toEqual({ code: 'apiServerKey' })
    // Placeholder values the adapter rejects even when long enough is not a
    // case here — placeholders in the list are all short — but the canonical
    // ones must be caught regardless of casing.
    expect(validateMessagingEnv('API_SERVER_KEY', 'CHANGEME')).toEqual({ code: 'apiServerKey' })
    expect(validateMessagingEnv('API_SERVER_KEY', 'your_api_key_here')).toEqual({ code: 'apiServerKey' })
  })

  it('validates the API server port range and bind address shape', () => {
    expect(validateMessagingEnv('API_SERVER_PORT', '8642')).toBeNull()
    expect(validateMessagingEnv('API_SERVER_PORT', 'abc')).toEqual({ code: 'emailPort', value: 'abc' })
    expect(validateMessagingEnv('API_SERVER_PORT', '70000')).toEqual({ code: 'emailPort', value: '70000' })
    expect(validateMessagingEnv('API_SERVER_HOST', '127.0.0.1')).toBeNull()
    expect(validateMessagingEnv('API_SERVER_HOST', '0.0.0.0')).toBeNull()
    expect(validateMessagingEnv('API_SERVER_HOST', 'my-server.local')).toBeNull()
    expect(validateMessagingEnv('API_SERVER_HOST', 'http://127.0.0.1')).toEqual({
      code: 'apiServerHost',
      value: 'http://127.0.0.1'
    })
    expect(validateMessagingEnv('API_SERVER_HOST', '127.0.0.1/v1')).toEqual({
      code: 'apiServerHost',
      value: '127.0.0.1/v1'
    })
  })

  it('requires full origins in the API server CORS list', () => {
    expect(validateMessagingEnv('API_SERVER_CORS_ORIGINS', 'https://chat.example.com, *')).toBeNull()
    expect(validateMessagingEnv('API_SERVER_CORS_ORIGINS', 'chat.example.com')).toEqual({
      code: 'apiServerCorsOrigin',
      value: 'chat.example.com'
    })
  })

  it('validates the webhook listener port range', () => {
    expect(validateMessagingEnv('WEBHOOK_PORT', '8644')).toBeNull()
    expect(validateMessagingEnv('WEBHOOK_PORT', 'abc')).toEqual({ code: 'emailPort', value: 'abc' })
    expect(validateMessagingEnv('WEBHOOK_PORT', '0')).toEqual({ code: 'emailPort', value: '0' })
    expect(validateMessagingEnv('WEBHOOK_PORT', '70000')).toEqual({ code: 'emailPort', value: '70000' })
  })

  it('validates A2A port, host, token, peer tokens, and public URL', () => {
    expect(validateMessagingEnv('A2A_PORT', '9900')).toBeNull()
    expect(validateMessagingEnv('A2A_PORT', 'abc')).toEqual({ code: 'emailPort', value: 'abc' })
    expect(validateMessagingEnv('A2A_PORT', '70000')).toEqual({ code: 'emailPort', value: '70000' })
    expect(validateMessagingEnv('A2A_HOST', '127.0.0.1')).toBeNull()
    expect(validateMessagingEnv('A2A_HOST', '0.0.0.0')).toBeNull()
    expect(validateMessagingEnv('A2A_HOST', 'http://127.0.0.1')).toEqual({
      code: 'apiServerHost',
      value: 'http://127.0.0.1'
    })
    expect(validateMessagingEnv('A2A_BEARER_TOKEN', 'a'.repeat(16))).toBeNull()
    expect(validateMessagingEnv('A2A_BEARER_TOKEN', 'short')).toEqual({ code: 'apiServerKey' })
    expect(validateMessagingEnv('A2A_BEARER_TOKEN', 'changeme')).toEqual({ code: 'apiServerKey' })
    expect(validateMessagingEnv('A2A_PEER_TOKENS', 'alice:tok1,bob:tok2')).toBeNull()
    expect(validateMessagingEnv('A2A_PEER_TOKENS', 'alice')).toEqual({ code: 'a2aPeerTokens', value: 'alice' })
    expect(validateMessagingEnv('A2A_PEER_TOKENS', 'alice:')).toEqual({ code: 'a2aPeerTokens', value: 'alice:' })
    expect(validateMessagingEnv('A2A_PUBLIC_URL', 'https://tunnel.example')).toBeNull()
    expect(validateMessagingEnv('A2A_PUBLIC_URL', 'tunnel.example')).toEqual({
      code: 'a2aPublicUrl',
      value: 'tunnel.example'
    })
  })

  it('rejects weak global webhook secrets and the INSECURE_NO_AUTH sentinel', () => {
    expect(validateMessagingEnv('WEBHOOK_SECRET', 'a'.repeat(16))).toBeNull()
    // Optional field: empty passes (routes can carry their own secrets).
    expect(validateMessagingEnv('WEBHOOK_SECRET', '')).toBeNull()
    expect(validateMessagingEnv('WEBHOOK_SECRET', 'short')).toEqual({ code: 'webhookSecret' })
    // The skip-HMAC sentinel is for curl testing — as the global secret it
    // silently disables signature validation, in any casing.
    expect(validateMessagingEnv('WEBHOOK_SECRET', 'INSECURE_NO_AUTH')).toEqual({ code: 'webhookSecret' })
    expect(validateMessagingEnv('WEBHOOK_SECRET', 'insecure_no_auth')).toEqual({ code: 'webhookSecret' })
    expect(validateMessagingEnv('WEBHOOK_SECRET', 'your_api_key_here')).toEqual({ code: 'webhookSecret' })
  })

  it('validates Graph webhook bind, secret, https URL, and CIDRs', () => {
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_PORT', '8646')).toBeNull()
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_PORT', 'abc')).toEqual({ code: 'emailPort', value: 'abc' })
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_HOST', '127.0.0.1')).toBeNull()
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_HOST', 'http://127.0.0.1')).toEqual({
      code: 'apiServerHost',
      value: 'http://127.0.0.1'
    })
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_CLIENT_STATE', 'a'.repeat(16))).toBeNull()
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_CLIENT_STATE', 'short')).toEqual({ code: 'msgraphClientState' })
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_CLIENT_STATE', 'changeme')).toEqual({ code: 'msgraphClientState' })
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_PUBLIC_URL', 'https://tunnel.example')).toBeNull()
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_PUBLIC_URL', 'http://tunnel.example')).toEqual({
      code: 'msgraphPublicUrl',
      value: 'http://tunnel.example'
    })
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_PUBLIC_URL', 'not-a-url')).toEqual({
      code: 'msgraphPublicUrl',
      value: 'not-a-url'
    })
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS', '52.96.0.0/14, 13.107.64.0/18')).toBeNull()
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS', '52.96.0.0')).toEqual({
      code: 'msgraphCidr',
      value: '52.96.0.0'
    })
  })

  it('generates keys that pass the startup guard', () => {
    expect(isUsableApiServerKey('a'.repeat(16))).toBe(true)
    expect(isUsableApiServerKey('changeme')).toBe(false)
    expect(isUsableApiServerKey('  short  ')).toBe(false)
  })

  it('leaves keys without a client-checkable shape alone', () => {
    expect(validateMessagingEnv('MATTERMOST_TOKEN', 'anything-goes')).toBeNull()
    expect(validateMessagingEnv('TELEGRAM_PROXY', 'socks5://127.0.0.1:1080')).toBeNull()
  })
})
