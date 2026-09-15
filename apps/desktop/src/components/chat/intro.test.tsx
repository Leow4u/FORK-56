import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Intro } from './intro'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Intro', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  it('keeps a Work4You is ready kicker above the personality headline', () => {
    const { container } = render(<Intro personality="helpful" seed={0} />)

    const intro = container.querySelector('[data-slot="aui_intro"]')
    const ready = intro?.querySelector('[data-slot="aui_intro_ready"]')
    const headline = intro?.querySelector('[data-slot="aui_intro_headline"]')
    const body = intro?.querySelector('[data-slot="aui_intro_body"]')

    expect(ready?.textContent?.trim()).toBe('Work4You is ready')
    expect(headline?.textContent?.trim()).toBe('Ready when you are')
    expect(headline?.textContent?.trim()).not.toBe('WORK4YOU')
    expect(body?.textContent?.trim().length).toBeGreaterThan(20)
    expect(screen.queryByLabelText('WORK4YOU')).toBeNull()
    expect(container.querySelector('.fit-text')).toBeNull()
  })

  it('does not duplicate Work4You is ready when the personality headline already says it', () => {
    const { container } = render(<Intro personality="none" seed={0} />)

    const intro = container.querySelector('[data-slot="aui_intro"]')
    const ready = intro?.querySelector('[data-slot="aui_intro_ready"]')
    const headline = intro?.querySelector('[data-slot="aui_intro_headline"]')

    expect(ready).toBeNull()
    expect(headline?.textContent?.trim()).toBe('Work4You is ready.')
  })

  it('keeps the empty-state copy quiet and sentence-case', () => {
    const { container } = render(<Intro personality="helpful" seed={0} />)
    const headline = container.querySelector('[data-slot="aui_intro_headline"]')

    expect(headline?.className).not.toMatch(/uppercase/)
    expect(headline?.className).not.toMatch(/Collapse/)
    expect(headline?.className).toMatch(/text-xl/)
    expect(headline?.className).toMatch(/font-semibold/)
  })
})
