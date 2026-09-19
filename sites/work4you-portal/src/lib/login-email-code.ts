/** Copy and layout for the Privy email OTP step (not the desktop device token). */

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

export interface LoginEmailCodeCopy {
  eyebrow: string
  title: string
  leadBefore: string
  email: string
  label: string
  placeholder: string
  submit: string
  resend: string
  useOtherEmail: string
  deviceHint: string
}

export function loginEmailCodeCopy(
  email: string,
  devicePairing = false,
): LoginEmailCodeCopy {
  return {
    eyebrow: 'Verificar e-mail',
    title: 'Verifique o seu e-mail',
    leadBefore: 'Enviámos um código de verificação para',
    email: email.trim(),
    label: 'Código do e-mail',
    placeholder: '123456',
    submit: 'Continuar',
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
