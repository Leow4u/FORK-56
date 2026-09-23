import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'

import { ActiveModelOptions, type FastControl } from './model-edit-submenu'

// Radix calls these on open; jsdom doesn't implement them.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderOptions(opts: {
  defaultEffort?: string
  effort?: string
  fastControl: FastControl
  model?: string
  onSelectModel?: (model: string) => void
  onSetOptions: (patch: { effort?: string; fast?: boolean }) => void
  reasoning: boolean
}) {
  return render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <ActiveModelOptions
          defaultEffort={opts.defaultEffort ?? 'medium'}
          effort={opts.effort ?? 'medium'}
          fastControl={opts.fastControl}
          model={opts.model}
          onSelectModel={opts.onSelectModel ?? vi.fn()}
          onSetOptions={opts.onSetOptions}
          reasoning={opts.reasoning}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The panel is PURE: it reports edits and never writes to a session, a
// preset store, or the gateway. That's the invariant that lets the same
// controls drive a live chat session AND a detached per-task override.
describe('ActiveModelOptions reports edits without performing them', () => {
  it('param fast: reports the toggle', () => {
    const onSetOptions = vi.fn()
    renderOptions({ fastControl: { kind: 'param', on: true }, onSetOptions, reasoning: false })

    fireEvent.click(screen.getByRole('switch'))

    expect(onSetOptions).toHaveBeenCalledWith({ fast: false })
  })

  it('thinking: toggling off reports the none level', () => {
    const onSetOptions = vi.fn()
    renderOptions({ fastControl: { kind: 'none' }, onSetOptions, reasoning: true })

    fireEvent.click(screen.getByRole('switch'))

    expect(onSetOptions).toHaveBeenCalledWith({ effort: 'none' })
  })

  it('thinking: toggling back on restores the row level, not the hardcoded default', () => {
    const onSetOptions = vi.fn()
    renderOptions({
      defaultEffort: 'high',
      effort: 'none',
      fastControl: { kind: 'none' },
      onSetOptions,
      reasoning: true
    })

    fireEvent.click(screen.getByRole('switch'))

    expect(onSetOptions).toHaveBeenCalledWith({ effort: 'high' })
  })

  it('shows Extra High as the ceiling, and Max only for Claude', () => {
    const { unmount } = renderOptions({
      effort: 'ultra',
      fastControl: { kind: 'none' },
      model: 'x-ai/grok-4.7',
      onSetOptions: vi.fn(),
      reasoning: true
    })

    expect(screen.getByText('Extra High')).toBeTruthy()
    expect(screen.queryByText('Minimal')).toBeNull()
    expect(screen.queryByText('Ultra')).toBeNull()
    expect(screen.queryByText('Max')).toBeNull()
    unmount()

    renderOptions({
      effort: 'ultra',
      fastControl: { kind: 'none' },
      model: 'anthropic/claude-sonnet-5',
      onSetOptions: vi.fn(),
      reasoning: true
    })

    expect(screen.getAllByText('Max').length).toBeGreaterThan(0)
    expect(screen.queryByText('Ultra')).toBeNull()
    expect(screen.queryByText('Minimal')).toBeNull()
  })

  it('hides Effort while thinking is off', () => {
    renderOptions({
      effort: 'none',
      fastControl: { kind: 'none' },
      onSetOptions: vi.fn(),
      reasoning: true
    })

    expect(screen.getByText('Thinking')).toBeTruthy()
    expect(screen.queryByText('Effort')).toBeNull()
  })

  it('hides Fast when the model has no fast control', () => {
    renderOptions({ fastControl: { kind: 'none' }, onSetOptions: vi.fn(), reasoning: true })

    expect(screen.queryByText('Fast')).toBeNull()
  })

  it('variant fast: swaps to the -fast sibling', () => {
    const onSelectModel = vi.fn()
    const onSetOptions = vi.fn()

    renderOptions({
      fastControl: { baseId: 'm1', fastId: 'm1-fast', kind: 'variant', on: false },
      onSelectModel,
      onSetOptions,
      reasoning: false
    })

    fireEvent.click(screen.getByRole('switch'))

    expect(onSetOptions).toHaveBeenCalledWith({ fast: true })
    expect(onSelectModel).toHaveBeenCalledWith('m1-fast')
  })

  it('renders nothing when the model has no options', () => {
    renderOptions({ fastControl: { kind: 'none' }, onSetOptions: vi.fn(), reasoning: false })

    expect(screen.queryByText('Thinking')).toBeNull()
    expect(screen.queryByText('Fast')).toBeNull()
    expect(screen.queryByText('Effort')).toBeNull()
  })
})
