import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetComposioLogoCache, resolveComposioLogoSrc, useComposioLogoSrc } from './composio-logo'

const GMAIL = 'https://logos.composio.dev/api/gmail'
const DATA = 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E'

const desktopWindow = window as unknown as { work4youDesktop?: Window['work4youDesktop'] }
const initial = desktopWindow.work4youDesktop

afterEach(() => {
  resetComposioLogoCache()
  desktopWindow.work4youDesktop = initial
})

describe('resolveComposioLogoSrc', () => {
  it('returns the CDN URL when the desktop bridge is absent', async () => {
    desktopWindow.work4youDesktop = undefined

    await expect(resolveComposioLogoSrc(GMAIL)).resolves.toBe(GMAIL)
  })

  it('rejects untrusted hosts', async () => {
    await expect(resolveComposioLogoSrc('https://evil.example/gmail')).rejects.toThrow(/untrusted/)
  })

  it('uses the main-process proxy and caches the data URL', async () => {
    const fetchComposioLogo = vi.fn().mockResolvedValue(DATA)
    desktopWindow.work4youDesktop = { fetchComposioLogo } as unknown as Window['work4youDesktop']

    await expect(resolveComposioLogoSrc(GMAIL)).resolves.toBe(DATA)
    await expect(resolveComposioLogoSrc(GMAIL)).resolves.toBe(DATA)
    expect(fetchComposioLogo).toHaveBeenCalledTimes(1)
  })

  it('rejects a proxy payload that is not an image data URL', async () => {
    desktopWindow.work4youDesktop = {
      fetchComposioLogo: vi.fn().mockResolvedValue('https://evil.example/x.png')
    } as unknown as Window['work4youDesktop']

    await expect(resolveComposioLogoSrc(GMAIL)).rejects.toThrow(/data url/)
  })
})

describe('useComposioLogoSrc', () => {
  it('paints the CDN URL directly without a bridge', () => {
    desktopWindow.work4youDesktop = undefined
    const { result } = renderHook(() => useComposioLogoSrc(GMAIL))

    expect(result.current).toEqual({ failed: false, src: GMAIL })
  })

  it('swaps in the proxied data URL when the bridge is present', async () => {
    desktopWindow.work4youDesktop = {
      fetchComposioLogo: vi.fn().mockResolvedValue(DATA)
    } as unknown as Window['work4youDesktop']

    const { result } = renderHook(() => useComposioLogoSrc(GMAIL))

    expect(result.current.src).toBeNull()
    await waitFor(() => {
      expect(result.current).toEqual({ failed: false, src: DATA })
    })
  })

  it('marks failed when the proxy returns nothing so the avatar can fall back', async () => {
    desktopWindow.work4youDesktop = {
      fetchComposioLogo: vi.fn().mockResolvedValue(null)
    } as unknown as Window['work4youDesktop']

    const { result } = renderHook(() => useComposioLogoSrc(GMAIL))

    await waitFor(() => {
      expect(result.current).toEqual({ failed: true, src: null })
    })
  })
})
