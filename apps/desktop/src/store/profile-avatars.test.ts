import type { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The avatar cache asks the gateway once per profile and remembers the
// answer; a 160px PNG is the roster's snapshot of the vector face, not a
// picture, so it is remembered as "none" and the live face keeps drawing.
const gateway = vi.hoisted(() => {
  const { atom: makeAtom } = require('nanostores') as { atom: typeof atom }
  const request = vi.fn()

  return { $gateway: makeAtom<null | { request: typeof request }>({ request }), request }
})

vi.mock('@/store/gateway', () => ({ $gateway: gateway.$gateway }))

const { $profileAvatars, ensureProfileAvatar, invalidateProfileAvatar, reconcileProfileAvatars } =
  await import('./profile-avatars')

// A PNG header carrying the given pixel size (the IHDR width/height fields).
function pngDataUrl(width: number, height: number): string {
  const bytes = new Uint8Array(32)

  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
  bytes.set([(width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255], 16)
  bytes.set([(height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255], 20)

  return 'data:image/png;base64,' + btoa(String.fromCharCode(...bytes))
}

beforeEach(() => {
  $profileAvatars.set({})
  gateway.request.mockReset()
  gateway.$gateway.set({ request: gateway.request })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ensureProfileAvatar', () => {
  it('caches a real picture and asks the gateway once per profile', async () => {
    gateway.request.mockResolvedValue({ data: pngDataUrl(256, 256), found: true })

    await Promise.all([ensureProfileAvatar('research'), ensureProfileAvatar('research')])
    await ensureProfileAvatar('research')

    expect(gateway.request).toHaveBeenCalledTimes(1)
    expect(gateway.request).toHaveBeenCalledWith('profiles.get_asset', { asset: 'avatar', name: 'research' })
    expect($profileAvatars.get().research).toBe(pngDataUrl(256, 256))
  })

  it('remembers "none" for a missing asset and for the roster face snapshot', async () => {
    gateway.request
      .mockResolvedValueOnce({ found: false })
      .mockResolvedValueOnce({ data: pngDataUrl(160, 160), found: true })

    await ensureProfileAvatar('a')
    await ensureProfileAvatar('b')

    expect($profileAvatars.get()).toEqual({ a: null, b: null })
  })

  it('leaves a failed probe unchecked and retries only after a pause', async () => {
    vi.useFakeTimers()
    gateway.request.mockRejectedValueOnce(new Error('older gateway'))

    await ensureProfileAvatar('research')
    expect($profileAvatars.get()).toEqual({})

    gateway.request.mockResolvedValue({ data: pngDataUrl(256, 256), found: true })
    await ensureProfileAvatar('research')
    expect(gateway.request).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(31_000)
    await ensureProfileAvatar('research')
    expect(gateway.request).toHaveBeenCalledTimes(2)
    expect($profileAvatars.get().research).toBe(pngDataUrl(256, 256))
  })

  it('does nothing without a gateway or a name', async () => {
    gateway.$gateway.set(null)

    await ensureProfileAvatar('research')
    await ensureProfileAvatar('  ')

    expect(gateway.request).not.toHaveBeenCalled()
    expect($profileAvatars.get()).toEqual({})
  })
})

describe('cache upkeep', () => {
  it('invalidate forgets one profile; reconcile drops profiles the list no longer vouches for', () => {
    $profileAvatars.set({ gone: 'data:x', kept: 'data:y', cleared: 'data:z', none: null })

    invalidateProfileAvatar('kept')
    expect($profileAvatars.get()).toEqual({ gone: 'data:x', cleared: 'data:z', none: null })

    reconcileProfileAvatars([
      { has_avatar: true, name: 'none' },
      { has_avatar: false, name: 'cleared' },
      { has_avatar: true, name: 'newcomer' }
    ])
    expect($profileAvatars.get()).toEqual({ none: null })
  })
})
