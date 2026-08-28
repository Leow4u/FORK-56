/** @vitest-environment jsdom */
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

  it('renders the personality headline instead of a WORK4YOU wordmark', () => {
    render(<Intro seed={0} />)

    const intro = document.querySelector('[data-slot="aui_intro"]')
    const [headline, body] = Array.from(intro?.querySelectorAll('p') ?? [])

    expect(headline?.textContent?.trim()).toBeTruthy()
    expect(headline?.textContent?.trim()).not.toBe('WORK4YOU')
    expect(body?.textContent?.trim().length).toBeGreaterThan(20)
    expect(screen.queryByLabelText('WORK4YOU')).toBeNull()
    expect(document.querySelector('.fit-text')).toBeNull()
  })

  it('keeps the empty-state copy quiet and sentence-case', () => {
    const { container } = render(<Intro seed={0} />)
    const headline = container.querySelector('[data-slot="aui_intro"] p')

    expect(headline?.className).not.toMatch(/uppercase/)
    expect(headline?.className).not.toMatch(/Collapse/)
    expect(headline?.className).toMatch(/text-xl/)
    expect(headline?.className).toMatch(/font-semibold/)
  })
})
