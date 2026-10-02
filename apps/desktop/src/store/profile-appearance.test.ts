import { atom } from 'nanostores'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { botAppearance, PRIMARY_BOT_APPEARANCE } from '@/lib/bot-avatar'
import { profileColor } from '@/lib/profile-color'

// The look every face draws from: the stored WorkBots look first, the rail's
// local color pick as fallback, the fetched avatar picture on top.
vi.mock('@/store/gateway', () => ({
  $gateway: atom(null),
  ensureGatewayForAgent: vi.fn(async () => true),
  ensureGatewayForProfile: vi.fn(async () => undefined),
  openGatewayForProfile: vi.fn(async () => undefined)
}))
vi.mock('@/work4you', () => ({
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  setApiRequestProfile: vi.fn()
}))

const { $profileColors, $profiles } = await import('@/store/profile')
const { $profileAvatars } = await import('@/store/profile-avatars')
const { $profileLooks, resolveProfileLook } = await import('@/store/profile-appearance')

function profile(name: string, extra: Record<string, unknown> = {}) {
  return {
    has_env: false,
    is_default: name === 'default',
    model: null,
    name,
    path: `/p/${name}`,
    provider: null,
    skill_count: 0,
    ...extra
  }
}

beforeEach(() => {
  $profiles.set([])
  $profileColors.set({})
  $profileAvatars.set({})
})

describe('$profileLooks', () => {
  it('draws an unconfigured profile from its name, like the roster does', () => {
    $profiles.set([profile('default'), profile('perfil-novo')])

    const looks = $profileLooks.get()

    expect(looks.default.appearance).toEqual({ ...PRIMARY_BOT_APPEARANCE, image: null })
    expect(looks['perfil-novo'].appearance).toEqual(botAppearance('perfil-novo'))
    expect(looks['perfil-novo'].hasAvatar).toBe(false)
  })

  it('takes the stored WorkBots look over the name, and the rail pick over nothing', () => {
    $profiles.set([
      profile('research', { ui_meta: { 'work4you-bots': { color: '#ef4444', custom: true, shape: 'cloud' } } }),
      profile('writer')
    ])
    $profileColors.set({ research: '#000000', writer: '#14b8a6' })

    const looks = $profileLooks.get()

    // Stored color beats the local pick; stored shape beats the rolled one.
    expect(looks.research.appearance).toEqual({ color: '#ef4444', image: null, shape: 'cloud' })
    // No stored color: the local pick stands in; the shape still rolls.
    expect(looks.writer.appearance.color).toBe('#14b8a6')
    expect(looks.writer.appearance.shape).toBe(botAppearance('writer').shape)
  })

  it('lets a chosen color give the primary profile a look of its own', () => {
    $profiles.set([profile('default', { ui_meta: { 'work4you-bots': { color: '#ef4444', custom: true } } })])

    expect($profileLooks.get().default.appearance.color).toBe('#ef4444')
  })

  it('puts the fetched picture on the face and reports the asset flag', () => {
    $profiles.set([profile('research', { has_avatar: true })])

    expect($profileLooks.get().research).toEqual({
      appearance: { ...botAppearance('research'), image: null },
      hasAvatar: true
    })

    $profileAvatars.set({ research: 'data:image/png;base64,photo' })

    expect($profileLooks.get().research.appearance.image).toBe('data:image/png;base64,photo')
  })

  it('resolves a name the list does not carry from the name alone', () => {
    const look = resolveProfileLook('ghost', undefined, {}, {})

    expect(look.hasAvatar).toBe(false)
    expect(look.appearance.color).toBe(profileColor('ghost'))
    expect(resolveProfileLook('', undefined, {}, {}).appearance).toEqual({ ...PRIMARY_BOT_APPEARANCE, image: null })
  })
})
