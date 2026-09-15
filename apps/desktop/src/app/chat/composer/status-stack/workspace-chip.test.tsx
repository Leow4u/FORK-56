import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SELECT_WORKSPACE_PAGE } from '@/app/command-palette/workspace-palette'
import { $commandPaletteOpen, $commandPalettePage, closeCommandPalette } from '@/store/command-palette'

import { WorkspaceChipRow } from './workspace-chip'

afterEach(() => {
  cleanup()
  closeCommandPalette()
})

describe('WorkspaceChipRow', () => {
  it('paints Select workspace on an empty chat and opens the picker', () => {
    render(<WorkspaceChipRow messagesEmpty />)

    const chip = screen.getByRole('button', { name: 'Select workspace' })

    expect(chip.textContent).toContain('Select workspace')
    expect(chip.textContent).not.toContain('Home')

    fireEvent.click(chip)

    expect($commandPaletteOpen.get()).toBe(true)
    expect($commandPalettePage.get()).toBe(SELECT_WORKSPACE_PAGE)
  })

  it('keeps the visible label Select workspace even when a cwd is set', () => {
    render(<WorkspaceChipRow cwd="/repos/website/src" messagesEmpty />)

    expect(screen.getByRole('button', { name: 'Select workspace' }).textContent).toContain('Select workspace')
    expect(screen.getByRole('button', { name: 'Select workspace' }).textContent).not.toContain('website')
  })

  it('stays off the composer once the transcript has messages', () => {
    const { container } = render(<WorkspaceChipRow cwd="/repos/website" messagesEmpty={false} />)

    expect(screen.queryByRole('button', { name: 'Select workspace' })).toBeNull()
    expect(container.querySelector('[data-slot="workspace-chip"]')).toBeNull()
  })
})
