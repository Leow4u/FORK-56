import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Zap } from '@/lib/icons'

import { OverlayNav, OverlayNavItem } from './overlay-split-layout'

afterEach(() => {
  cleanup()
})

describe('OverlayNav', () => {
  it('renders a header slot in the rail', () => {
    render(
      <OverlayNav
        groups={[
          {
            active: true,
            icon: Zap,
            id: 'models',
            label: 'Models',
            onSelect: () => undefined
          }
        ]}
        header={<span>Search settings</span>}
      />
    )

    const headers = document.querySelectorAll('[data-slot="overlay-nav-header"]')

    expect(headers.length).toBeGreaterThan(0)
    expect(headers[0]?.textContent).toBe('Search settings')
  })

  it('calls onSelect when a nav item is clicked', () => {
    const onSelect = vi.fn()

    render(
      <OverlayNav
        groups={[
          {
            active: false,
            icon: Zap,
            id: 'appearance',
            label: 'Appearance',
            onSelect
          }
        ]}
      />
    )

    fireEvent.click(document.querySelector('[data-tour="nav-appearance"]')!)

    expect(onSelect).toHaveBeenCalledOnce()
  })
})

describe('OverlayNavItem', () => {
  it('uses a boxed active fill by default', () => {
    render(<OverlayNavItem active icon={Zap} id="models" label="Models" onClick={() => undefined} />)

    const item = screen.getByRole('button', { name: 'Models' })

    expect(item.getAttribute('data-tone')).toBe('default')
    expect(item.className).toContain('border-(--ui-stroke-tertiary)')
    expect(item.className).toContain('bg-(--ui-bg-tertiary)')
  })

  it('uses a quiet text highlight when tone is quiet', () => {
    render(<OverlayNavItem active icon={Zap} id="models" label="Models" onClick={() => undefined} tone="quiet" />)

    const item = screen.getByRole('button', { name: 'Models' })

    expect(item.getAttribute('data-tone')).toBe('quiet')
    expect(item.className).toContain('bg-(--chrome-action-hover)')
    expect(item.className).not.toContain('border-(--ui-stroke-tertiary)')
  })
})
