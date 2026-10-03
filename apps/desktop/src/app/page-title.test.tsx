// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PageTitle } from './page-title'

afterEach(cleanup)

describe('PageTitle', () => {
  it('names the page in the level-1 heading with the trailing content on the same line', () => {
    render(<PageTitle aside={<button type="button">Refresh</button>}>Artifacts</PageTitle>)

    const heading = screen.getByRole('heading', { level: 1, name: 'Artifacts' })
    const row = heading.parentElement

    expect(row?.contains(screen.getByRole('button', { name: 'Refresh' }))).toBe(true)
    // The air to the page's first row is the row's own, the same on every page.
    expect(row?.className).toContain('mb-7')
  })
})
