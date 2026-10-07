/**
 * The icon of a page open in Desktop's content area.
 *
 * The page names its icon, but the renderer doesn't paint it from the page's
 * host: packaged Desktop loads from file://, and the request would leave from
 * the app's own session rather than the area's browser. Main fetches it
 * through that browser's session instead, on the work4you-favicon scheme. Both
 * ends build and read the same address and agree on the session, so they live
 * here.
 */

/** The session the content area's browser runs in. */
export const PREVIEW_BROWSER_PARTITION = 'persist:work4you-preview'

/** Privileged Electron scheme the renderer paints a page's icon through. */
export const PREVIEW_FAVICON_PROTOCOL = 'work4you-favicon'

/** `url` when it is an icon the scheme fetches — http(s) only; else null. */
export function previewFaviconTarget(url: string): string | null {
  try {
    const parsed = new URL(url)

    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

/** Where the renderer paints the icon at `url` from; null when it isn't one. */
export function previewFaviconSrc(url: string): string | null {
  const target = previewFaviconTarget(url)

  return target ? `${PREVIEW_FAVICON_PROTOCOL}://icon/${encodeURIComponent(target)}` : null
}

/** The icon a work4you-favicon request asks for; null when it asks for none. */
export function previewFaviconTargetFromRequest(requestUrl: string): string | null {
  try {
    const parsed = new URL(requestUrl)

    if (parsed.protocol !== `${PREVIEW_FAVICON_PROTOCOL}:` || parsed.hostname !== 'icon') {
      return null
    }

    return previewFaviconTarget(decodeURIComponent(parsed.pathname.replace(/^\//, '')))
  } catch {
    return null
  }
}
