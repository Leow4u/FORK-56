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

  it('does not paint a Work4You is ready kicker above the personality headline', () => {
    const { container } = render(<Intro personality="helpful" seed={0} />)

    const intro = container.querySelector('[data-slot="aui_intro"]')
    const headline = intro?.querySelector('[data-slot="aui_intro_headline"]')
    const body = intro?.querySelector('[data-slot="aui_intro_body"]')

    expect(intro?.querySelector('[data-slot="aui_intro_ready"]')).toBeNull()
    expect(headline?.textContent?.trim()).toBe('Ready when you are')
    expect(headline?.textContent?.trim()).not.toBe('WORK4YOU')
    expect(body?.textContent?.trim().length).toBeGreaterThan(20)
    expect(screen.queryByText('Work4You is ready')).toBeNull()
    expect(screen.queryByLabelText('WORK4YOU')).toBeNull()
    expect(container.querySelector('.fit-text')).toBeNull()
  })

  it('keeps personality headlines even when they mention ready', () => {
    const { container } = render(<Intro personality="none" seed={0} />)

    expect(container.querySelector('[data-slot="aui_intro_ready"]')).toBeNull()
    expect(container.querySelector('[data-slot="aui_intro_headline"]')?.textContent?.trim()).toBe('Work4You is ready.')
  })

  it('keeps the empty-state copy quiet and sentence-case', () => {
    const { container } = render(<Intro personality="helpful" seed={0} />)
    const headline = container.querySelector('[data-slot="aui_intro_headline"]')

    expect(headline?.className).not.toMatch(/uppercase/)
    expect(headline?.className).not.toMatch(/Collapse/)
    expect(headline?.className).toMatch(/text-xl/)
    expect(headline?.className).toMatch(/font-semibold/)
  })

  it('ranks splash headline above body by weight', () => {
    const { container } = render(<Intro personality="helpful" seed={0} />)

    const headline = container.querySelector('[data-slot="aui_intro_headline"]')
    const body = container.querySelector('[data-slot="aui_intro_body"]')

    expect(headline?.className).toMatch(/text-xl/)
    expect(headline?.className).toMatch(/font-semibold/)
    expect(headline?.className).toMatch(/text-foreground/)

    expect(body?.className).toMatch(/text-sm/)
    expect(body?.className).toMatch(/font-normal/)
    expect(body?.className).not.toMatch(/text-xl/)
    expect(body?.className).not.toMatch(/font-semibold/)
    expect(body?.className).not.toMatch(/tracking-tight/)
  })
})
