/** Ícones de traço desenhados em Icon.tsx. */
export type IconName =
  | 'bot'
  | 'branch'
  | 'chart'
  | 'chat'
  | 'check'
  | 'clock'
  | 'compare'
  | 'doc'
  | 'doubleCheck'
  | 'download'
  | 'go'
  | 'laptop'
  | 'memory'
  | 'message'
  | 'reconcile'
  | 'replay'
  | 'team'
  | 'terminal'
  | 'truck'
  | 'web'
  | 'windows'

/** Logos de apps já publicados em public/brand/apps. */
export const APP_LOGOS = {
  discord: 'discord',
  gcal: 'googlecalendar',
  gdrive: 'googledrive',
  gmail: 'gmail',
  hubspot: 'hubspot',
  instagram: 'instagram',
  notion: 'notion',
  sheets: 'googlesheets',
  slack: 'slack',
  telegram: 'telegram',
  whatsapp: 'whatsapp',
} as const

export type AppName = keyof typeof APP_LOGOS

export type GlyphName = AppName | IconName

export function isAppGlyph(name: GlyphName): name is AppName {
  return Object.hasOwn(APP_LOGOS, name)
}
