export type GuestOS = 'windows' | 'mac' | 'linux'

export function detectGuestOS(): GuestOS {
  if (typeof navigator === 'undefined') return 'mac'
  const ua = navigator.userAgent
  if (/windows/i.test(ua)) return 'windows'
  if (/linux/i.test(ua) && !/android/i.test(ua)) return 'linux'
  return 'mac'
}
