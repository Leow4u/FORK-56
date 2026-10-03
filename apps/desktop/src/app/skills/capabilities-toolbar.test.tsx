// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CapabilitiesToolbar } from './capabilities-toolbar'

beforeEach(() => {
  // jsdom's scrollIntoView is missing; Radix Select calls it on open.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

describe('CapabilitiesToolbar', () => {
  it('switches between the tab-named "mine" view and Discover', () => {
    const onViewChange = vi.fn()

    render(<CapabilitiesToolbar mineLabel="Installed" onViewChange={onViewChange} view="mine" />)

    expect(screen.getByRole('button', { name: 'Installed' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Discover' }).getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Discover' }))

    expect(onViewChange).toHaveBeenCalledWith('discover')
  })

  it('filters by category, starting from All categories', async () => {
    const onCategoryChange = vi.fn()

    render(
      <CapabilitiesToolbar
        categories={[
          { count: 2, id: 'web', label: 'Web' },
          { id: 'creative', label: 'Creative' }
        ]}
        mineLabel="Installed"
        onCategoryChange={onCategoryChange}
        onViewChange={vi.fn()}
        view="mine"
      />
    )

    const select = screen.getByRole('combobox', { name: 'Category' })
    expect(select.textContent).toContain('All categories')

    fireEvent.click(select)
    fireEvent.click(await screen.findByRole('option', { name: /Web/ }))

    expect(onCategoryChange).toHaveBeenCalledWith('web')
  })

  it('keeps the creation entries behind one Add menu and hides the switch inside a detail pane', async () => {
    const onSelect = vi.fn()

    render(
      <CapabilitiesToolbar
        addItems={[
          { label: 'New server', onSelect },
          { label: 'Import', onSelect: vi.fn() }
        ]}
        categories={[{ id: 'developer', label: 'Developer' }]}
        mineLabel="Connected"
        onCategoryChange={vi.fn()}
        onViewChange={vi.fn()}
        view="discover"
        viewsHidden
      />
    )

    expect(screen.queryByRole('button', { name: 'Connected' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Category' })).toBeNull()

    fireEvent.keyDown(screen.getByRole('button', { name: /Add/ }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New server' }))

    expect(onSelect).toHaveBeenCalled()
  })
})
