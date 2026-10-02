import type { atom } from 'nanostores'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Saving a whole look for a profile: the stored WorkBots look in ui_meta,
// the picture in the asset store, the local color copy, and a forgotten
// avatar cache entry so the next face fetches the new picture.
const gateway = vi.hoisted(() => {
  const { atom: makeAtom } = require('nanostores') as { atom: typeof atom }
  const request = vi.fn(async () => ({ ok: true }))

  return { $gateway: makeAtom<null | { request: typeof request }>({ request }), request }
})

const api = vi.hoisted(() => ({ getProfiles: vi.fn(async () => ({ profiles: [] })) }))

vi.mock('@/store/gateway', () => ({
  $gateway: gateway.$gateway,
  ensureGatewayForAgent: vi.fn(async () => true),
  ensureGatewayForProfile: vi.fn(async () => undefined),
  openGatewayForProfile: vi.fn(async () => undefined)
}))
vi.mock('@/work4you', () => ({
  getProfiles: api.getProfiles,
  setApiRequestProfile: vi.fn()
}))

const { $profileColors, saveProfileLook } = await import('./profile')
const { $profileAvatars } = await import('./profile-avatars')

beforeEach(() => {
  $profileColors.set({})
  $profileAvatars.set({})
  gateway.request.mockClear()
  api.getProfiles.mockClear()
  gateway.$gateway.set({ request: gateway.request })
})

describe('saveProfileLook', () => {
  it('stores shape and color as a customized look, paints the local color, and refreshes the list', async () => {
    await saveProfileLook('research', { color: '#ef4444', image: null, shape: 'cloud' })

    expect($profileColors.get()).toEqual({ research: '#ef4444' })
    expect(gateway.request).toHaveBeenNthCalledWith(1, 'profiles.configure', {
      name: 'research',
      ui_meta: { 'work4you-bots': { color: '#ef4444', custom: true, imageKind: 'shape', shape: 'cloud' } }
    })
    expect(gateway.request).toHaveBeenNthCalledWith(2, 'profiles.set_asset', {
      asset: 'avatar',
      clear: true,
      name: 'research'
    })
    expect(api.getProfiles).toHaveBeenCalledTimes(1)
  })

  it('pushes a picked picture to the asset store and forgets the cached avatar', async () => {
    $profileAvatars.set({ research: null })

    await saveProfileLook('research', { image: 'data:image/png;base64,me' })

    expect(gateway.request).toHaveBeenNthCalledWith(1, 'profiles.configure', {
      name: 'research',
      ui_meta: { 'work4you-bots': { imageKind: 'photo' } }
    })
    expect(gateway.request).toHaveBeenNthCalledWith(2, 'profiles.set_asset', {
      asset: 'avatar',
      data: 'data:image/png;base64,me',
      name: 'research'
    })
    expect($profileAvatars.get()).toEqual({})
    expect($profileColors.get()).toEqual({})
  })

  it('keeps the local pick when the gateway is away or older', async () => {
    gateway.$gateway.set(null)
    await saveProfileLook('research', { color: '#14b8a6' })
    expect($profileColors.get()).toEqual({ research: '#14b8a6' })

    gateway.$gateway.set({ request: gateway.request })
    gateway.request.mockRejectedValueOnce(new Error('Method not found'))
    await expect(saveProfileLook('writer', { shape: 'pill' })).resolves.toBeUndefined()
    expect(api.getProfiles).not.toHaveBeenCalled()
  })
})
