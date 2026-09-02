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
  it('returns the CDN URL on http(s) even when the desktop bridge is present', async () => {
    desktopWindow.work4youDesktop = {
      fetchComposioLogo: vi.fn().mockResolvedValue(DATA)
    } as unknown as Window['work4youDesktop']

    await expect(resolveComposioLogoSrc(GMAIL, 'https:')).resolves.toBe(GMAIL)
    await expect(resolveComposioLogoSrc(GMAIL, 'http:')).resolves.toBe(GMAIL)
    expect(desktopWindow.work4youDesktop.fetchComposioLogo).not.toHaveBeenCalled()
  })

  it('rejects untrusted hosts', async () => {
    await expect(resolveComposioLogoSrc('https://evil.example/gmail', 'file:')).rejects.toThrow(/untrusted/)
  })

  it('uses the main-process proxy on file:// and caches the data URL', async () => {
    const fetchComposioLogo = vi.fn().mockResolvedValue(DATA)
    desktopWindow.work4youDesktop = { fetchComposioLogo } as unknown as Window['work4youDesktop']

    await expect(resolveComposioLogoSrc(GMAIL, 'file:')).resolves.toBe(DATA)
    await expect(resolveComposioLogoSrc(GMAIL, 'file:')).resolves.toBe(DATA)
    expect(fetchComposioLogo).toHaveBeenCalledTimes(1)
    expect(fetchComposioLogo).toHaveBeenCalledWith(GMAIL)
  })

  it('rejects a proxy payload that is not an image data URL', async () => {
    desktopWindow.work4youDesktop = {
      fetchComposioLogo: vi.fn().mockResolvedValue('https://evil.example/x.png')
    } as unknown as Window['work4youDesktop']

    await expect(resolveComposioLogoSrc(GMAIL, 'file:')).rejects.toThrow(/data url/)
  })

  it('fails closed on file:// when the bridge is missing instead of using the CDN <img>', async () => {
    desktopWindow.work4youDesktop = undefined

    await expect(resolveComposioLogoSrc(GMAIL, 'file:')).rejects.toThrow(/unavailable/)
  })
})

describe('useComposioLogoSrc', () => {
  it('paints the CDN URL directly on http(s)', () => {
    desktopWindow.work4youDesktop = {
      fetchComposioLogo: vi.fn().mockResolvedValue(DATA)
    } as unknown as Window['work4youDesktop']

    const { result } = renderHook(() => useComposioLogoSrc(GMAIL, 'https:'))

    expect(result.current).toEqual({ failed: false, src: GMAIL })
    expect(desktopWindow.work4youDesktop.fetchComposioLogo).not.toHaveBeenCalled()
  })

  it('swaps in the proxied data URL on file://', async () => {
    desktopWindow.work4youDesktop = {
      fetchComposioLogo: vi.fn().mockResolvedValue(DATA)
    } as unknown as Window['work4youDesktop']

    const { result } = renderHook(() => useComposioLogoSrc(GMAIL, 'file:'))

    expect(result.current.src).toBeNull()
    await waitFor(() => {
      expect(result.current).toEqual({ failed: false, src: DATA })
    })
  })

  it('marks failed when the proxy returns nothing so the avatar can fall back', async () => {
    desktopWindow.work4youDesktop = {
      fetchComposioLogo: vi.fn().mockResolvedValue(null)
    } as unknown as Window['work4youDesktop']

    const { result } = renderHook(() => useComposioLogoSrc(GMAIL, 'file:'))

    await waitFor(() => {
      expect(result.current).toEqual({ failed: true, src: null })
    })
  })
})
