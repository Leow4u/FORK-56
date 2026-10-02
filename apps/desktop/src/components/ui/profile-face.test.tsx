import { act, cleanup, render } from '@testing-library/react'
import type { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A profile drawn as its bot: the look comes from the profile stores, the
// picture is fetched once when the profile reports one.
const gateway = vi.hoisted(() => {
  const { atom: makeAtom } = require('nanostores') as { atom: typeof atom }
  const request = vi.fn()

  return { $gateway: makeAtom<null | { request: typeof request }>({ request }), request }
})

vi.mock('@/store/gateway', () => ({
  $gateway: gateway.$gateway,
  ensureGatewayForAgent: vi.fn(async () => true),
  ensureGatewayForProfile: vi.fn(async () => undefined),
  openGatewayForProfile: vi.fn(async () => undefined)
}))
vi.mock('@/work4you', () => ({
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  setApiRequestProfile: vi.fn()
}))
vi.mock('@/lib/bot-face-clock', () => ({ startFaceClock: vi.fn() }))

const { $profileColors, $profiles } = await import('@/store/profile')
const { $profileAvatars } = await import('@/store/profile-avatars')
const { moodForBackendState, ProfileFace } = await import('./profile-face')

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

const PHOTO = 'data:image/jpeg;base64,photo'

beforeEach(() => {
  $profiles.set([])
  $profileColors.set({})
  $profileAvatars.set({})
  gateway.request.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('ProfileFace', () => {
  it('draws the stored look at the asked size', () => {
    $profiles.set([
      profile('research', { ui_meta: { 'work4you-bots': { color: '#ef4444', custom: true, shape: 'cloud' } } })
    ])

    const { container } = render(<ProfileFace name="research" size={24} />)
    const face = container.querySelector('[data-slot="profile-face"]') as HTMLElement
    const svg = face.querySelector('svg')

    expect(face.style.width).toBe('24px')
    expect(svg?.getAttribute('data-bot-face')).toBe('research')
    expect(svg?.getAttribute('data-hb-shape')).toBe('cloud')
    expect(svg?.querySelector('[data-hb-body]')?.getAttribute('fill')).toBe('#ef4444')
    expect(gateway.request).not.toHaveBeenCalled()
  })

  it('fetches the picture once when the profile reports one, then draws it', async () => {
    gateway.request.mockResolvedValue({ data: PHOTO, found: true })
    $profiles.set([profile('research', { has_avatar: true })])

    const { container } = render(
      <>
        <ProfileFace name="research" size={24} />
        <ProfileFace name="research" size={32} />
      </>
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(gateway.request).toHaveBeenCalledTimes(1)
    expect(container.querySelectorAll('img')).toHaveLength(2)
    expect(container.querySelector('img')?.getAttribute('src')).toBe(PHOTO)
  })

  it('draws a name the list does not carry from the name alone, and the primary profile as itself', () => {
    const { container } = render(
      <>
        <ProfileFace name="ghost" size={20} />
        <ProfileFace name="default" size={20} />
      </>
    )

    const faces = container.querySelectorAll('svg')

    expect(faces[0].getAttribute('data-bot-face')).toBe('ghost')
    expect(faces[1].getAttribute('data-hb-shape')).toBe('squircle')
    expect(faces[1].querySelector('[data-hb-body]')?.getAttribute('fill')).toBe('#8b5cf6')
  })

  it('works the face while the backend wakes', () => {
    expect(moodForBackendState('waking')).toBe('work')
    expect(moodForBackendState('running')).toBe('idle')
    expect(moodForBackendState('asleep')).toBe('idle')

    const { container } = render(<ProfileFace mood="work" name="research" size={24} />)

    expect(container.querySelector('svg')?.getAttribute('data-hb-mood')).toBe('work')
  })
})
