import { DESKTOP_DOWNLOADS } from './downloads.ts'
import type { GuestOS } from './platform.ts'

export interface DownloadCta {
  href: string
  label: string
  tone: 'primary' | 'ghost'
}

const MAC = {
  href: DESKTOP_DOWNLOADS.mac,
  label: 'Baixar para macOS',
} as const

const WINDOWS = {
  href: DESKTOP_DOWNLOADS.windows,
  label: 'Baixar para Windows',
} as const

const TERMINAL = {
  href: '#install',
  label: 'Instalar via terminal',
} as const

function cta(
  item: { href: string; label: string },
  tone: DownloadCta['tone'],
): DownloadCta {
  return { href: item.href, label: item.label, tone }
}

/** Hero pills. The macOS installer stays reachable on every OS. */
export function heroDownloadCtas(os: GuestOS): DownloadCta[] {
  if (os === 'windows') {
    return [cta(WINDOWS, 'primary'), cta(MAC, 'ghost'), cta(TERMINAL, 'ghost')]
  }
  if (os === 'linux') {
    return [cta(TERMINAL, 'primary'), cta(MAC, 'ghost'), cta(WINDOWS, 'ghost')]
  }
  return [cta(MAC, 'primary'), cta(WINDOWS, 'ghost'), cta(TERMINAL, 'ghost')]
}

/** Desktop installers in the closing download section. */
export function closeDownloadCtas(os: GuestOS): DownloadCta[] {
  if (os === 'windows') {
    return [cta(WINDOWS, 'primary'), cta(MAC, 'ghost')]
  }
  return [cta(MAC, 'primary'), cta(WINDOWS, 'ghost')]
}
