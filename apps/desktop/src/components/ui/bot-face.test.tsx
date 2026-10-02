import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const clock = vi.hoisted(() => ({ startFaceClock: vi.fn() }))

vi.mock('@/lib/bot-face-clock', () => ({ startFaceClock: clock.startFaceClock }))

const { BotFace } = await import('./bot-face')

afterEach(() => {
  cleanup()
  clock.startFaceClock.mockClear()
})

describe('BotFace', () => {
  it('draws an image avatar as a plain picture', () => {
    const { container } = render(
      <BotFace color="#ef4444" image="data:image/png;base64,x" name="research" shape="circle" />
    )

    const img = container.querySelector('img')

    expect(img?.getAttribute('src')).toBe('data:image/png;base64,x')
    expect(img?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('svg')).toBeNull()
  })

  it('draws a blob face through the library, tagged for the PNG backfill and ignored by the clock', () => {
    const { container } = render(<BotFace color="#ef4444" name="research" shape="blobatar::sun" size={48} />)
    const svg = container.querySelector('svg[data-bot-face="research"]')

    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('data-hb-math')).toBeNull()
  })

  it('draws the math face with the parts the clock moves, and wakes the clock on mount', () => {
    const { container } = render(<BotFace color="#f97316" name="perfil-novo" shape="triangle" size={34} />)
    const svg = container.querySelector('svg')

    expect(svg?.getAttribute('data-bot-face')).toBe('perfil-novo')
    expect(svg?.getAttribute('data-hb-math')).toBe('1')
    expect(svg?.getAttribute('data-hb-shape')).toBe('triangle')
    expect(svg?.getAttribute('data-hb-mood')).toBe('idle')
    expect(svg?.getAttribute('width')).toBe('34')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 40 44')

    for (const part of ['body', 'open', 'el', 'er', 'hl-l', 'hl-r', 'shut']) {
      expect(svg?.querySelector(`[data-hb-${part}]`)).not.toBeNull()
    }

    expect(svg?.querySelector('[data-hb-body]')?.getAttribute('fill')).toBe('#f97316')
    expect(svg?.querySelectorAll('[data-hb-dot]')).toHaveLength(0)
    expect(clock.startFaceClock).toHaveBeenCalledTimes(1)
  })

  it('shows the thinking dots while working', () => {
    const { container } = render(<BotFace color="#8b5cf6" mood="work" name="default" shape="squircle" />)

    expect(container.querySelector('svg')?.getAttribute('data-hb-mood')).toBe('work')
    expect(container.querySelectorAll('[data-hb-dot]')).toHaveLength(3)
  })

  it('flips pupils and catchlights together on a dark body so the sparkle stays visible', () => {
    const light = render(<BotFace color="#f5f5f4" name="a" shape="circle" />).container
    const dark = render(<BotFace color="#3b40c8" name="b" shape="circle" />).container

    const pupil = (root: HTMLElement) => root.querySelector('[data-hb-el]')?.getAttribute('fill')
    const sparkle = (root: HTMLElement) => root.querySelector('[data-hb-hl-l]')?.getAttribute('fill')

    expect(pupil(light)).toBe('rgba(0,0,0,0.85)')
    expect(sparkle(light)).toBe('rgba(255,255,255,0.85)')
    expect(pupil(dark)).toBe('rgba(232,220,195,0.95)')
    expect(sparkle(dark)).toBe('rgba(0,0,0,0.6)')
  })

  it('keeps a stored sigil pick as static line art outside the clock', () => {
    const { container } = render(<BotFace color="#14b8a6" name="old" shape="sigil-2" />)
    const svg = container.querySelector('svg')

    expect(svg?.getAttribute('data-bot-face')).toBe('old')
    expect(svg?.getAttribute('data-hb-math')).toBeNull()
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0)
  })
})
