/** Canonical public URLs for work4you.ai install + desktop downloads. */
export const SITE_ORIGIN = 'https://work4you.ai'

export const INSTALL_COMMANDS = {
  unix: `curl -fsSL ${SITE_ORIGIN}/install.sh | bash`,
  windows: `irm ${SITE_ORIGIN}/install.ps1 | iex`,
} as const

export type InstallPlatform = keyof typeof INSTALL_COMMANDS

export const DESKTOP_DOWNLOADS = {
  windows: `${SITE_ORIGIN}/downloads/Work4You-Setup.exe`,
  mac: `${SITE_ORIGIN}/downloads/Work4You.dmg`,
} as const
