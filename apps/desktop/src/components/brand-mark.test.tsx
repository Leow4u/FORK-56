import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BrandMark } from './brand-mark'

describe('BrandMark', () => {
  it('renders the icon without a white tile', () => {
    render(<BrandMark />)

    const img = document.querySelector('img[src*="work4you-icon.png"]')
    expect(img).toBeTruthy()
    expect(img?.parentElement?.className).not.toContain('bg-white')
  })
})
