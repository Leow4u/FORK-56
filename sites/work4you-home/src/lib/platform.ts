export type GuestOS = 'windows' | 'mac' | 'linux'

export interface GuestSignals {
  userAgent?: string
  platform?: string
  userAgentData?: { platform?: string }
}

function readGuestSignals(): GuestSignals {
  if (typeof navigator === 'undefined') return {}
  const withHints = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    userAgentData: withHints.userAgentData,
  }
}

export function detectGuestOS(signals?: GuestSignals): GuestOS {
  const source = signals ?? readGuestSignals()
  const hint = source.userAgentData?.platform ?? ''
  const platform = source.platform ?? ''
  const ua = source.userAgent ?? ''

  if (!hint && !platform && !ua) return 'mac'

  // Macintosh before Linux: some Mac user agents mention both, and a Linux
  // match used to hide the macOS installer.
  if (/mac/i.test(hint) || /mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) {
    return 'mac'
  }
  if (/win/i.test(hint) || /^win/i.test(platform) || /windows/i.test(ua)) {
    return 'windows'
  }
  if (/android/i.test(hint) || /android/i.test(ua)) return 'mac'
  if (/linux/i.test(hint) || /linux/i.test(platform) || /linux/i.test(ua)) {
    return 'linux'
  }
  return 'mac'
}
