import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { paintCharacterFace } from '@/lib/bot-character-motion'
import { BOT_CHARACTERS } from '@/lib/bot-characters'

vi.mock('@/lib/bot-face-clock', () => ({ startFaceClock: vi.fn() }))

const { BotFace } = await import('./bot-face')

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('animated characters', () => {
  it('reacts to the existing parent button without consuming its activation or adding a tab stop', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    const activate = vi.fn()

    const { container, getByRole } = render(
      <button onClick={activate} type="button">
        <BotFace color="#2585ef" name="agent" shape="character:headphones" />
        Select profile
      </button>
    )

    const face = container.querySelector<HTMLElement>('[data-hb-character]')!

    paintCharacterFace(face, 1.3)
    const idle = face.style.transform

    fireEvent.focusIn(getByRole('button'))
    paintCharacterFace(face, 1.3)
    expect(face.style.transform).not.toBe(idle)
    fireEvent.click(getByRole('button'))
    paintCharacterFace(face, 1.3)
    expect(activate).toHaveBeenCalledTimes(1)
    expect(face.style.transform).not.toBe(idle)
    expect(face.hasAttribute('tabindex')).toBe(false)
    expect(container.querySelectorAll('button')).toHaveLength(1)
  })

  it('removes interaction listeners when a character is replaced with an upload', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)

    const { container, rerender, getByRole } = render(
      <button type="button">
        <BotFace color="#2585ef" shape="character:headphones" />
      </button>
    )

    const face = container.querySelector<HTMLElement>('[data-hb-character]')!

    paintCharacterFace(face, 1.3)
    const idle = face.style.transform

    rerender(
      <button type="button">
        <BotFace color="#2585ef" image="photo.png" shape="character:headphones" />
      </button>
    )
    fireEvent.click(getByRole('button'))
    paintCharacterFace(face, 1.3)
    expect(face.style.transform).toBe(idle)
    expect(container.querySelector('[data-hb-character]')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('photo.png')
  })

  it.each(BOT_CHARACTERS)('preserves $id art and forwards the live mood as it changes', character => {
    const { container, rerender } = render(<BotFace color={character.color} shape={character.shape} />)
    const original = container.querySelector('img')?.getAttribute('src')

    rerender(<BotFace color={character.color} mood="work" shape={character.shape} />)
    expect(container.querySelector('[data-hb-character]')?.getAttribute('data-hb-mood')).toBe('work')
    expect(container.querySelector('img')?.getAttribute('src')).toBe(original)
    expect(container.querySelectorAll('[data-character-eye]').length).toBe(character.eyes?.length ?? 0)
  })

  it('reveals eye layers only after load and falls back to the original on failure', () => {
    const { container } = render(<BotFace color="#2585ef" shape="character:headphones" />)
    const face = container.querySelector<HTMLElement>('[data-hb-character]')!
    const overlay = container.querySelector<SVGSVGElement>('[data-character-eyes]')!
    const plate = overlay.querySelector('image')!

    paintCharacterFace(face, 4.5)
    expect(overlay.style.visibility).toBe('hidden')
    fireEvent.load(plate)
    paintCharacterFace(face, 4.5)
    expect(overlay.style.visibility).toBe('visible')
    fireEvent.error(plate)
    paintCharacterFace(face, 4.5)
    expect(overlay.style.visibility).toBe('hidden')
  })

  it('does not enqueue interaction motion when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    const activate = vi.fn()

    const { container, getByRole } = render(
      <button onClick={activate} type="button">
        <BotFace color="#2585ef" shape="character:headphones" />
      </button>
    )

    const face = container.querySelector<HTMLElement>('[data-hb-character]')!

    paintCharacterFace(face, 1.3)
    const idle = face.style.transform

    fireEvent.click(getByRole('button'))
    paintCharacterFace(face, 1.3)
    expect(face.style.transform).toBe(idle)
    expect(activate).toHaveBeenCalledTimes(1)
  })
})
