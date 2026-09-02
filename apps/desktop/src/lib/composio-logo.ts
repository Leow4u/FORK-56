import { composioLogoImgSrc, isTrustedComposioLogoUrl } from '@work4you/shared'

/** Packaged Electron (file://) uses work4you-logo://; web/Vite keep the CDN URL. */
export function resolveComposioLogoSrc(logo?: null | string, pageProtocol?: string): string | null {
  if (typeof logo !== 'string' || !isTrustedComposioLogoUrl(logo)) {
    return null
  }

  return composioLogoImgSrc(logo, pageProtocol)
}

export function useComposioLogoSrc(
  logo?: null | string,
  pageProtocol?: string
): { failed: boolean; src: string | null } {
  return { failed: false, src: resolveComposioLogoSrc(logo, pageProtocol) }
}
