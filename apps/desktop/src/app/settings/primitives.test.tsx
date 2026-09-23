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

describe('ToggleRow', () => {
  it('keeps the switch on the title line at every width', () => {
    render(<ToggleRow checked={false} description="Play a sound" label="Sounds" onChange={() => undefined} />)

    const row = screen.getByRole('switch', { name: 'Sounds' }).closest('[data-action-align]')

    expect(row?.getAttribute('data-action-align')).toBe('end')
    expect(row?.querySelector('.grid')?.className).toContain('grid-cols-[minmax(0,1fr)_auto]')
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
    expect(well?.className).not.toContain('chat-surface-background')
    expect(well?.className).not.toContain('rounded-xl')
    expect(screen.getByRole('heading', { level: 2, name: 'Language' })).toBeTruthy()
    expect(screen.getByText('Display language')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy()
  })
})
