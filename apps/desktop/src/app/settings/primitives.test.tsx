import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PAGE_SETTINGS_MAX_W } from '../layout-constants'

import { ListRow, SectionHeading, SettingsContent, SettingsGroup, ToggleRow } from './primitives'

afterEach(() => {
  cleanup()
})

describe('SectionHeading', () => {
  it('renders a page title as an h1', () => {
    render(<SectionHeading title="Appearance" variant="page" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Appearance' })).toBeTruthy()
  })

  it('renders a group label as a quiet h2', () => {
    render(<SectionHeading title="Updates" variant="group" />)

    expect(screen.getByRole('heading', { level: 2, name: 'Updates' })).toBeTruthy()
  })
})

describe('SettingsContent', () => {
  it('keeps a centered capped column instead of filling the stage', () => {
    render(
      <SettingsContent>
        <p>Body</p>
      </SettingsContent>
    )

    const column = document.querySelector('[data-slot="settings-content"]')

    expect(column).toBeTruthy()
    expect(column?.className).toContain('mx-auto')
    expect(column?.className).toContain(PAGE_SETTINGS_MAX_W)
    expect(column?.className).not.toContain('max-w-none')
    expect(column?.className).not.toContain('max-w-full')
  })
})

describe('ListRow', () => {
  it('keeps the control on the title line, with the description underneath', () => {
    const { container } = render(
      <ListRow action={<button type="button">Change</button>} description="Shown in menus" title="Language" />
    )

    const grid = container.querySelector('.grid')

    expect(grid?.className).toContain('grid-cols-[minmax(0,1fr)_auto]')
    expect(grid?.className).not.toContain('grid-cols-1')
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy()
    expect(screen.getByText('Shown in menus')).toBeTruthy()
  })

  it('stacks a wide action under the label', () => {
    const { container } = render(<ListRow action={<button type="button">Pick</button>} title="Theme" wide />)

    expect(container.querySelector('.grid')?.className).toContain('grid-cols-1')
  })
})

describe('ToggleRow', () => {
  it('keeps the switch on the title line at every width', () => {
    const { container } = render(
      <ToggleRow checked={false} description="Play a sound" label="Sounds" onChange={() => undefined} />
    )

    expect(container.querySelector('.grid')?.className).toContain('grid-cols-[minmax(0,1fr)_auto]')
    expect(screen.getByRole('switch', { name: 'Sounds' })).toBeTruthy()
    expect(screen.getByText('Play a sound')).toBeTruthy()
  })
})

describe('SettingsGroup', () => {
  it('renders a well with data-slot="settings-group"', () => {
    render(
      <SettingsGroup title="Language">
        <ListRow action={<button type="button">Change</button>} title="Display language" />
      </SettingsGroup>
    )

    const well = document.querySelector('[data-slot="settings-group"]')

    expect(well).toBeTruthy()
    expect(well?.className).toContain('rounded-xl')
    expect(well?.className).toContain('bg-(--ui-bg-editor)')
    expect(well?.className).toContain('divide-y')
    expect(screen.getByRole('heading', { level: 2, name: 'Language' })).toBeTruthy()
    expect(screen.getByText('Display language')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy()
  })
})
