/** Copy and layout for the Privy email OTP step (not the desktop device token). */

export const EMAIL_OTP_LENGTH = 6

export function isLoginEmailCodePreview(
  layoutPreview: boolean,
  step: string | null | undefined,
): boolean {
  return layoutPreview && (step ?? '').trim().toLowerCase() === 'code'
}

export function isDevicePairingNext(next: string | null | undefined): boolean {
  const path = (next ?? '').trim()
  return path.startsWith('/device') && !path.startsWith('//')
}

export function shouldShowLoginAlternatives(awaitingCode: boolean): boolean {
  return !awaitingCode
}

export function normalizeEmailOtp(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH)
}

export function emailOtpDigits(code: string): string[] {
  const normalized = normalizeEmailOtp(code)
  return Array.from({ length: EMAIL_OTP_LENGTH }, (_, index) => normalized[index] ?? '')
}

export function isCompleteEmailOtp(code: string): boolean {
  return normalizeEmailOtp(code).length === EMAIL_OTP_LENGTH
}

export function applyEmailOtpInput(current: string, index: number, incoming: string): string {
  const pasted = normalizeEmailOtp(incoming)
  if (pasted.length > 1) {
    return pasted
  }
  const digits = emailOtpDigits(current)
  const slot = Math.min(Math.max(index, 0), EMAIL_OTP_LENGTH - 1)
  digits[slot] = pasted
  return normalizeEmailOtp(digits.join(''))
}

export function applyEmailOtpBackspace(
  current: string,
  index: number,
): { code: string; focus: number } {
  const digits = emailOtpDigits(current)
  const slot = Math.min(Math.max(index, 0), EMAIL_OTP_LENGTH - 1)
  if (digits[slot]) {
    digits[slot] = ''
    return { code: normalizeEmailOtp(digits.join('')), focus: slot }
  }
  const focus = Math.max(0, slot - 1)
  digits[focus] = ''
  return { code: normalizeEmailOtp(digits.join('')), focus }
}

export interface LoginEmailCodeCopy {
  title: string
  leadBefore: string
  leadAfter: string
  email: string
  label: string
  resendLead: string
  resend: string
  useOtherEmail: string
  deviceHint: string
}

export function loginEmailCodeCopy(
  email: string,
  devicePairing = false,
): LoginEmailCodeCopy {
  return {
    title: 'Introduza o código de confirmação',
    leadBefore: 'Veja a caixa de',
    leadAfter: 'e introduza o código abaixo.',
    email: email.trim(),
    label: 'Código de confirmação',
    resendLead: 'Não recebeu o e-mail?',
    resend: 'Reenviar código',
    useOtherEmail: 'Usar outro e-mail',
    deviceHint: devicePairing
      ? 'Não use o código do aplicativo Desktop. Esse só se confirma depois, para autorizar o dispositivo.'
      : '',
  }
}

export function loginDevicePairingNotice(devicePairing: boolean): string {
  if (!devicePairing) {
    return ''
  }
  return 'Para ligar o Desktop, entre na sua conta. O código do aplicativo confirma-se depois — não o escreva aqui.'
}

/**
 * Privy renders and sends the OTP email. The React app cannot change that HTML.
 * Dashboard → Configuration → UI components → Branding is the non-Enterprise lever:
 * Name appears as “Logging in to {name}”; Logo (public PNG URL) appears in the email.
 * Privy recommends 180×90, 2:1, PNG (not SVG). Apply via:
 *   python3 cloud/nas-sync/scripts/apply-privy-email-branding.py
 */
export const PRIVY_EMAIL_BRANDING = {
  dashboardAppName: 'Work4You',
  emailLogoUrl: 'https://portal.work4you.ai/brand/work4you-email-logo.png',
  emailLogoWidth: 180,
  emailLogoHeight: 90,
} as const
