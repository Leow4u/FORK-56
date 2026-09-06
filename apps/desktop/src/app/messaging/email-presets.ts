// Pure data + helpers for the Email quick setup card. The real friction in
// email setup is not the concept — it is knowing your provider's IMAP/SMTP
// hosts and that 2FA accounts need an app password. Presets carry both, and
// the typed address's domain picks the right preset automatically.

export interface EmailProviderPreset {
  /** Domains whose addresses auto-select this preset. */
  domains: string[]
  id: string
  imapHost: string
  label: string
  /** Where the user creates an app password, when the provider has a page. */
  appPasswordUrl?: string
  smtpHost: string
}

// All presets use the standard ports (IMAP 993 SSL, SMTP 587 STARTTLS), which
// are also the adapter's defaults — so presets never need to write port vars.
export const EMAIL_PROVIDER_PRESETS: EmailProviderPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail / Workspace',
    domains: ['gmail.com', 'googlemail.com'],
    imapHost: 'imap.gmail.com',
    smtpHost: 'smtp.gmail.com',
    appPasswordUrl: 'https://myaccount.google.com/apppasswords'
  },
  {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
    imapHost: 'outlook.office365.com',
    smtpHost: 'smtp.office365.com',
    appPasswordUrl: 'https://account.microsoft.com/security'
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    domains: ['yahoo.com', 'ymail.com'],
    imapHost: 'imap.mail.yahoo.com',
    smtpHost: 'smtp.mail.yahoo.com',
    appPasswordUrl: 'https://login.yahoo.com/account/security'
  },
  {
    id: 'icloud',
    label: 'iCloud',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    imapHost: 'imap.mail.me.com',
    smtpHost: 'smtp.mail.me.com',
    appPasswordUrl: 'https://account.apple.com'
  },
  {
    id: 'fastmail',
    label: 'Fastmail',
    domains: ['fastmail.com', 'fastmail.fm'],
    imapHost: 'imap.fastmail.com',
    smtpHost: 'smtp.fastmail.com',
    appPasswordUrl: 'https://app.fastmail.com/settings/security'
  }
]

/** The preset whose domain list matches the address, or null (unknown domain,
 *  custom mail server, or not-yet-valid input). */
export function detectEmailPreset(address: string): EmailProviderPreset | null {
  const domain = address.trim().toLowerCase().split('@')[1] ?? ''

  if (!domain) {
    return null
  }

  return EMAIL_PROVIDER_PRESETS.find(preset => preset.domains.includes(domain)) ?? null
}
